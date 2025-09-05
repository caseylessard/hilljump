import { supabase } from "@/integrations/supabase/client";

export type EquityAlert = {
  pick_date: string;
  picked_at: string;
  rank_order: number;
  ticker: string;
  exchange: string | null;
  price: number | null;
  premarket_change_pct: number | null;
  rel_vol: number | null;
  float_shares: number | null;
  news_recent_count: number | null;
  atr_pct: number | null;
  yday_high: number | null;
  yday_low: number | null;
  target_growth_pct: number | null;
  likelihood_of_win: number | null;
  entry_price: number | null;
  stop_price: number | null;
  tp1_price: number | null;
  tp2_price: number | null;
};

export type CryptoAlert = {
  pick_date: string;
  picked_at: string;
  rank_order: number;
  symbol: string;
  price: number | null;
  change_24h_pct: number | null;
  rel_vol: number | null;
  news_recent_count: number | null;
  atr_pct: number | null;
  yday_high: number | null;
  yday_low: number | null;
  target_growth_pct: number | null;
  likelihood_of_win: number | null;
  entry_price: number | null;
  stop_price: number | null;
  tp1_price: number | null;
  tp2_price: number | null;
};

export async function fetchTodayAlerts() {
  const today = new Date().toISOString().slice(0, 10);
  
  const { data: eq, error: eqError } = await supabase
    .from("equity_alerts")
    .select("*")
    .eq("pick_date", today)
    .order("rank_order", { ascending: true });

  const { data: cr, error: crError } = await supabase
    .from("crypto_alerts")
    .select("*")
    .eq("pick_date", today)
    .order("rank_order", { ascending: true });

  if (eqError) {
    console.error('Error fetching equity alerts:', eqError);
  }
  
  if (crError) {
    console.error('Error fetching crypto alerts:', crError);
  }

  return { 
    equities: (eq ?? []) as EquityAlert[], 
    crypto: (cr ?? []) as CryptoAlert[] 
  };
}

export async function fetchLatestAlerts(days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().slice(0, 10);
  
  const { data: eq, error: eqError } = await supabase
    .from("equity_alerts")
    .select("*")
    .gte("pick_date", startDateStr)
    .order("pick_date", { ascending: false })
    .order("rank_order", { ascending: true });

  const { data: cr, error: crError } = await supabase
    .from("crypto_alerts")
    .select("*")
    .gte("pick_date", startDateStr)
    .order("pick_date", { ascending: false })
    .order("rank_order", { ascending: true });

  if (eqError) {
    console.error('Error fetching equity alerts:', eqError);
  }
  
  if (crError) {
    console.error('Error fetching crypto alerts:', crError);
  }

  return { 
    equities: (eq ?? []) as EquityAlert[], 
    crypto: (cr ?? []) as CryptoAlert[] 
  };
}