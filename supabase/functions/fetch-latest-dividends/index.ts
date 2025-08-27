import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

async function fetchPolygonDividends(ticker: string) {
  if (!POLYGON_API_KEY) {
    throw new Error('POLYGON_API_KEY not configured');
  }

  const url = `https://api.polygon.io/v3/reference/dividends?ticker=${ticker}&limit=10&apikey=${POLYGON_API_KEY}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Polygon API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`Failed to fetch dividends for ${ticker}:`, error);
    return [];
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting dividend fetch process...');

    // Get all ETF tickers
    const { data: etfs, error: etfsError } = await supabase
      .from('etfs')
      .select('ticker')
      .eq('active', true)
      .order('ticker');

    if (etfsError) {
      throw new Error(`Failed to fetch ETFs: ${etfsError.message}`);
    }

    console.log(`Found ${etfs?.length || 0} active ETFs`);

    let totalProcessed = 0;
    let totalInserted = 0;
    let totalErrors = 0;

    // Process ETFs in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < (etfs?.length || 0); i += batchSize) {
      const batch = etfs!.slice(i, i + batchSize);
      
      // Process batch in parallel
      await Promise.all(batch.map(async (etf) => {
        try {
          totalProcessed++;
          
          // Fetch dividends from Polygon
          const dividends = await fetchPolygonDividends(etf.ticker);
          
          if (dividends.length === 0) {
            console.log(`No dividends found for ${etf.ticker}`);
            return;
          }

          // Check existing dividends to avoid duplicates
          const { data: existing } = await supabase
            .from('dividends')
            .select('ex_date, amount')
            .eq('ticker', etf.ticker)
            .order('ex_date', { ascending: false })
            .limit(10);

          const existingKey = (existing || []).map(d => `${d.ex_date}-${d.amount}`);

          // Insert new dividends
          for (const dividend of dividends) {
            const key = `${dividend.ex_dividend_date}-${dividend.cash_amount}`;
            
            if (!existingKey.includes(key)) {
              const { error: insertError } = await supabase
                .from('dividends')
                .insert({
                  ticker: etf.ticker,
                  amount: dividend.cash_amount,
                  ex_date: dividend.ex_dividend_date,
                  pay_date: dividend.pay_date || null,
                  cash_currency: dividend.currency || 'USD'
                });

              if (insertError) {
                console.error(`Failed to insert dividend for ${etf.ticker}:`, insertError);
                totalErrors++;
              } else {
                totalInserted++;
              }
            }
          }
        } catch (error) {
          console.error(`Error processing ${etf.ticker}:`, error);
          totalErrors++;
        }
      }));

      // Rate limiting delay between batches
      if (i + batchSize < (etfs?.length || 0)) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const result = {
      success: true,
      totalProcessed,
      totalInserted,
      totalErrors,
      message: `Processed ${totalProcessed} ETFs, inserted ${totalInserted} new dividends, ${totalErrors} errors`
    };

    console.log('Dividend fetch complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Dividend fetch failed:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});