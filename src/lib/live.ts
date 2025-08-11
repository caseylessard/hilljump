import { supabase } from "@/integrations/supabase/client";

export type LivePrice = { price: number; prevClose?: number; change?: number; changePercent?: number };

export async function fetchLivePrices(tickers: string[]): Promise<Record<string, LivePrice>> {
  const { data, error } = await supabase.functions.invoke("polygon-quotes", {
    body: { tickers },
  });
  if (error) throw error;
  return (data?.prices as Record<string, LivePrice>) || {};
}
