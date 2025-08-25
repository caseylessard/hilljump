// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

async function fetchCanadianPrice(symbol: string): Promise<number | null> {
  const alphaVantageKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
  if (!alphaVantageKey) {
    console.warn('Alpha Vantage API key not found, falling back to Stooq');
    return fetchStooqPrice(symbol);
  }

  try {
    // Convert symbol to Alpha Vantage format - they use .TRT or .TO for TSX
    let avSymbol = symbol;
    if (symbol.endsWith('.NE')) {
      // Try converting NEO to Toronto format
      avSymbol = symbol.replace('.NE', '.TRT');
    } else if (symbol.endsWith('.TO')) {
      avSymbol = symbol.replace('.TO', '.TRT');
    }

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${avSymbol}&apikey=${alphaVantageKey}`;
    console.log(`Fetching Alpha Vantage price for: ${avSymbol}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Alpha Vantage API error for ${avSymbol}: ${response.status}`);
      return fetchStooqPrice(symbol);
    }

    const data = await response.json();
    
    if (data['Global Quote'] && data['Global Quote']['05. price']) {
      const price = parseFloat(data['Global Quote']['05. price']);
      if (price > 0) {
        console.log(`✅ Alpha Vantage ${avSymbol}: $${price}`);
        return price;
      }
    }

    console.warn(`Invalid Alpha Vantage data for ${avSymbol}:`, data);
    return fetchStooqPrice(symbol);
  } catch (error) {
    console.error(`Alpha Vantage fetch error for ${symbol}:`, error);
    return fetchStooqPrice(symbol);
  }
}

async function fetchEODHDPrice(symbol: string): Promise<number | null> {
  const apiKey = Deno.env.get('EODHD_API_KEY');
  if (!apiKey) {
    console.warn('EODHD_API_KEY not found, falling back to Stooq');
    return fetchStooqPrice(symbol);
  }

  try {
    // For Canadian tickers, convert to appropriate EODHD format
    let eodhSymbol = symbol;
    if (symbol.endsWith('.TO')) {
      eodhSymbol = symbol; // EODHD uses .TO format directly
    } else if (symbol.endsWith('.NE')) {
      // NEO Exchange tickers - try .TO format first for EODHD
      eodhSymbol = symbol.replace('.NE', '.TO');
    }

    const url = `https://eodhd.com/api/real-time/${eodhSymbol}?api_token=${apiKey}&fmt=json`;
    console.log(`Fetching EODHD price for: ${eodhSymbol}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`EODHD API error for ${eodhSymbol}: ${response.status}`);
      return fetchStooqPrice(symbol);
    }

    const data = await response.json();
    
    if (data.close && typeof data.close === 'number' && data.close > 0) {
      console.log(`✅ EODHD ${eodhSymbol}: $${data.close}`);
      return data.close;
    }

    console.warn(`Invalid EODHD data for ${eodhSymbol}:`, data);
    return fetchStooqPrice(symbol);
  } catch (error) {
    console.error(`EODHD fetch error for ${symbol}:`, error);
    return fetchStooqPrice(symbol);
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

  // try raw, then .us suffix
  return (await tryFetch(symbol.toLowerCase())) ?? (await tryFetch(symbol.toLowerCase() + ".us"));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors() });
  }
  try {
    const { tickers } = await req.json();
    if (!Array.isArray(tickers)) throw new Error("tickers must be an array");
    
    const prices: Record<string, number> = {};
    
    // Fetch all prices first
    await Promise.all(
      tickers.map(async (t: string) => {
        const sym = String(t || "").toUpperCase();
        if (!sym) return;
        
        // Use Alpha Vantage for Canadian tickers, Stooq for others
        let p: number | null = null;
        if (sym.endsWith('.TO') || sym.endsWith('.CN') || sym.endsWith('.VN') || sym.endsWith('.NE')) {
          p = await fetchCanadianPrice(sym);
        } else {
          p = await fetchStooqPrice(sym);
        }
        
        if (p != null) prices[sym] = p;
      })
    );

    // Update database with fetched prices
    if (Object.keys(prices).length > 0) {
      try {
        // Import Supabase client for database updates
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.54.0');
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Update prices in database
        const updatePromises = Object.entries(prices).map(async ([ticker, price]) => {
          const { error } = await supabase
            .from('etfs')
            .update({ 
              current_price: price,
              price_updated_at: new Date().toISOString()
            })
            .eq('ticker', ticker);
          
          if (error) {
            console.error(`Failed to update price for ${ticker}:`, error);
          } else {
            console.log(`✅ Updated ${ticker} price in database: $${price}`);
          }
        });

        await Promise.all(updatePromises);
        console.log(`📊 Updated ${Object.keys(prices).length} prices in database`);
        
      } catch (dbError) {
        console.error('Database update error:', dbError);
        // Continue anyway - return the prices even if database update fails
      }
    }

    return json({ prices });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 400);
  }
});

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors() } });
}
