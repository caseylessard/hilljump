import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { 
      status: 405,
      headers: corsHeaders 
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const payload = await req.json();
    console.log('Received alerts payload:', JSON.stringify(payload, null, 2));
    
    const pickDate = new Date(payload.timestamp ?? Date.now());
    const pick_date = new Date(
      pickDate.toLocaleString("en-CA", { timeZone: "America/Toronto" })
    ).toISOString().slice(0, 10);

    const eqRows = (payload.equities ?? []).map((p: any) => ({
      pick_date,
      picked_at: new Date().toISOString(),
      rank_order: p.rank_order,
      ticker: p.symbol,
      exchange: p.exchange,
      price: p.price,
      premarket_change_pct: p.premarket_change_pct,
      rel_vol: p.rel_vol,
      float_shares: p.float_shares,
      news_recent_count: p.news_recent_count,
      atr_pct: p.atr_pct,
      yday_high: p.yday_high,
      yday_low: p.yday_low,
      target_growth_pct: p.target_growth_pct,
      likelihood_of_win: p.likelihood_of_win,
      entry_price: p.entry,
      stop_price: p.stop,
      tp1_price: p.tp1,
      tp2_price: p.tp2,
    }));

    const crRows = (payload.crypto ?? []).map((p: any) => ({
      pick_date,
      picked_at: new Date().toISOString(),
      rank_order: p.rank_order,
      symbol: p.symbol,
      price: p.price,
      change_24h_pct: p.change_24h_pct,
      rel_vol: p.rel_vol,
      news_recent_count: p.news_recent_count,
      atr_pct: p.atr_pct,
      yday_high: p.yday_high,
      yday_low: p.yday_low,
      target_growth_pct: p.target_growth_pct,
      likelihood_of_win: p.likelihood_of_win,
      entry_price: p.entry,
      stop_price: p.stop,
      tp1_price: p.tp1,
      tp2_price: p.tp2,
    }));

    if (eqRows.length) {
      console.log(`Upserting ${eqRows.length} equity alerts for ${pick_date}`);
      const { error } = await supabase.from("equity_alerts").upsert(eqRows, {
        onConflict: "pick_date,rank_order,ticker",
      });
      if (error) {
        console.error('Error upserting equity alerts:', error);
        throw error;
      }
    }

    if (crRows.length) {
      console.log(`Upserting ${crRows.length} crypto alerts for ${pick_date}`);
      const { error } = await supabase.from("crypto_alerts").upsert(crRows, {
        onConflict: "pick_date,rank_order,symbol",
      });
      if (error) {
        console.error('Error upserting crypto alerts:', error);
        throw error;
      }
    }

    console.log('Successfully processed alerts');
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 
        ...corsHeaders,
        "content-type": "application/json" 
      },
    });
  } catch (e) {
    console.error('Error processing alerts:', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 400,
      headers: { 
        ...corsHeaders,
        "content-type": "application/json" 
      },
    });
  }
});