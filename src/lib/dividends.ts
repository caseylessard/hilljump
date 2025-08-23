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
    .in("ticker", tickers);

  if (error) throw error;

  const map: Record<string, Distribution> = {};

  for (const row of data || []) {
    const bestDate: string | null = (row.pay_date as string | null) || (row.ex_date as string | null) || null;
    if (!bestDate) continue;

    const current = map[row.ticker];
    if (!current || new Date(bestDate) > new Date(current.date)) {
      map[row.ticker] = {
        amount: Number(row.amount) || 0,
        date: bestDate,
        currency: row.cash_currency || "USD",
      };
    }
  }

  return map;
}

export async function calculateAnnualYields(
  tickers: string[], 
  currentPrices: Record<string, number>
): Promise<Record<string, number>> {
  if (!tickers.length) return {};

  // Get dividends from last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const { data, error } = await supabase
    .from("dividends")
    .select("ticker, amount, ex_date")
    .in("ticker", tickers)
    .gte("ex_date", twelveMonthsAgo.toISOString().split('T')[0]);

  if (error) throw error;

  const yields: Record<string, number> = {};

  // Group by ticker and sum amounts
  const tickerSums: Record<string, number> = {};
  for (const row of data || []) {
    tickerSums[row.ticker] = (tickerSums[row.ticker] || 0) + Number(row.amount);
  }

  // Calculate yield as (annual dividends / current price) * 100
  for (const [ticker, totalDividends] of Object.entries(tickerSums)) {
    const price = currentPrices[ticker];
    if (price && price > 0) {
      yields[ticker] = (totalDividends / price) * 100;
    }
  }

  return yields;
}
