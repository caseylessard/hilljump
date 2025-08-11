import { supabase } from "@/integrations/supabase/client";

export type LivePrice = {
  price: number;
  prevClose?: number;
  change?: number;
  changePercent?: number;
  // 28d enrichment (optional)
  price28dStart?: number;
  change28dPercent?: number;
  dividends28d?: number;
  dividends28dReturnPercent?: number;
  totalReturn28dPercent?: number;
};

export async function fetchLivePrices(tickers: string[]): Promise<Record<string, LivePrice>> {
  const { data, error } = await supabase.functions.invoke("polygon-quotes", {
    body: { tickers, include28d: true },
  });
  if (error) throw error;
  return (data?.prices as Record<string, LivePrice>) || {};
}
