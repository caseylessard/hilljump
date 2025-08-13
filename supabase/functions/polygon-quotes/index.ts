// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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

  // Try raw symbol first, then with .us suffix for US stocks
  const baseSymbol = symbol.toLowerCase();
  let price = await tryFetch(baseSymbol);
  
  // If Canadian (.to) symbol failed, try without .to
  if (price === null && baseSymbol.includes('.to')) {
    price = await tryFetch(baseSymbol.replace('.to', ''));
  }
  
  // If US symbol failed, try with .us suffix
  if (price === null && !baseSymbol.includes('.to') && !baseSymbol.includes('.us')) {
    price = await tryFetch(baseSymbol + '.us');
  }
  
  return price;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { tickers, include28d, includeDRIP, region } = await req.json();
    if (!Array.isArray(tickers)) throw new Error("tickers must be an array");
    
    const symbols: string[] = [...new Set(tickers.map((t: any) => String(t || "").toUpperCase()).filter(Boolean))];
    console.log(`Processing ${symbols.length} symbols using Stooq:`, symbols.slice(0, 10));
    
    const results: Record<string, any> = {};
    
    // Process symbols in batches to avoid overwhelming Stooq
    const batchSize = 10;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}: ${batch.join(', ')}`);
      
      await Promise.all(
        batch.map(async (symbol) => {
          try {
            const price = await fetchStooqPrice(symbol);
            if (price !== null) {
              results[symbol] = {
                price,
                prevClose: undefined,
                change: undefined,
                changePercent: undefined,
              };
              console.log(`Stooq: ${symbol} = $${price}`);
            } else {
              console.log(`Stooq: No data for ${symbol}`);
            }
          } catch (err) {
            console.error(`Error fetching ${symbol}:`, err);
          }
        })
      );
      
      // Small delay between batches to be respectful to Stooq
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`Successfully fetched ${Object.keys(results).length} prices using Stooq`);
    
    // Add enrichment for 28d and DRIP if requested
    if (include28d || includeDRIP) {
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