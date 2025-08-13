import { supabase } from "@/integrations/supabase/client";
import type { ETF } from "@/data/etfs";

// Map DB row (snake_case) -> app ETF type (camelCase)
function mapRow(row: any): ETF {
  return {
    ticker: row.ticker,
    name: row.name,
    exchange: row.exchange,
    totalReturn1Y: Number(row.total_return_1y) || 0,
    yieldTTM: Number(row.yield_ttm) || 0,
    avgVolume: Number(row.avg_volume) || 0,
    expenseRatio: Number(row.expense_ratio) || 0,
    volatility1Y: Number(row.volatility_1y) || 0,
    maxDrawdown1Y: Number(row.max_drawdown_1y) || 0,
    aum: Number(row.aum) || 0,
    category: row.category ?? undefined,
    summary: row.summary ?? undefined,
    country: row.country ?? undefined,
    manager: row.manager ?? undefined,
    strategyLabel: row.strategy_label ?? undefined,
    logoKey: row.logo_key ?? undefined,
  };
}

export async function getETFs(): Promise<ETF[]> {
  const { data, error } = await supabase.from("etfs").select("*");
  if (error) throw error;
  return (data || []).map(mapRow);
}
