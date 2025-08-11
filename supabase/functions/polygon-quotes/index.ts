// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const POLYGON_API_KEY = Deno.env.get("POLYGON_API_KEY");

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!POLYGON_API_KEY) throw new Error("Missing POLYGON_API_KEY secret");

    const { tickers } = await req.json();
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return json({ error: "tickers must be a non-empty array" }, 400);
    }

    const symbols: string[] = [...new Set(tickers.map((t: any) => String(t || "").toUpperCase()).filter(Boolean))];

    // Polygon snapshot endpoint supports comma-separated tickers; chunk to be safe (<=50 per call)
    const chunk = <T,>(arr: T[], size: number) => arr.reduce<T[][]>((acc, _, i) => i % size ? acc : [...acc, arr.slice(i, i + size)], []);
    const chunks = chunk(symbols, 50);

    const results: Record<string, { price: number; prevClose?: number; change?: number; changePercent?: number }> = {};

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
      const list = Array.isArray(data?.tickers) ? data.tickers : [];

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
