import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TiingoFundamentals {
  ticker: string;
  divYield?: number;
  marketCap?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting Tiingo yield update process - checking environment variables');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const tiingoApiKey = Deno.env.get('TIINGO_API_KEY');

    console.log(`📊 Environment check - SUPABASE_URL: ${supabaseUrl ? 'Found' : 'Missing'}`);
    console.log(`📊 Environment check - SUPABASE_SERVICE_ROLE_KEY: ${supabaseKey ? 'Found' : 'Missing'}`);
    console.log(`📊 Environment check - TIINGO_API_KEY: ${tiingoApiKey ? 'Found' : 'Missing'}`);

    if (!supabaseUrl) {
      console.error('❌ SUPABASE_URL not found in environment variables');
      throw new Error('SUPABASE_URL not found');
    }

    if (!supabaseKey) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not found');
    }

    if (!tiingoApiKey) {
      console.error('❌ TIINGO_API_KEY not found in environment variables');
      throw new Error('TIINGO_API_KEY not found');
    }

    if (tiingoApiKey.length < 10) {
      console.error('❌ TIINGO_API_KEY appears to be invalid (too short)');
      throw new Error('TIINGO_API_KEY appears to be invalid');
    }

    console.log(`🔑 Using Tiingo API key: ${tiingoApiKey.substring(0, 8)}...`);

    console.log('📋 Creating Supabase client');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Starting Tiingo yield update process');

    // Check if this is a test run (limit to 5 ETFs for testing)
    const isTestRun = true; // Set to false for production runs

    // Check if update has already run today (skip check in test mode)
    if (!isTestRun) {
      const today = new Date().toISOString().split('T')[0];
      const { data: existingLog, error: logCheckError } = await supabase
        .from('daily_update_logs')
        .select('id')
        .eq('run_date', today)
        .eq('status', 'completed')
        .single();

      if (existingLog && !logCheckError) {
        console.log('✅ Yield update already completed today');
        return new Response(
          JSON.stringify({ 
            message: 'Update already completed today', 
            date: today 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } else {
      console.log('🧪 Test mode: Skipping daily completion check');
    }

    // Create log entry
    const { data: logEntry, error: logError } = await supabase
      .from('daily_update_logs')
      .insert({
        status: 'running',
        start_time: new Date().toISOString()
      })
      .select('id')
      .single();

    if (logError) {
      throw new Error(`Failed to create log entry: ${logError.message}`);
    }

    console.log(`📊 Created log entry: ${logEntry.id}`);

    // Fetch active ETFs (only US tickers for Tiingo fundamentals)
    const { data: etfs, error: etfsError } = await supabase
      .from('etfs')
      .select('ticker')
      .eq('active', true)
      .not('ticker', 'like', '%.TO')
      .not('ticker', 'like', '%.NE') 
      .not('ticker', 'like', '%.V')
      .limit(isTestRun ? 5 : 1000);

    if (etfsError) {
      throw new Error(`Failed to fetch ETFs: ${etfsError.message}`);
    }

    console.log(`📈 Found ${etfs.length} active US ETFs to update ${isTestRun ? '(TEST MODE - limited to 5)' : '(FULL MODE)'}`);
    
    if (etfs.length === 0) {
      console.log('⚠️ No US ETFs found for Tiingo processing');
      return new Response(
        JSON.stringify({ 
          message: 'No US ETFs found for processing',
          totalETFs: 0,
          successful: 0,
          errors: 0
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let successCount = 0;
    let errorCount = 0;
    const batchSize = 30;
    const batches = [];
    
    for (let i = 0; i < etfs.length; i += batchSize) {
      batches.push(etfs.slice(i, i + batchSize));
    }

    console.log(`🔄 Processing ${batches.length} batches of up to ${batchSize} ETFs each`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} ETFs)`);

      for (const etf of batch) {
        try {
          console.log(`🔍 Fetching yield data for ${etf.ticker}`);
          
          const tiingoUrl = `https://api.tiingo.com/tiingo/fundamentals/${etf.ticker}/daily?token=${tiingoApiKey}`;
          
          console.log(`📡 Calling Tiingo API: ${tiingoUrl.replace(tiingoApiKey, 'XXXXX')}`);
          
          const response = await fetch(tiingoUrl);
          
          console.log(`📊 ${etf.ticker} - Response status: ${response.status} ${response.statusText}`);
          
          if (!response.ok) {
            if (response.status === 404) {
              console.log(`⚠️ ${etf.ticker}: Not found in Tiingo database`);
              continue;
            }
            const errorText = await response.text();
            console.error(`❌ ${etf.ticker} - Tiingo API error: ${response.status} ${response.statusText} - ${errorText}`);
            throw new Error(`Tiingo API error: ${response.status} ${response.statusText}`);
          }

          const data: TiingoFundamentals[] = await response.json();
          
          console.log(`📈 ${etf.ticker} - Received data:`, JSON.stringify(data).substring(0, 200) + '...');
          
          if (!data || data.length === 0 || !data[0].divYield) {
            console.log(`⚠️ ${etf.ticker}: No yield data available in response`);
            continue;
          }

          const yieldData = data[0];
          const yieldValue = yieldData.divYield;

          // Convert from decimal to percentage if needed (Tiingo returns as decimal)
          const yieldPercentage = yieldValue > 1 ? yieldValue : yieldValue * 100;

          console.log(`💰 ${etf.ticker}: Converting yield ${yieldValue} to ${yieldPercentage.toFixed(2)}%`);

          // Update ETF yield data
          const { error: updateError } = await supabase
            .from('etfs')
            .update({
              yield_ttm: yieldPercentage,
              price_updated_at: new Date().toISOString()
            })
            .eq('ticker', etf.ticker);

          if (updateError) {
            console.error(`❌ Failed to update ${etf.ticker} in database:`, updateError);
            errorCount++;
          } else {
            console.log(`✅ ${etf.ticker}: Updated yield to ${yieldPercentage.toFixed(2)}%`);
            successCount++;
          }

          // Rate limiting: Wait 1 second between requests
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error: any) {
          console.error(`❌ Error processing ${etf.ticker}:`, error.message);
          errorCount++;
        }
      }

      // Wait 60 seconds between batches if not the last batch
      if (batchIndex < batches.length - 1) {
        console.log('⏱️ Waiting 60 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }

    // Update log entry with completion
    const { error: logUpdateError } = await supabase
      .from('daily_update_logs')
      .update({
        status: 'completed',
        end_time: new Date().toISOString(),
        total_etfs: etfs.length,
        updated_etfs: successCount,
        error_message: errorCount > 0 ? `${errorCount} errors occurred` : null
      })
      .eq('id', logEntry.id);

    if (logUpdateError) {
      console.error('❌ Failed to update log entry:', logUpdateError);
    }

    const summary = {
      totalETFs: etfs.length,
      successful: successCount,
      errors: errorCount,
      timestamp: new Date().toISOString()
    };

    console.log('🎉 Tiingo yield update completed');
    console.log(`📊 Summary: ${successCount}/${etfs.length} ETFs updated successfully`);

    return new Response(
      JSON.stringify(summary),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('❌ Error in Tiingo yields function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});