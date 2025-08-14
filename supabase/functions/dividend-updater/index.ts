// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const POLYGON_API_KEY = Deno.env.get("POLYGON_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!POLYGON_API_KEY) throw new Error("Missing POLYGON_API_KEY secret");
    if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error("Missing Supabase service credentials");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Create log entry for this update run
    const { data: logEntry } = await supabase
      .from("dividend_update_logs")
      .insert({ status: 'running' })
      .select('id')
      .single();
    const logId = logEntry?.id;

    // 1) Load tickers from DB
    const { data: etfs, error: e1 } = await supabase.from("etfs").select("id, ticker");
    if (e1) throw e1;
    const tickers: { id: string; ticker: string }[] = etfs || [];

    // helper: fetch dividends for one ticker
    async function fetchDividends(ticker: string) {
      const url = new URL("https://api.polygon.io/v3/reference/dividends");
      url.searchParams.set("ticker", ticker);
      url.searchParams.set("order", "desc");
      url.searchParams.set("limit", "100");
      url.searchParams.set("apiKey", POLYGON_API_KEY!);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`polygon dividends ${ticker} ${res.status}`);
      const json = await res.json();
      return Array.isArray(json?.results) ? json.results : [];
    }

    async function fetchPrevClose(ticker: string) {
      const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`polygon prev close ${ticker} ${res.status}`);
      const json = await res.json();
      const close = Number(json?.results?.[0]?.c);
      return Number.isFinite(close) ? close : null;
    }

    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    let updated = 0;
    let insertedEvents = 0;

    // Process in small batches to respect rate limits
    const batchSize = 10;
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async ({ id, ticker }) => {
          try {
            const divs = await fetchDividends(ticker);
            // Upsert recent dividends (last ~400 days)
            const recent = divs.filter((d: any) => {
              const ex = new Date(d.ex_dividend_date || d.pay_date || d.declaration_date || 0);
              return ex >= oneYearAgo;
            });

            if (recent.length) {
              const rows = recent.map((d: any) => ({
                etf_id: id,
                ticker,
                ex_date: d.ex_dividend_date || null,
                pay_date: d.pay_date || null,
                amount: Number(d.cash_amount) || 0,
                cash_currency: (d.currency || 'USD') as string,
              }));

              // Insert ignoring conflicts on (ticker, ex_date)
              const { error: insErr } = await supabase
                .from("dividends")
                .insert(rows, { onConflict: "ticker,ex_date" });
              if (insErr && insErr.code !== "23505") throw insErr;
              insertedEvents += rows.length;

              // Compute TTM sum
              const ttm = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
              const prevClose = await fetchPrevClose(ticker);
              if (prevClose && prevClose > 0) {
                const yieldPct = (ttm / prevClose) * 100;
                const { error: updErr } = await supabase
                  .from("etfs")
                  .update({ yield_ttm: yieldPct })
                  .eq("id", id);
                if (updErr) throw updErr;
                updated += 1;
              }
            }
          } catch (err) {
            console.error("dividend-updater error", ticker, err);
          }
        })
      );
    }

    // Update log entry with completion status
    if (logId) {
      await supabase
        .from("dividend_update_logs")
        .update({ 
          status: 'completed',
          end_time: new Date().toISOString(),
          total_etfs: tickers.length,
          updated_etfs: updated,
          inserted_events: insertedEvents
        })
        .eq('id', logId);
    }

    return new Response(JSON.stringify({ ok: true, updated, insertedEvents, totalETFs: tickers.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("dividend-updater", e?.message || e);
    
    // Update log entry with error status
    if (logId) {
      await supabase
        .from("dividend_update_logs")
        .update({ 
          status: 'error',
          end_time: new Date().toISOString(),
          error_message: String(e?.message || e)
        })
        .eq('id', logId);
    }
    
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
