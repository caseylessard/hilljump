
// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const POLYGON_API_KEY = Deno.env.get("POLYGON_API_KEY");
const TWELVEDATA_API_KEY = Deno.env.get("TWELVEDATA_API_KEY");

type PriceResult = { price: number; prevClose?: number; change?: number; changePercent?: number };

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tickers, include28d } = await req.json();
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return json({ error: "tickers must be a non-empty array" }, 400);
    }

    const symbols: string[] = [...new Set(tickers.map((t: any) => String(t || "").toUpperCase()).filter(Boolean))];

    // Helper to chunk arrays
    const chunk = <T,>(arr: T[], size: number) => arr.reduce<T[][]>((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);

    const results: Record<string, PriceResult & {
      price28dStart?: number;
      change28dPercent?: number;
      dividends28d?: number;
      dividends28dReturnPercent?: number;
      totalReturn28dPercent?: number;
    }> = {};

    let providerUsed: 'polygon' | 'twelvedata' | 'none' = 'none';

    // Preferred: Polygon snapshot endpoint (with upgraded plan)
    if (POLYGON_API_KEY) {
      try {
        const chunks = chunk(symbols, 50);
        for (const group of chunks) {
          const url = new URL("https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers");
          url.searchParams.set("tickers", group.join(","));
          url.searchParams.set("apiKey", POLYGON_API_KEY);

          const res = await fetch(url.toString());
          if (!res.ok) {
            const text = await res.text();
            console.error(`Polygon error ${res.status}: ${text}`);
            throw new Error(`Polygon error ${res.status}: ${text}`);
          }
          const data = await res.json();
          const list = Array.isArray((data as any)?.tickers) ? (data as any).tickers : [];

          for (const item of list) {
            const sym = item?.ticker as string;
            const lastPrice = Number(item?.lastTrade?.p ?? item?.day?.c ?? item?.min?.c);
            const prevClose = Number(item?.prevDay?.c ?? item?.day?.o);
            const price = Number.isFinite(lastPrice) ? lastPrice : undefined;
            if (!sym || !Number.isFinite(price)) continue;
            const change = Number.isFinite(prevClose) ? price - prevClose : undefined;
            const changePercent = Number.isFinite(prevClose) && prevClose !== 0 ? (change! / prevClose) * 100 : undefined;
            results[sym] = {
              price: price!,
              prevClose: Number.isFinite(prevClose) ? prevClose : undefined,
              change: Number.isFinite(change) ? change : undefined,
              changePercent: Number.isFinite(changePercent) ? changePercent : undefined,
            };
          }
        }
        providerUsed = 'polygon';
      } catch (polygonError) {
        console.error("Polygon API failed, falling back to Twelve Data:", polygonError);
        // Clear results and continue to Twelve Data fallback
        Object.keys(results).forEach(key => delete results[key]);
      }
    }

    // Fallback: Twelve Data multi-quote endpoint
    if (providerUsed !== 'polygon' && TWELVEDATA_API_KEY) {
      const chunks = chunk(symbols, 30); // keep URLs reasonable
      for (const group of chunks) {
        const url = new URL("https://api.twelvedata.com/quote");
        url.searchParams.set("symbol", group.join(","));
        url.searchParams.set("apikey", TWELVEDATA_API_KEY);

        const res = await fetch(url.toString());
        const data = await res.json();
        if (!res.ok) {
          console.error("TwelveData error", res.status, data);
          throw new Error(`TwelveData error ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
        }

        // Handle both shapes: { data: [ {symbol, close, previous_close, ...}, ... ] }
        // and { AAPL: {...}, MSFT: {...} }
        if (Array.isArray((data as any)?.data)) {
          for (const item of (data as any).data) {
            if (!item || item?.status === "error") continue;
            const sym = String(item?.symbol || "").toUpperCase();
            if (!sym) continue;
            const price = Number(item?.close);
            const prevClose = Number(item?.previous_close);
            const change = Number.isFinite(price) && Number.isFinite(prevClose) ? price - prevClose : Number(item?.change);
            const changePercent = Number.isFinite(prevClose) && prevClose !== 0
              ? ((Number.isFinite(change) ? change : price - prevClose) / prevClose) * 100
              : Number(item?.percent_change);
            if (Number.isFinite(price)) {
              results[sym] = {
                price,
                prevClose: Number.isFinite(prevClose) ? prevClose : undefined,
                change: Number.isFinite(change) ? change : undefined,
                changePercent: Number.isFinite(changePercent) ? changePercent : undefined,
              };
            }
          }
        } else {
          for (const sym of group) {
            const item = (data as any)[sym];
            if (!item || item?.status === "error") continue;
            const price = Number(item?.close);
            const prevClose = Number(item?.previous_close);
            const change = Number.isFinite(price) && Number.isFinite(prevClose) ? price - prevClose : Number(item?.change);
            const changePercent = Number.isFinite(prevClose) && prevClose !== 0
              ? ((Number.isFinite(change) ? change : price - prevClose) / prevClose) * 100
              : Number(item?.percent_change);
            if (Number.isFinite(price)) {
              results[sym] = {
                price,
                prevClose: Number.isFinite(prevClose) ? prevClose : undefined,
                change: Number.isFinite(change) ? change : undefined,
                changePercent: Number.isFinite(changePercent) ? changePercent : undefined,
              };
            }
          }
        }
      }
      providerUsed = 'twelvedata';
    }

    if (Object.keys(results).length === 0) {
      throw new Error("Missing data provider API key or no data returned.");
    }

    // Optionally enrich with 28d metrics (price change + dividends paid in last 28 days)
    if (include28d) {
      try {
        // 1) Fetch dividends from Supabase for the last 28 days in a single query
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SERVICE_ROLE) {
          const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
          const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
          const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
          const sinceISO = since.toISOString().slice(0, 10);
          const { data: rows, error } = await sb
            .from("dividends")
            .select("ticker, amount, pay_date, ex_date")
            .in("ticker", Object.keys(results))
            .or(`pay_date.gte.${sinceISO},ex_date.gte.${sinceISO}`);
          if (error) throw error;
          const divSums: Record<string, number> = {};
          for (const r of rows || []) {
            const sym = (r as any).ticker as string;
            const amt = Number((r as any).amount) || 0;
            if (!divSums[sym]) divSums[sym] = 0;
            divSums[sym] += amt;
          }

          // 2) If Polygon is available, fetch 28d start price per symbol
          if (POLYGON_API_KEY) {
            const targetTs = Date.now() - 28 * 24 * 60 * 60 * 1000;
            const from = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            const to = new Date().toISOString().slice(0, 10);

            const syms = Object.keys(results);
            const fetchStart = async (sym: string) => {
              const u = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(sym)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=120&apiKey=${POLYGON_API_KEY}`;
              const res = await fetch(u);
              if (!res.ok) return undefined;
              const json = await res.json();
              const bars = Array.isArray(json?.results) ? json.results : [];
              if (!bars.length) return undefined;
              // find the first bar on/after targetTs
              const bar = bars.find((b: any) => Number(b?.t) >= targetTs) ?? bars[0];
              const c = Number(bar?.c);
              return Number.isFinite(c) ? c : undefined;
            };

            // Limit concurrency modestly
            const concurrency = 10;
            const queue: Promise<void>[] = [];
            for (let i = 0; i < syms.length; i += concurrency) {
              const group = syms.slice(i, i + concurrency);
              queue.push(
                (async () => {
                  await Promise.all(
                    group.map(async (sym) => {
                      try {
                        const start = await fetchStart(sym);
                        if (start && results[sym]?.price) {
                          const end = results[sym].price;
                          const priceChangePct = ((end - start) / start) * 100;
                          const div = divSums[sym] || 0;
                          const divRetPct = (div / start) * 100;
                          results[sym].price28dStart = start;
                          results[sym].change28dPercent = priceChangePct;
                          results[sym].dividends28d = div;
                          results[sym].dividends28dReturnPercent = divRetPct;
                          results[sym].totalReturn28dPercent = priceChangePct + divRetPct;
                        }
                      } catch (_) {
                        // ignore individual symbol errors
                      }
                    })
                  );
                })()
              );
            }
            await Promise.all(queue);
          }
        }
      } catch (err) {
        console.error("include28d enrichment failed", err);
      }
    }

    return json({ prices: results });
  } catch (e: any) {
    console.error("polygon-quotes error", e?.message || e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}
