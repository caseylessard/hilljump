
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
    const { tickers, include28d, includeDRIP, region } = await req.json();
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return json({ error: "tickers must be a non-empty array" }, 400);
    }

    const symbols: string[] = [...new Set(tickers.map((t: any) => String(t || "").toUpperCase()).filter(Boolean))];
    const netDivFactor = region === 'US' ? 1 : 0.85; // default to CA (15% withholding assumed)


    // Helper to chunk arrays
    const chunk = <T,>(arr: T[], size: number) => arr.reduce<T[][]>((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);

    const results: Record<string, PriceResult & {
      price28dStart?: number;
      change28dPercent?: number;
      dividends28d?: number;
      dividends28dReturnPercent?: number;
      totalReturn28dPercent?: number;
    }> = {};

    let providerUsed: 'polygon' | 'twelvedata' | 'mixed' | 'none' = 'none';
    let missingSymbols: string[] = [];

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
        
        // Check which symbols are missing from Polygon results
        missingSymbols = symbols.filter(sym => !results[sym]);
        if (missingSymbols.length > 0) {
          console.log(`Missing from Polygon: ${missingSymbols.join(', ')}`);
        }
      } catch (polygonError) {
        console.error("Polygon API failed, falling back to Twelve Data:", polygonError);
        // Clear results and continue to Twelve Data fallback
        Object.keys(results).forEach(key => delete results[key]);
        missingSymbols = symbols;
      }
    } else {
      missingSymbols = symbols;
    }

    // Fallback: Twelve Data multi-quote endpoint for missing symbols or if Polygon failed completely
    if (missingSymbols.length > 0 && TWELVEDATA_API_KEY) {
      const chunks = chunk(missingSymbols, 30); // keep URLs reasonable
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
      providerUsed = providerUsed === 'polygon' ? 'mixed' : 'twelvedata';
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
                          const div = (divSums[sym] || 0) * netDivFactor;
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
    // Optionally compute DRIP metrics for 4W, 12W, 52W periods
    if (includeDRIP) {
      try {
        const syms = Object.keys(results);
        // 1) Get EOD bars to determine last EOD and start prices per period
        const barsBySym: Record<string, any[]> = {};
        if (POLYGON_API_KEY) {
          const from = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const to = new Date().toISOString().slice(0, 10);
          const fetchBars = async (sym: string) => {
            const u = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(sym)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${POLYGON_API_KEY}`;
            const res = await fetch(u);
            if (!res.ok) return [] as any[];
            const json = await res.json();
            const bars = Array.isArray(json?.results) ? json.results : [];
            return bars;
          };
          const concurrency = 8;
          const queue: Promise<void>[] = [];
          for (let i = 0; i < syms.length; i += concurrency) {
            const group = syms.slice(i, i + concurrency);
            queue.push((async () => {
              await Promise.all(group.map(async (sym) => {
                try {
                  barsBySym[sym] = await fetchBars(sym);
                } catch (_) {
                  barsBySym[sym] = [];
                }
              }));
            })());
          }
          await Promise.all(queue);
        }

        const findStartOnOrBefore = (bars: any[], targetTs: number) => {
          if (!bars?.length) return undefined as number | undefined;
          // bars are asc sorted
          let candidate: number | undefined;
          for (const b of bars) {
            const t = Number(b?.t);
            if (!Number.isFinite(t)) continue;
            if (t <= targetTs) candidate = Number(b?.c);
            else break;
          }
          return candidate;
        };

        // 2) Fetch dividends once (since earliest possible start)
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        let rowsByTicker: Record<string, { amount: number; date: string }[]> = {};
        const todayISO = new Date().toISOString().slice(0, 10);
        if (SUPABASE_URL && SERVICE_ROLE && syms.length) {
          const earliestISO = new Date(Date.now() - 370 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
          const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
          const { data: rows } = await sb
            .from("dividends")
            .select("ticker, amount, pay_date, ex_date")
            .in("ticker", syms)
            .or(`pay_date.gte.${earliestISO},ex_date.gte.${earliestISO}`);
          rowsByTicker = {};
          for (const r of rows || []) {
            const sym = String((r as any).ticker || '').toUpperCase();
            if (!sym) continue;
            const amt = Number((r as any).amount) || 0;
            const date = String((r as any).pay_date || (r as any).ex_date || '') || '';
            if (!rowsByTicker[sym]) rowsByTicker[sym] = [];
            if (date) rowsByTicker[sym].push({ amount: amt, date });
          }
        }

        // 3) Compute DRIP metrics per symbol
        for (const sym of syms) {
          const priceNow = results[sym]?.price;
          if (!Number.isFinite(priceNow)) continue;
          const bars = barsBySym[sym] || [];
          const lastTs = bars.length ? Number(bars[bars.length - 1]?.t) : undefined;
          if (!Number.isFinite(lastTs)) continue;
          const DAY = 24 * 60 * 60 * 1000;
          const targets = {
            w4: lastTs - 28 * DAY,
            w12: lastTs - 84 * DAY,
            w52: lastTs - 364 * DAY,
          } as const;
          const start4 = findStartOnOrBefore(bars, targets.w4);
          const start12 = findStartOnOrBefore(bars, targets.w12);
          const start52 = findStartOnOrBefore(bars, targets.w52);

          const toISO = (ts?: number) => ts ? new Date(ts).toISOString().slice(0, 10) : undefined;
          const s4ISO = toISO(targets.w4);
          const s12ISO = toISO(targets.w12);
          const s52ISO = toISO(targets.w52);

          const list = rowsByTicker[sym] || [];
          const sumDivs = (startISO?: string) => {
            if (!startISO) return 0;
            let sum = 0;
            for (const row of list) {
              const d = row.date?.slice(0, 10);
              if (!d) continue;
              if (d > startISO && d <= todayISO) sum += Number(row.amount) || 0; // strictly after start EOD, up to today
            }
            return sum;
          };

          const div4 = sumDivs(s4ISO);
          const div12 = sumDivs(s12ISO);
          const div52 = sumDivs(s52ISO);

          const div4Net = div4 * netDivFactor;
          const div12Net = div12 * netDivFactor;
          const div52Net = div52 * netDivFactor;

          if (Number.isFinite(start4)) {
            const dollar = (priceNow as number) + div4Net - (start4 as number);
            const pct = (dollar / (start4 as number)) * 100;
            (results[sym] as any).price4wStart = start4;
            (results[sym] as any).dividends4w = div4Net;
            (results[sym] as any).drip4wDollar = dollar;
            (results[sym] as any).drip4wPercent = pct;
          }
          if (Number.isFinite(start12)) {
            const dollar = (priceNow as number) + div12Net - (start12 as number);
            const pct = (dollar / (start12 as number)) * 100;
            (results[sym] as any).price12wStart = start12;
            (results[sym] as any).dividends12w = div12Net;
            (results[sym] as any).drip12wDollar = dollar;
            (results[sym] as any).drip12wPercent = pct;
          }
          if (Number.isFinite(start52)) {
            const dollar = (priceNow as number) + div52Net - (start52 as number);
            const pct = (dollar / (start52 as number)) * 100;
            (results[sym] as any).price52wStart = start52;
            (results[sym] as any).dividends52w = div52Net;
            (results[sym] as any).drip52wDollar = dollar;
            (results[sym] as any).drip52wPercent = pct;
          }
        }
      } catch (err) {
        console.error("includeDRIP enrichment failed", err);
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