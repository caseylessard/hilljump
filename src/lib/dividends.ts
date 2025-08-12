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
