import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchEODHDPrice(symbol: string): Promise<number | null> {
  const apiKey = Deno.env.get('EODHD_API_KEY');
  if (!apiKey) return null;

  try {
    const url = `https://eodhd.com/api/real-time/${symbol}?api_token=${apiKey}&fmt=json`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.close && typeof data.close === 'number' && data.close > 0) {
      return data.close;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchPolygonPrice(symbol: string): Promise<number | null> {
  const apiKey = Deno.env.get('POLYGON_API_KEY');
  if (!apiKey) return null;

  try {
    const url = `https://api.polygon.io/v2/last/nbbo/${symbol}?apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.results?.P && typeof data.results.P === 'number' && data.results.P > 0) {
      return data.results.P;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchStooqPrice(symbol: string): Promise<number | null> {
  const tryFetch = async (s: string) => {
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(s)}&f=sd2t2ohlcv&h&e=csv`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const csv = await res.text();
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return null;
    const headers = lines[0].split(",");
    const values = lines[1].split(",");
    const iClose = headers.findIndex((h) => h.toLowerCase() === "close");
    if (iClose === -1) return null;
    const close = parseFloat(values[iClose]);
    return Number.isFinite(close) ? close : null;
  };

  return (await tryFetch(symbol.toLowerCase())) ?? (await tryFetch(symbol.toLowerCase() + ".us"));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting bulk price update...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all tickers with null current_price
    const { data: etfsWithoutPrices, error: fetchError } = await supabase
      .from('etfs')
      .select('ticker')
      .is('current_price', null);

    if (fetchError) {
      throw new Error(`Failed to fetch ETFs: ${fetchError.message}`);
    }

    const tickers = etfsWithoutPrices?.map(etf => etf.ticker) || [];
    console.log(`📊 Found ${tickers.length} tickers without prices`);

    if (tickers.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'All tickers already have prices',
        updated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const batchSize = 10; // Process in batches to avoid rate limits

    // Process tickers in batches
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      console.log(`📈 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(tickers.length/batchSize)}: ${batch.join(', ')}`);

      await Promise.all(batch.map(async (ticker) => {
        try {
          let price: number | null = null;

          // Determine which API to use based on ticker format
          if (ticker.endsWith('.TO') || ticker.endsWith('.CN') || ticker.endsWith('.VN')) {
            // Canadian/International - use EODHD
            price = await fetchEODHDPrice(ticker);
          } else {
            // US ticker - try Polygon first, then Stooq
            price = await fetchPolygonPrice(ticker);
            if (!price) {
              price = await fetchStooqPrice(ticker);
            }
          }

          if (price && price > 0) {
            // Update database
            const { error: updateError } = await supabase
              .from('etfs')
              .update({
                current_price: price,
                price_updated_at: new Date().toISOString()
              })
              .eq('ticker', ticker);

            if (updateError) {
              console.error(`❌ Failed to update ${ticker}: ${updateError.message}`);
              errorCount++;
            } else {
              console.log(`✅ Updated ${ticker}: $${price}`);
              successCount++;
            }
          } else {
            console.log(`⚠️ No price found for ${ticker}`);
            errorCount++;
          }
        } catch (error) {
          console.error(`💥 Error processing ${ticker}:`, error);
          errorCount++;
        }
      }));

      // Rate limiting - wait between batches
      if (i + batchSize < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between batches
      }
    }

    const result = {
      success: true,
      total: tickers.length,
      updated: successCount,
      errors: errorCount,
      message: `Updated ${successCount} prices, ${errorCount} errors`
    };

    console.log(`🎉 Bulk update complete: ${JSON.stringify(result)}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Bulk price update failed:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Bulk price update failed',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});