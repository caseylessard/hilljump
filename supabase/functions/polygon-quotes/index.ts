// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Removed POLYGON_API_KEY - now using Yahoo Finance

async function fetchStooqPrice(symbol: string): Promise<number | null> {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol.toLowerCase())}&f=sd2t2ohlcv&h&e=csv`;
  console.log(`Stooq request for: ${symbol}`);
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
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { tickers, include28d, includeDRIP, region } = await req.json();
    if (!Array.isArray(tickers)) throw new Error("tickers must be an array");
    
    const symbols: string[] = [...new Set(tickers.map((t: any) => String(t || "").toUpperCase()).filter(Boolean))];
    console.log(`Processing ${symbols.length} symbols`);
    
    // Separate Canadian and US symbols
    const canadianSymbols = symbols.filter(s => s.includes('.TO'));
    const usSymbols = symbols.filter(s => !s.includes('.TO'));
    
    console.log(`US symbols (${usSymbols.length}): ${usSymbols.slice(0, 5).join(', ')}`);
    console.log(`Canadian symbols (${canadianSymbols.length}): ${canadianSymbols.slice(0, 5).join(', ')}`);
    
    const results: Record<string, any> = {};
    
    // Handle US symbols with Yahoo Finance first, then Stooq fallback
    if (usSymbols.length > 0) {
      console.log("Using Yahoo Finance for US symbols");
      try {
        // Process US symbols with Yahoo Finance
        for (const symbol of usSymbols) {
          try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
            const res = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });
            
            if (res.ok) {
              const data = await res.json();
              const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
              
              if (typeof price === 'number' && price > 0) {
                results[symbol] = { price };
                console.log(`Yahoo Finance: ${symbol} = $${price}`);
              }
            }
          } catch (err) {
            console.warn(`Yahoo Finance failed for ${symbol}:`, err);
          }
        }
        
        console.log(`Yahoo Finance returned data for ${Object.keys(results).filter(k => usSymbols.includes(k)).length} US symbols`);
      } catch (err) {
        console.error("Yahoo Finance failed, falling back to Stooq for US:", err);
      }
      
      // Use Stooq for any missing US symbols
      const missingUS = usSymbols.filter(s => !results[s]);
      if (missingUS.length > 0) {
        console.log(`Using Stooq for ${missingUS.length} US symbols`);
        for (const symbol of missingUS) {
          const price = await fetchStooqPrice(symbol);
          if (price !== null) {
            results[symbol] = { price };
            console.log(`Stooq: ${symbol} = $${price}`);
          }
        }
      }
    }
    
    // Handle Canadian symbols with original quotes endpoint
    if (canadianSymbols.length > 0) {
      console.log(`Using quotes endpoint for ${canadianSymbols.length} Canadian symbols`);
      try {
        const quotesResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/quotes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`
          },
          body: JSON.stringify({ tickers: canadianSymbols })
        });
        
        if (quotesResponse.ok) {
          const quotesData = await quotesResponse.json();
          if (quotesData?.prices) {
            console.log(`Found ${Object.keys(quotesData.prices).length} Canadian prices`);
            for (const [symbol, price] of Object.entries(quotesData.prices)) {
              if (Number.isFinite(price)) {
                results[symbol] = { price: price as number };
                console.log(`Quotes: ${symbol} = $${price}`);
              }
            }
          }
        } else {
          console.error(`Quotes endpoint failed: ${quotesResponse.status}`);
        }
      } catch (err) {
        console.error("Quotes endpoint error:", err);
      }
    }
    
    
    console.log(`Final results: ${Object.keys(results).length} symbols`);
    
    // Update database with fetched prices if we have valid prices
    if (Object.keys(results).length > 0) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SERVICE_ROLE) {
          const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
          const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
          
          // Update both ETF table and price cache
          const priceUpdates = Object.entries(results).map(async ([ticker, priceData]) => {
            const price = priceData.price;
            if (price > 0) {
              // Update main ETF table
              const { error: etfError } = await sb
                .from('etfs')
                .update({ 
                  current_price: price,
                  price_updated_at: new Date().toISOString()
                })
                .eq('ticker', ticker);
              
              if (etfError) {
                console.error(`Failed to update ETF price for ${ticker}:`, etfError);
              }

              // Update price cache table (upsert)
              const { error: cacheError } = await sb
                .from('price_cache')
                .upsert({
                  ticker,
                  price,
                  source: 'polygon_live',
                  updated_at: new Date().toISOString()
                }, { 
                  onConflict: 'ticker' 
                });
              
              if (cacheError) {
                console.error(`Failed to update price cache for ${ticker}:`, cacheError);
              } else {
                console.log(`✅ Updated ${ticker} in database and cache: $${price}`);
              }
            }
          });

          await Promise.all(priceUpdates);
          console.log(`📊 Updated ${Object.keys(results).length} prices in database and cache`);
        }
      } catch (dbError) {
        console.error('Database update error:', dbError);
      }
    }
    
    // Add enrichment for 28d and DRIP if requested
    if ((include28d || includeDRIP) && Object.keys(results).length > 0) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SERVICE_ROLE) {
          const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
          const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
          
          // Fetch recent dividends for enrichment
          const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
          const sinceISO = since.toISOString().slice(0, 10);
          const { data: rows, error } = await sb
            .from("dividends")
            .select("ticker, amount, pay_date, ex_date")
            .in("ticker", Object.keys(results))
            .or(`pay_date.gte.${sinceISO},ex_date.gte.${sinceISO}`);
            
          if (!error && rows) {
            const divSums: Record<string, number> = {};
            for (const r of rows) {
              const sym = r.ticker as string;
              const amt = Number(r.amount) || 0;
              if (!divSums[sym]) divSums[sym] = 0;
              divSums[sym] += amt;
            }
            
            const netDivFactor = region === 'US' ? 1 : 0.85;
            
            // Add dividend data to results
            for (const [symbol, priceData] of Object.entries(results)) {
              const dividends = (divSums[symbol] || 0) * netDivFactor;
              if (include28d && dividends > 0) {
                results[symbol].dividends28d = dividends;
                results[symbol].dividends28dReturnPercent = (dividends / priceData.price) * 100;
              }
              if (includeDRIP && dividends > 0) {
                results[symbol].drip4wDollar = dividends;
                results[symbol].drip4wPercent = (dividends / priceData.price) * 100;
              }
            }
          }
        }
      } catch (enrichmentError) {
        console.error("Enrichment failed:", enrichmentError);
      }
    }
    
    return new Response(JSON.stringify({ prices: results }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
    
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});