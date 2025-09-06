import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Helper function to fetch dividend data from Yahoo Finance
const fetchYahooDividends = async (ticker: string) => {
  try {
    const cleanTicker = ticker.replace('.TO', '.TRT').replace('.NE', '.NEO');
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${cleanTicker}?events=div&interval=1d&range=2y`);
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }
    
    const data = await response.json();
    const events = data?.chart?.result?.[0]?.events?.dividends;
    
    if (!events) return [];
    
    return Object.values(events).map((div: any) => ({
      amount: div.amount,
      date: new Date(div.date * 1000).toISOString().split('T')[0]
    }));
  } catch (error) {
    console.error(`Failed to fetch Yahoo dividends for ${ticker}:`, error);
    return [];
  }
};

// Helper function to fetch dividend data from Alpha Vantage
const fetchAlphaVantageDividends = async (ticker: string) => {
  const apiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
  if (!apiKey) return [];
  
  try {
    const cleanTicker = ticker.replace('.TO', '').replace('.NE', '');
    const response = await fetch(`https://www.alphavantage.co/query?function=DIVIDENDS&symbol=${cleanTicker}&apikey=${apiKey}`);
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }
    
    const data = await response.json();
    const dividends = data?.data || [];
    
    return dividends.map((div: any) => ({
      amount: parseFloat(div.amount),
      date: div.ex_dividend_date
    }));
  } catch (error) {
    console.error(`Failed to fetch Alpha Vantage dividends for ${ticker}:`, error);
    return [];
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Starting comprehensive dividend updater...');

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('✅ Supabase client initialized');

    // Create update log
    const { data: logData, error: logError } = await supabase
      .from('dividend_update_logs')
      .insert({
        status: 'running',
        start_time: new Date().toISOString()
      })
      .select()
      .single();

    const logId = logData?.id;

    // Fetch all active ETFs
    const { data: etfs, error: etfError } = await supabase
      .from('etfs')
      .select('ticker')
      .eq('active', true);

    if (etfError) {
      throw new Error(`Failed to fetch ETFs: ${etfError.message}`);
    }

    console.log(`📊 Processing ${etfs?.length || 0} ETFs...`);

    let totalInserted = 0;
    let totalUpdated = 0;
    const batchSize = 10;

    // Process ETFs in batches
    for (let i = 0; i < (etfs?.length || 0); i += batchSize) {
      const batch = etfs?.slice(i, i + batchSize) || [];
      
      for (const etf of batch) {
        console.log(`🔍 Processing ${etf.ticker}...`);
        
        try {
          // Try Yahoo Finance first, then Alpha Vantage as fallback
          let dividends = await fetchYahooDividends(etf.ticker);
          
          if (dividends.length === 0) {
            console.log(`📈 Trying Alpha Vantage for ${etf.ticker}...`);
            dividends = await fetchAlphaVantageDividends(etf.ticker);
          }

          // Insert/update dividends
          for (const dividend of dividends) {
            const { error: insertError } = await supabase
              .from('dividends')
              .upsert({
                ticker: etf.ticker,
                amount: dividend.amount,
                ex_date: dividend.date,
                cash_currency: 'USD'
              }, {
                onConflict: 'ticker,ex_date'
              });

            if (!insertError) {
              totalInserted++;
            }
          }

          if (dividends.length > 0) {
            console.log(`✅ ${etf.ticker}: ${dividends.length} dividends processed`);
            totalUpdated++;
          }

        } catch (error) {
          console.error(`❌ Error processing ${etf.ticker}:`, error);
        }
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Update log with completion
    if (logId) {
      await supabase
        .from('dividend_update_logs')
        .update({
          status: 'completed',
          total_etfs: etfs?.length || 0,
          updated_etfs: totalUpdated,
          inserted_events: totalInserted,
          end_time: new Date().toISOString()
        })
        .eq('id', logId);
    }

    const result = {
      success: true,
      message: `Successfully updated dividend data for ${totalUpdated} ETFs`,
      inserted_events: totalInserted,
      updated_etfs: totalUpdated,
      total_etfs: etfs?.length || 0
    };

    console.log('🎉 Update completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('💥 Error in dividend updater:', error);
    
    const errorResult = {
      success: false,
      error: error.message || 'Unknown error occurred',
      message: 'Failed to update dividend data'
    };

    return new Response(JSON.stringify(errorResult), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});