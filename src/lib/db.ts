import { supabase } from "@/integrations/supabase/client";
import type { ETF } from "@/data/etfs";

// Map DB row (snake_case) -> app ETF type (camelCase)
function mapRow(row: any): ETF {
  return {
    ticker: row.ticker,
    name: row.name,
    exchange: row.exchange,
    // Use actual values from database - show null for missing data
    totalReturn1Y: row.total_return_1y ? Number(row.total_return_1y) : null,
    yieldTTM: row.yield_ttm ? Number(row.yield_ttm) : null,
    avgVolume: row.avg_volume ? Number(row.avg_volume) : null,
    expenseRatio: row.expense_ratio ? Number(row.expense_ratio) : null,
    volatility1Y: row.volatility_1y && row.volatility_1y !== 15 ? Number(row.volatility_1y) : null, // Don't use default 15
    maxDrawdown1Y: row.max_drawdown_1y && row.max_drawdown_1y !== -10 ? Number(row.max_drawdown_1y) : null, // Don't use default -10
    aum: row.aum ? Number(row.aum) : null,
    current_price: row.current_price ? Number(row.current_price) : undefined,
    category: row.category ?? undefined,
    summary: row.summary ?? undefined,
    country: row.country ?? undefined,
    manager: row.manager ?? undefined,
    strategyLabel: row.strategy_label ?? undefined,
    logoKey: row.logo_key ?? undefined,
    // New columns from updated ticker data
    currency: row.currency ?? 'USD',
    underlying: row.underlying ?? undefined,
    active: row.active ?? true,
    fund: row.fund ?? undefined,
    strategy: row.strategy ?? undefined,
    industry: row.industry ?? undefined,
    // Data source fields for improved price fetching
    dataSource: row.data_source ?? undefined,
    polygonSupported: row.polygon_supported ?? false,
    twelveSymbol: row.twelve_symbol ?? undefined,
    eodhSymbol: row.eodhd_symbol ?? undefined,
  };
}

export async function getETFs(): Promise<ETF[]> {
  const { data, error } = await supabase.from("etfs").select("*");
  if (error) throw error;
  return (data || []).map(mapRow);
}
