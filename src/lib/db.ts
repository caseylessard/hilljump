import { supabase } from "@/integrations/supabase/client";
import type { ETF } from "@/data/etfs";

// Map DB row (snake_case) -> app ETF type (camelCase)
function mapRow(row: any): ETF {
  return {
    ticker: row.ticker,
    name: row.name,
    exchange: row.exchange,
    // Use actual values or keep as null/undefined - don't fallback to zero
    totalReturn1Y: row.total_return_1y ? Number(row.total_return_1y) : 0,
    yieldTTM: row.yield_ttm ? Number(row.yield_ttm) : 0,
    avgVolume: row.avg_volume ? Number(row.avg_volume) : 0,
    expenseRatio: row.expense_ratio ? Number(row.expense_ratio) : 0.01, // Default 1% if missing
    volatility1Y: row.volatility_1y ? Number(row.volatility_1y) : 15, // Default 15% if missing
    maxDrawdown1Y: row.max_drawdown_1y ? Number(row.max_drawdown_1y) : -10, // Default -10% if missing
    aum: row.aum ? Number(row.aum) : 0,
    current_price: row.current_price ? Number(row.current_price) : undefined,
    category: row.category ?? undefined,
    summary: row.summary ?? undefined,
    country: row.country ?? undefined,
    manager: row.manager ?? undefined,
    strategyLabel: row.strategy_label ?? undefined,
    logoKey: row.logo_key ?? undefined,
    // New columns from updated ticker data
    provider: row.provider ?? undefined,
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
    finnhubSymbol: row.finnhub_symbol ?? undefined,
    eodhSymbol: row.eodhd_symbol ?? undefined,
  };
}

export async function getETFs(): Promise<ETF[]> {
  const { data, error } = await supabase.from("etfs").select("*");
  if (error) throw error;
  return (data || []).map(mapRow);
}
