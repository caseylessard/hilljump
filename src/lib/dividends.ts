import { supabase } from "@/integrations/supabase/client";

export type Distribution = {
  amount: number;
  date: string; // ISO date string (prefer pay_date, fallback to ex_date)
  currency?: string;
};

export async function fetchLatestDistributions(
  tickers: string[]
): Promise<Record<string, Distribution>> {
  if (!tickers.length) return {};

  const { data, error } = await supabase
    .from("dividends")
    .select("ticker, amount, ex_date, pay_date, cash_currency")
    .in("ticker", tickers)
    .order("ex_date", { ascending: false });

  if (error) throw error;

  const map: Record<string, Distribution> = {};

  // Get the most recent dividend for each ticker
  for (const row of data || []) {
    if (!map[row.ticker]) {
      const bestDate: string | null = (row.pay_date as string | null) || (row.ex_date as string | null) || null;
      if (bestDate) {
        map[row.ticker] = {
          amount: Number(row.amount) || 0,
          date: bestDate,
          currency: row.cash_currency || "USD",
        };
      }
    }
  }

  return map;
}

export async function predictNextDistribution(
  ticker: string
): Promise<{ amount: number; date: string } | null> {
  // Get recent dividends for pattern analysis
  const { data, error } = await supabase
    .from("dividends")
    .select("amount, ex_date")
    .eq("ticker", ticker)
    .order("ex_date", { ascending: false })
    .limit(12); // Last 12 distributions

  if (error || !data || data.length < 2) return null;

  // Calculate average amount from recent distributions
  const amounts = data.map(d => Number(d.amount)).filter(a => a > 0);
  const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;

  // Calculate average days between distributions
  const dates = data.map(d => new Date(d.ex_date)).sort((a, b) => b.getTime() - a.getTime());
  if (dates.length < 2) return null;

  const intervals = [];
  for (let i = 0; i < dates.length - 1; i++) {
    const daysDiff = Math.floor((dates[i].getTime() - dates[i + 1].getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 0 && daysDiff < 400) intervals.push(daysDiff); // Reasonable range
  }

  if (intervals.length === 0) return null;

  const avgInterval = intervals.reduce((sum, int) => sum + int, 0) / intervals.length;
  
  // Predict next date
  const lastDate = dates[0];
  const nextDate = new Date(lastDate.getTime() + avgInterval * 24 * 60 * 60 * 1000);
  
  // Only show if it's in the future
  if (nextDate <= new Date()) return null;

  return {
    amount: avgAmount,
    date: nextDate.toISOString().split('T')[0]
  };
}