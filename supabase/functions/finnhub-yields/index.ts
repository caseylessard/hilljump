import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FinnhubMetrics {
  dividendYieldTTM?: number;
  dividendYieldIndicatedAnnual?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const finnhubApiKey = Deno.env.get('FINNHUB_API_KEY');
    if (!finnhubApiKey) {
      throw new Error('FINNHUB_API_KEY not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Starting Finnhub yield update process');

    // Check if we've already run today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const { data: existingLog } = await supabase
      .from('daily_update_logs')
      .select('id')
      .eq('run_date', today)
      .eq('status', 'completed')
      .maybeSingle();

    if (existingLog) {
      console.log(`✅ Yield update already completed today (${today})`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Yield update already completed today (${today})`,
          skipped: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new log entry
    const { data: logEntry, error: logError } = await supabase
      .from('daily_update_logs')
      .insert({
        run_date: today,
        status: 'running',
        start_time: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      throw new Error(`Failed to create log entry: ${logError.message}`);
    }

    console.log(`📊 Created log entry: ${logEntry.id}`);

    // Fetch active ETFs that need yield updates
    const { data: etfs, error: etfError } = await supabase
      .from('etfs')
      .select('ticker, name')
      .eq('active', true)
      .order('ticker');

    if (etfError) {
      throw new Error(`Failed to fetch ETFs: ${etfError.message}`);
    }

    console.log(`📈 Found ${etfs.length} active ETFs to update`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    // Process in batches of 30 with 1-minute delays
    const batchSize = 30;
    const batches = [];
    
    for (let i = 0; i < etfs.length; i += batchSize) {
      batches.push(etfs.slice(i, i + batchSize));
    }

    console.log(`🔄 Processing ${batches.length} batches of up to ${batchSize} ETFs each`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} ETFs)`);

      // Process each ticker in the current batch
      for (const etf of batch) {
        try {
          console.log(`🔍 Fetching yield data for ${etf.ticker}`);
          
          const finnhubUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${etf.ticker}&metric=all&token=${finnhubApiKey}`;
          
          const response = await fetch(finnhubUrl);
          
          if (!response.ok) {
            throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          const metrics = data.metric as FinnhubMetrics;
          
          if (metrics && (metrics.dividendYieldTTM !== undefined || metrics.dividendYieldIndicatedAnnual !== undefined)) {
            // Use TTM yield first, fall back to indicated annual yield
            const yieldValue = metrics.dividendYieldTTM || metrics.dividendYieldIndicatedAnnual;
            
            if (yieldValue !== null && yieldValue !== undefined && yieldValue > 0) {
              // Convert from decimal to percentage (Finnhub returns decimal, we store percentage)
              const yieldPercent = yieldValue * 100;
              
              // Update the ETF yield in database
              const { error: updateError } = await supabase
                .from('etfs')
                .update({ 
                  yield_ttm: yieldPercent,
                  price_updated_at: new Date().toISOString()
                })
                .eq('ticker', etf.ticker);

              if (updateError) {
                throw new Error(`Failed to update ${etf.ticker}: ${updateError.message}`);
              }

              console.log(`✅ Updated ${etf.ticker}: ${yieldPercent.toFixed(2)}% yield`);
              successCount++;
            } else {
              console.log(`⚠️ ${etf.ticker}: No valid yield data (${yieldValue})`);
            }
          } else {
            console.log(`⚠️ ${etf.ticker}: No yield metrics in response`);
          }
          
          // Small delay between individual API calls to be respectful
          await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
          
        } catch (error) {
          console.error(`❌ Error processing ${etf.ticker}:`, error);
          errors.push(`${etf.ticker}: ${error.message}`);
          errorCount++;
        }
      }

      // Wait 1 minute between batches (except for the last batch)
      if (batchIndex < batches.length - 1) {
        console.log(`⏱️ Waiting 60 seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 60000)); // 60 seconds
      }
    }

    // Update log entry with completion status
    const { error: logUpdateError } = await supabase
      .from('daily_update_logs')
      .update({
        status: 'completed',
        end_time: new Date().toISOString(),
        total_etfs: etfs.length,
        updated_etfs: successCount,
        error_message: errors.length > 0 ? errors.slice(0, 10).join('; ') : null // Store first 10 errors
      })
      .eq('id', logEntry.id);

    if (logUpdateError) {
      console.error('Failed to update log entry:', logUpdateError);
    }

    const summary = {
      success: true,
      date: today,
      totalETFs: etfs.length,
      successCount,
      errorCount,
      batches: batches.length,
      errors: errors.slice(0, 5), // Return first 5 errors in response
      message: `Processed ${etfs.length} ETFs in ${batches.length} batches. ${successCount} successful, ${errorCount} failed.`
    };

    console.log('✅ Finnhub yield update completed:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Finnhub yield update failed:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
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