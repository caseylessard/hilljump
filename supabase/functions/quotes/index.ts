// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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
    await Promise.all(
      tickers.map(async (t: string) => {
        const sym = String(t || "").toUpperCase();
        if (!sym) return;
        const p = await fetchStooqPrice(sym);
        if (p != null) prices[sym] = p;
      })
    );
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
