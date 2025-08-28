// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

async function fetchYahooFinancePrice(symbol: string): Promise<number | null> {
  try {
    // Yahoo Finance uses different suffixes - normalize for better compatibility
    let yahooSymbol = symbol;
    
    // Handle Canadian exchanges
    if (symbol.endsWith('.NE')) {
      yahooSymbol = symbol; // NEO Exchange - Yahoo uses .NE
    } else if (symbol.endsWith('.TO')) {
      yahooSymbol = symbol; // Toronto Stock Exchange - Yahoo uses .TO
    } else if (symbol.endsWith('.CN')) {
      yahooSymbol = symbol; // Canadian National Stock Exchange
    } else if (symbol.endsWith('.VN')) {
      yahooSymbol = symbol.replace('.VN', '.V'); // TSX Venture - Yahoo uses .V
    }
    // US tickers don't need suffix modification

    // Use Yahoo Finance v8 API (free, no key required, no rate limits)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`;
    console.log(`Fetching Yahoo Finance price for: ${yahooSymbol}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`Yahoo Finance API error for ${yahooSymbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data?.chart?.result?.[0]?.meta?.regularMarketPrice) {
      const price = data.chart.result[0].meta.regularMarketPrice;
      if (typeof price === 'number' && price > 0) {
        console.log(`✅ Yahoo Finance ${yahooSymbol}: $${price}`);
        return price;
      }
    }

    console.warn(`Invalid Yahoo Finance data for ${yahooSymbol}:`, data?.chart?.error || 'No price data');
    return null;
  } catch (error) {
    console.error(`Yahoo Finance fetch error for ${symbol}:`, error);
    return null;
  }
}

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
    console.warn('EODHD_API_KEY not found, falling back to Yahoo Finance');
    return fetchYahooFinancePrice(symbol);
  }

  try {
    // Format symbol for EODHD
    let eodhSymbol = symbol;
    if (symbol.endsWith('.TO')) {
      eodhSymbol = symbol; // EODHD uses .TO format directly
    } else if (symbol.endsWith('.NE')) {
      // NEO Exchange - try .TO format for EODHD
      eodhSymbol = symbol.replace('.NE', '.TO');
    } else if (symbol.endsWith('.VN')) {
      // TSX Venture - try .V format for EODHD  
      eodhSymbol = symbol.replace('.VN', '.V');
    } else if (!symbol.includes('.')) {
      // US tickers - add .US suffix for EODHD
      eodhSymbol = `${symbol}.US`;
    }

    const url = `https://eodhd.com/api/real-time/${eodhSymbol}?api_token=${apiKey}&fmt=json`;
    console.log(`🎯 EODHD fetching: ${eodhSymbol}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`⚠️ EODHD API error for ${eodhSymbol}: ${response.status}, falling back to Yahoo`);
      return fetchYahooFinancePrice(symbol);
    }

    const data = await response.json();
    
    // EODHD returns different field names based on market status
    const price = data.close || data.price || data.regularMarketPrice;
    
    if (price && typeof price === 'number' && price > 0) {
      console.log(`✅ EODHD ${eodhSymbol}: $${price}`);
      return price;
    }

    console.warn(`⚠️ Invalid EODHD data for ${eodhSymbol}, falling back to Yahoo:`, data);
    return fetchYahooFinancePrice(symbol);
  } catch (error) {
    console.error(`❌ EODHD fetch error for ${symbol}, falling back to Yahoo:`, error);
    return fetchYahooFinancePrice(symbol);
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
    
    // Fetch all prices - EODHD FIRST (most reliable with subscription)
    await Promise.all(
      tickers.map(async (t: string) => {
        const sym = String(t || "").toUpperCase();
        if (!sym) return;
        
        // Priority 1: EODHD (professional data with subscription)
        let p: number | null = await fetchEODHDPrice(sym);
        
        // Priority 2: Yahoo Finance fallback
        if (p == null) {
          p = await fetchYahooFinancePrice(sym);
        }
        
        // Priority 3: Stooq final fallback
        if (p == null) {
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

        // Update both ETF table and price cache
        const updatePromises = Object.entries(prices).map(async ([ticker, price]) => {
          // Update main ETF table
          const { error: etfError } = await supabase
            .from('etfs')
            .update({ 
              current_price: price,
              price_updated_at: new Date().toISOString()
            })
            .eq('ticker', ticker);
          
          if (etfError) {
            console.error(`Failed to update ETF price for ${ticker}:`, etfError);
          } else {
            console.log(`✅ Updated ${ticker} price in ETF table: $${price}`);
          }

          // Update price cache table (upsert)
          const { error: cacheError } = await supabase
            .from('price_cache')
            .upsert({
              ticker,
              price,
              source: 'eodhd_primary',
              updated_at: new Date().toISOString()
            }, { 
              onConflict: 'ticker' 
            });
          
          if (cacheError) {
            console.error(`Failed to update price cache for ${ticker}:`, cacheError);
          }
        });

        await Promise.all(updatePromises);
        console.log(`📊 Updated ${Object.keys(prices).length} prices in database and cache`);
        
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
