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
    const { tickers } = await req.json();
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return json({ error: "tickers must be a non-empty array" }, 400);
    }

    const symbols: string[] = [...new Set(tickers.map((t: any) => String(t || "").toUpperCase()).filter(Boolean))];

    // Helper to chunk arrays
    const chunk = <T,>(arr: T[], size: number) => arr.reduce<T[][]>((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);

    const results: Record<string, PriceResult> = {};

    if (TWELVEDATA_API_KEY) {
      // Preferred: Twelve Data multi-quote endpoint
      // Docs: https://twelvedata.com/docs#quote (supports comma-separated symbols)
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

      return json({ prices: results });
    }

    // Fallback: Polygon snapshot endpoint (requires entitlements)
    if (!POLYGON_API_KEY) {
      throw new Error("Missing data provider API key. Set TWELVEDATA_API_KEY or POLYGON_API_KEY.");
    }

    const chunks = chunk(symbols, 50);
    for (const group of chunks) {
      const url = new URL("https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers");
      url.searchParams.set("tickers", group.join(","));
      url.searchParams.set("apiKey", POLYGON_API_KEY);

      const res = await fetch(url.toString());
      if (!res.ok) {
        const text = await res.text();
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

    return json({ prices: results });
  } catch (e: any) {
    console.error("polygon-quotes error", e?.message || e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}
