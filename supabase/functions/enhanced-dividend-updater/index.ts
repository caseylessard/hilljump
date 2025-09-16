import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Helper function to extract underlying ticker from various formats
const extractUnderlyingTicker = (underlying: string): string | null => {
  if (!underlying) return null;
  
  // Handle formats like "Apple (AAPL)", "NVIDIA (NVDA)", "Tesla (TSLA)"
  const tickerMatch = underlying.match(/\(([A-Z]+)\)/);
  if (tickerMatch) {
    return tickerMatch[1];
  }
  
  // Handle formats like "Bitcoin (BTC)", "Ethereum (ETH)" - skip crypto
  if (underlying.toLowerCase().includes('bitcoin') || underlying.toLowerCase().includes('ethereum')) {
    return null;
  }
  
  // Handle complex cases like BATMMAAN basket - skip for now
  if (underlying.includes('Basket') || underlying.includes('stocks')) {
    return null;
  }
  
  return null;
};

// Helper function to fetch dividend data from Yahoo Finance
const fetchYahooDividends = async (ticker: string) => {
  try {
    console.log(`🔍 Fetching dividends for ${ticker} from Yahoo Finance`);
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?events=div&interval=1d&range=2y`);
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }
    
    const data = await response.json();
    const events = data?.chart?.result?.[0]?.events?.dividends;
    
    if (!events) {
      console.log(`📭 No dividends found for ${ticker}`);
      return [];
    }
    
    const dividends = Object.values(events).map((div: any) => ({
      amount: div.amount,
      date: new Date(div.date * 1000).toISOString().split('T')[0]
    }));
    
    console.log(`✅ Found ${dividends.length} dividends for ${ticker}`);
    return dividends;
  } catch (error) {
    console.error(`❌ Failed to fetch Yahoo dividends for ${ticker}:`, error);
    return [];
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Starting enhanced dividend updater...');

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
    console.log(`📝 Created update log: ${logId}`);

    // Fetch Canadian Purpose ETFs that need dividend mapping
    const { data: purposeETFs, error: purposeError } = await supabase
      .from('etfs')
      .select('ticker, underlying, name')
      .eq('active', true)
      .eq('provider_group', 'Purpose')
      .like('ticker', '%.NE');

    if (purposeError) {
      throw new Error(`Failed to fetch Purpose ETFs: ${purposeError.message}`);
    }

    console.log(`🎯 Found ${purposeETFs?.length || 0} Purpose ETFs to process`);

    let totalProcessed = 0;
    let totalInserted = 0;
    let totalErrors = 0;
    let successfulMappings = 0;

    // Process Purpose ETFs with underlying mapping
    if (purposeETFs && purposeETFs.length > 0) {
      for (const etf of purposeETFs) {
        try {
          totalProcessed++;
          console.log(`\n🔄 Processing ${etf.ticker} (${etf.name})`);
          console.log(`📋 Underlying: ${etf.underlying}`);
          
          const underlyingTicker = extractUnderlyingTicker(etf.underlying);
          
          if (!underlyingTicker) {
            console.log(`⚠️ Could not extract underlying ticker for ${etf.ticker}`);
            continue;
          }
          
          console.log(`🎯 Mapped ${etf.ticker} → ${underlyingTicker}`);
          
          // Fetch dividends for underlying US ticker
          const dividends = await fetchYahooDividends(underlyingTicker);
          
          if (dividends.length === 0) {
            console.log(`📭 No dividends found for underlying ${underlyingTicker}`);
            continue;
          }

          successfulMappings++;
          
          // Insert dividends with Canadian ETF ticker
          for (const dividend of dividends) {
            const { error: upsertError } = await supabase
              .from('dividends')
              .upsert({
                ticker: etf.ticker, // Use Canadian ticker
                amount: dividend.amount,
                ex_date: dividend.date,
                pay_date: null,
                cash_currency: 'USD', // Underlying dividends are in USD
                cadence: 'Monthly' // Most Purpose ETFs are monthly
              }, {
                onConflict: 'ticker,ex_date'
              });

            if (upsertError) {
              console.error(`❌ Failed to upsert dividend for ${etf.ticker}:`, upsertError);
              totalErrors++;
            } else {
              totalInserted++;
            }
          }
          
          console.log(`✅ Processed ${dividends.length} dividends for ${etf.ticker}`);
          
        } catch (error) {
          console.error(`❌ Error processing ${etf.ticker}:`, error);
          totalErrors++;
        }
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Also process regular ETFs (non-Purpose)
    console.log('\n📊 Processing regular ETFs...');
    
    const { data: regularETFs, error: regularError } = await supabase
      .from('etfs')
      .select('ticker')
      .eq('active', true)
      .not('provider_group', 'eq', 'Purpose')
      .limit(50); // Limit to avoid timeouts

    if (regularError) {
      console.log(`⚠️ Could not fetch regular ETFs: ${regularError.message}`);
    } else if (regularETFs && regularETFs.length > 0) {
      // Process regular ETFs in batches
      const batchSize = 10;
      for (let i = 0; i < regularETFs.length; i += batchSize) {
        const batch = regularETFs.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (etf) => {
          try {
            totalProcessed++;
            
            // Fetch dividends directly for regular tickers
            const dividends = await fetchYahooDividends(etf.ticker);
            
            if (dividends.length === 0) {
              return;
            }

            for (const dividend of dividends) {
              const { error: upsertError } = await supabase
                .from('dividends')
                .upsert({
                  ticker: etf.ticker,
                  amount: dividend.amount,
                  ex_date: dividend.date,
                  pay_date: null,
                  cash_currency: 'USD'
                }, {
                  onConflict: 'ticker,ex_date'
                });

              if (upsertError) {
                totalErrors++;
              } else {
                totalInserted++;
              }
            }
          } catch (error) {
            totalErrors++;
          }
        }));
      }
    }

    // Update log with completion
    if (logId) {
      await supabase
        .from('dividend_update_logs')
        .update({
          status: 'completed',
          end_time: new Date().toISOString(),
          total_etfs: totalProcessed,
          updated_etfs: successfulMappings,
          inserted_events: totalInserted
        })
        .eq('id', logId);
    }

    const result = {
      success: true,
      totalProcessed,
      totalInserted,
      totalErrors,
      successfulMappings,
      message: `Enhanced dividend update completed: ${totalProcessed} ETFs processed, ${successfulMappings} Purpose ETFs mapped, ${totalInserted} dividends inserted, ${totalErrors} errors`
    };

    console.log('\n🎉 Enhanced dividend update complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('💥 Enhanced dividend update failed:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});