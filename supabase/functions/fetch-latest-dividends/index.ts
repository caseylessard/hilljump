import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

async function fetchYahooDividends(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y&events=div`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }
    
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const events = result?.events?.dividends;
    
    if (!events) {
      return [];
    }
    
    // Convert Yahoo dividend events to our format
    return Object.values(events).map((div: any) => ({
      amount: div.amount,
      date: new Date(div.date * 1000).toISOString().split('T')[0]
    }));
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
          
          // Fetch dividends from Yahoo Finance
          const dividends = await fetchYahooDividends(etf.ticker);
          
          if (dividends.length === 0) {
            console.log(`No dividends found for ${etf.ticker}`);
            return;
          }

          // Use upsert instead of checking for duplicates to prevent constraint violations
          for (const dividend of dividends) {
            const { error: upsertError } = await supabase
              .from('dividends')
              .upsert({
                ticker: etf.ticker,
                amount: dividend.amount,
                ex_date: dividend.date,
                pay_date: null, // Yahoo doesn't provide pay date
                cash_currency: 'USD'
              }, {
                onConflict: 'ticker,ex_date'
              });

            if (upsertError) {
              console.error(`Failed to upsert dividend for ${etf.ticker}:`, upsertError);
              totalErrors++;
            } else {
              totalInserted++;
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