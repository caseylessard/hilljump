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
    console.log('🔄 Starting Yahoo Finance yield update process');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      const missingVars = [];
      if (!supabaseUrl) missingVars.push('SUPABASE_URL');
      if (!supabaseKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
      
      console.error(`❌ Missing environment variables: ${missingVars.join(', ')}`);
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get active ETFs
    console.log('📊 Fetching active ETFs...');
    const { data: etfs, error: etfError } = await supabase
      .from('etfs')
      .select('ticker')
      .eq('active', true);

    if (etfError) {
      console.error('❌ Error fetching ETFs:', etfError);
      throw new Error(`Failed to fetch ETFs: ${etfError.message}`);
    }

    console.log(`📈 Found ${etfs?.length || 0} active ETFs to process`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process ETFs in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < (etfs?.length || 0); i += batchSize) {
      const batch = etfs!.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} ETFs)`);

      const promises = batch.map(async (etf) => {
        try {
          // Fetch yield data from Yahoo Finance
          const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${etf.ticker}?modules=summaryDetail`;
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (!response.ok) {
            console.warn(`⚠️ Yahoo Finance API error for ${etf.ticker}: ${response.status}`);
            return { ticker: etf.ticker, success: false, error: `API error: ${response.status}` };
          }

          const data = await response.json();
          
          // Extract yield data from Yahoo Finance response
          const summaryDetail = data?.quoteSummary?.result?.[0]?.summaryDetail;
          let divYield = null;
          
          if (summaryDetail?.dividendYield?.raw && typeof summaryDetail.dividendYield.raw === 'number') {
            // Convert from decimal to percentage (e.g., 0.05 -> 5.0)
            divYield = summaryDetail.dividendYield.raw * 100;
          }

          // Update ETF with yield data
          if (divYield !== null) {
            const { error: updateError } = await supabase
              .from('etfs')
              .update({
                yield_ttm: divYield,
                price_updated_at: new Date().toISOString()
              })
              .eq('ticker', etf.ticker);

            if (updateError) {
              console.error(`❌ Database update error for ${etf.ticker}:`, updateError);
              return { ticker: etf.ticker, success: false, error: updateError.message };
            }

            console.log(`✅ Updated ${etf.ticker} with yield: ${divYield.toFixed(2)}%`);
            return { ticker: etf.ticker, success: true, yield: divYield };
          } else {
            console.warn(`⚠️ No yield data found for ${etf.ticker}`);
            return { ticker: etf.ticker, success: false, error: 'No yield data available' };
          }
        } catch (error: any) {
          console.error(`❌ Error processing ${etf.ticker}:`, error);
          return { ticker: etf.ticker, success: false, error: error.message };
        }
      });

      const batchResults = await Promise.all(promises);
      
      // Count results
      batchResults.forEach(result => {
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          errors.push(`${result.ticker}: ${result.error}`);
        }
      });

      // Rate limiting delay between batches
      if (i + batchSize < (etfs?.length || 0)) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const result = {
      success: true,
      message: 'Yahoo Finance yield update completed',
      timestamp: new Date().toISOString(),
      summary: {
        totalETFs: etfs?.length || 0,
        successCount,
        errorCount,
        errors: errors.slice(0, 10) // Limit error list
      }
    };

    console.log('🎉 Yahoo Finance yield update process completed');
    console.log(`📊 Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: any) {
    console.error('❌ Error in Yahoo Finance yields function:', error);
    
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