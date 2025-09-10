// AI Portfolio Builder - TypeScript implementation of the Python logic
import type { ETF } from "@/data/etfs";
import type { LivePrice } from "@/lib/live";
import { supabase } from "@/integrations/supabase/client";
import { getCachedGlobalHistoricalPrices } from '@/lib/globalCache';

export interface AIPortfolioETF extends ETF {
  lastPrice: number;
  ret1Y: number | null;
  r4?: number;
  r13?: number;
  r26?: number;
  r52?: number;
  p4?: number;
  p13?: number;
  p26?: number;
  p52?: number;
  d1?: number;
  d2?: number;
  d3?: number;
  trendRaw?: number;
  badge?: string;
  badgeLabel?: string;
  badgeColor?: string;
  volAnn?: number;
  maxDrawdown?: number;
  sharpe?: number;
  trendScore: number;
  ret1yScore: number;
  blendScore: number;
  weight: number;
  allocationDollar?: number;
  shares?: number;
  allocRounded?: number;
  isEstimated?: boolean; // Flag for ETFs with insufficient historical data
}

// Windows in trading days ≈ weeks*5
const WIN = { r4: 20, r13: 65, r26: 130, r52: 260 };

function safeDivide(a: number, b: number, fallback = 0): number {
  return isFinite(a) && isFinite(b) && b !== 0 ? a / b : fallback;
}

function oneYearTotalReturn(prices: number[]): number | null {
  if (!prices || prices.length < 252) return null; // Need at least 1 year of data
  
  const endPrice = prices[prices.length - 1];
  const startPrice = prices[prices.length - 252]; // ~1 year ago
  
  if (!isFinite(startPrice) || !isFinite(endPrice) || startPrice <= 0) {
    return null;
  }
  
  return endPrice / startPrice - 1.0;
}

function totalReturn(prices: number[], days: number): number {
  if (!prices || prices.length <= days) return 0;
  
  const currentPrice = prices[prices.length - 1];
  const pastPrice = prices[prices.length - 1 - days];
  
  return safeDivide(currentPrice, pastPrice) - 1.0;
}

function computeDripWindows(prices: number[]): [number, number, number, number] {
  const r4 = totalReturn(prices, WIN.r4);
  const r13 = totalReturn(prices, WIN.r13);
  const r26 = totalReturn(prices, WIN.r26);
  const r52 = totalReturn(prices, WIN.r52);
  
  return [r4, r13, r26, r52];
}

function ladderTrendRaw(r4: number, r13: number, r26: number, r52: number, eps = 0.0): [number, [number, number, number, number], [number, number, number]] {
  // Ladder-Delta Trend (per-week normalization + accel bonuses, small penalties)
  const p4 = r4 / 4;
  const p13 = r13 / 13;
  const p26 = r26 / 26;
  const p52 = r52 / 52;
  
  const d1 = p4 - p13;
  const d2 = p13 - p26;
  const d3 = p26 - p52;
  
  // Optional tiny dead-zone on deltas to mute noise
  const pos = (x: number) => Math.max(0.0, x - eps);
  const neg = (x: number) => Math.max(0.0, -x - eps);
  
  const base = 0.60 * p4 + 0.25 * p13 + 0.10 * p26 + 0.05 * p52;
  const bonus = 1.00 * pos(d1) + 0.70 * pos(d2) + 0.50 * pos(d3);
  const penal = 0.50 * (neg(d1) + neg(d2) + neg(d3));
  
  return [base + bonus - penal, [p4, p13, p26, p52], [d1, d2, d3]];
}

function ladderBadge(d1: number, d2: number, d3: number, eps = 0.0005): [string, string, string] {
  // ↑ if delta > eps, ↔ if |delta|<=eps, ↓ if delta < -eps
  const arrow = (d: number) => {
    if (d > eps) return "↑";
    if (d < -eps) return "↓";
    return "↔";
  };
  
  const arrows = [arrow(d1), arrow(d2), arrow(d3)];
  const badge = arrows.join("");
  const pos = arrows.filter(a => a === "↑").length;
  const neg = arrows.filter(a => a === "↓").length;
  
  let label: string, color: string;
  
  if (pos === 3) {
    label = "Strong uptrend";
    color = "green";
  } else if (pos === 2 && neg === 0) {
    label = "Uptrend (moderate)";
    color = "green";
  } else if (neg === 3) {
    label = "Strong downtrend";
    color = "red";
  } else if (neg === 2 && pos === 0) {
    label = "Downtrend (moderate)";
    color = "red";
  } else {
    label = "Mixed / choppy";
    color = "yellow";
  }
  
  return [badge, label, color];
}

function scale0To100(values: number[]): number[] {
  if (values.length === 0) return [];
  
  const validValues = values.filter(v => isFinite(v));
  if (validValues.length === 0) return values.map(() => 50.0);
  
  const vmin = Math.min(...validValues);
  const vmax = Math.max(...validValues);
  
  if (vmax <= vmin) return values.map(() => 50.0);
  
  return values.map(v => {
    if (!isFinite(v)) return 50.0;
    return 100.0 * (v - vmin) / (vmax - vmin);
  });
}

function scaleSafe(values: number[]): number[] {
  // Replace inf/-inf with NaN, then fill NaN with minimum
  const cleaned = values.map(v => {
    if (v === Infinity || v === -Infinity || isNaN(v)) return NaN;
    return v;
  });
  
  const validValues = cleaned.filter(v => !isNaN(v));
  const fillValue = validValues.length > 0 ? Math.min(...validValues) : 0.0;
  
  const filled = cleaned.map(v => isNaN(v) ? fillValue : v);
  return scale0To100(filled);
}

function riskMetrics(prices: number[]): [number | null, number | null, number | null] {
  if (!prices || prices.length < 10) return [null, null, null];
  
  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const ret = safeDivide(prices[i], prices[i - 1]) - 1.0;
    if (isFinite(ret)) returns.push(ret);
  }
  
  if (returns.length === 0) return [null, null, null];
  
  // Annualized volatility
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const volAnn = Math.sqrt(variance * 252);
  
  // Maximum drawdown
  const cumulative: number[] = [1];
  for (const ret of returns) {
    cumulative.push(cumulative[cumulative.length - 1] * (1 + ret));
  }
  
  let maxDrawdown = 0;
  let peak = cumulative[0];
  
  for (const cum of cumulative) {
    if (cum > peak) peak = cum;
    const drawdown = (cum / peak) - 1.0;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  }
  
  // Annualized return and Sharpe
  const muAnn = mean * 252;
  const sharpe = volAnn > 0 ? muAnn / volAnn : null;
  
  return [volAnn, maxDrawdown, sharpe];
}

export type WeightingMethod = "equal" | "return" | "risk_parity";
export type ScoreSource = "trend" | "ret1y" | "blend";

interface PortfolioOptions {
  topK: number;
  minTradingDays: number;
  scoreSource: ScoreSource;
  weighting: WeightingMethod;
  maxWeight: number;
  capital?: number;
  roundShares?: boolean;
}

function capAndNormalize(weights: number[], maxWeight: number | null, minWeight: number = 0.02): number[] {
  // Ensure non-negative weights
  const w = weights.map(w => Math.max(0, w));
  
  const sum = w.reduce((sum, weight) => sum + weight, 0);
  if (sum === 0) return w.map(() => 1.0 / w.length);
  
  // Normalize to sum to 1
  let normalized = w.map(weight => weight / sum);
  
  // Apply minimum weight constraint (2% minimum per position)
  const numPositions = normalized.length;
  const totalMinWeight = minWeight * numPositions;
  
  // If minimum weights exceed 100%, use equal weights
  if (totalMinWeight > 1.0) {
    return normalized.map(() => 1.0 / numPositions);
  }
  
  // Ensure each position gets at least minimum weight
  normalized = normalized.map(weight => Math.max(weight, minWeight));
  
  // Renormalize after applying minimums
  const sumAfterMin = normalized.reduce((sum, weight) => sum + weight, 0);
  if (sumAfterMin > 1.0) {
    normalized = normalized.map(weight => weight / sumAfterMin);
  }
  
  if (maxWeight === null) return normalized;
  
  const maxWeightCapped = Math.max(minWeight, Math.min(1.0, maxWeight));
  
  // Apply weight cap iteratively while respecting minimums
  for (let iter = 0; iter < 10; iter++) {
    const over = normalized.map(weight => weight > maxWeightCapped);
    if (!over.some(Boolean)) break;
    
    const excess = normalized.reduce((sum, weight, i) => {
      return over[i] ? sum + (weight - maxWeightCapped) : sum;
    }, 0);
    
    // Cap overweight positions
    normalized = normalized.map((weight, i) => over[i] ? maxWeightCapped : weight);
    
    // Redistribute excess to underweight positions (above minimum)
    const underweightSum = normalized.reduce((sum, weight, i) => {
      return !over[i] ? sum + Math.max(0, weight - minWeight) : sum;
    }, 0);
    
    if (underweightSum <= 0 || excess <= 0) break;
    
    normalized = normalized.map((weight, i) => {
      if (over[i]) return weight;
      const baseWeight = Math.max(weight, minWeight);
      const excessCapacity = Math.max(0, weight - minWeight);
      return baseWeight + (excessCapacity / underweightSum) * excess;
    });
  }
  
  // Final normalization
  const finalSum = normalized.reduce((sum, weight) => sum + weight, 0);
  if (finalSum > 0) {
    normalized = normalized.map(weight => weight / finalSum);
  }
  
  // Ensure no weight falls below minimum (final safety check)
  normalized = normalized.map(weight => Math.max(weight, minWeight));
  
  // Final renormalization
  const finalSumAfterMin = normalized.reduce((sum, weight) => sum + weight, 0);
  if (finalSumAfterMin > 0) {
    normalized = normalized.map(weight => weight / finalSumAfterMin);
  }
  
  return normalized;
}

function buildWeights(etfs: AIPortfolioETF[], method: WeightingMethod, maxWeight: number | null): number[] {
  if (etfs.length === 0) return [];
  
  let baseWeights: number[];
  
  switch (method) {
    case "equal":
      baseWeights = etfs.map(() => 1.0);
      break;
    case "return":
      baseWeights = etfs.map(etf => Math.max(0.0, etf.ret1Y || 0));
      const returnSum = baseWeights.reduce((sum, w) => sum + w, 0);
      if (returnSum <= 0) baseWeights = etfs.map(() => 1.0);
      break;
    case "risk_parity":
      baseWeights = etfs.map(etf => {
        const vol = etf.volAnn || 0;
        if (vol <= 0) return 0.0;
        return 1.0 / vol;
      });
      const invVolSum = baseWeights.reduce((sum, w) => sum + w, 0);
      if (invVolSum <= 0) baseWeights = etfs.map(() => 1.0);
      break;
    default:
      throw new Error(`Unknown weighting method: ${method}`);
  }
  
  return capAndNormalize(baseWeights, maxWeight);
}

// Fetch real historical prices from database
async function fetchHistoricalPrices(ticker: string, days: number = 520): Promise<number[]> {
  try {
    // Calculate start date (days ago)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const { data: priceData, error } = await supabase
      .from('historical_prices')
      .select('date, close_price')
      .eq('ticker', ticker.toUpperCase())
      .gte('date', startDateStr)
      .order('date', { ascending: true });
    
    if (error) {
      console.warn(`Failed to fetch historical prices for ${ticker}:`, error);
      return [];
    }
    
    if (!priceData || priceData.length < 50) {
      console.warn(`Insufficient historical data for ${ticker}: ${priceData?.length || 0} records`);
      return [];
    }
    
    // Extract just the prices in chronological order (oldest first)
    const prices = priceData
      .filter(row => row.close_price && isFinite(row.close_price))
      .map(row => Number(row.close_price));
    
    console.log(`✅ Fetched ${prices.length} historical prices for ${ticker}`);
    return prices;
    
  } catch (error) {
    console.warn(`Error fetching historical prices for ${ticker}:`, error);
    return [];
  }
}

// Remove mock price generator functions - use only real data

export async function buildAIPortfolio(
  etfs: ETF[],
  prices: Record<string, LivePrice>,
  options: PortfolioOptions
): Promise<AIPortfolioETF[]> {
  const results: AIPortfolioETF[] = [];
  
  // Get all historical prices from cache (1-hour cached) with larger batch
  const allTickers = etfs.map(e => e.ticker);
  const cachedHistoricalPrices = await getCachedGlobalHistoricalPrices(allTickers);
  console.log(`📊 Using cached historical data for ${Object.keys(cachedHistoricalPrices).length}/${allTickers.length} ETFs`);
  
  // Process ETFs with flexible data requirements
  for (const etf of etfs) {
    const livePrice = prices[etf.ticker];
    if (!livePrice?.price) continue;
    
    try {
      // Use cached historical data if available
      let historicalPrices = cachedHistoricalPrices[etf.ticker] || [];
      
      // Much more flexible data requirements - accept ETFs with minimal data
      const minDaysForAnalysis = Math.max(10, Math.min(options.minTradingDays, 60)); // Much lower minimum
      
      if (historicalPrices.length < minDaysForAnalysis) {
        // Create basic portfolio entry using available data (yields, current price)
        // Validate yield data - reject obviously incorrect yields (>50% annual yield is likely bad data)
        const validYield = etf.yieldTTM && etf.yieldTTM > 0 && etf.yieldTTM <= 50;
        
        if (validYield) {
          console.log(`🔄 Using basic ETF data for ${etf.ticker} (${historicalPrices.length} days available, yield: ${etf.yieldTTM?.toFixed(2)}%)`);
          
          // Estimate returns based on yield (very basic approach) - cap at reasonable levels
          const cappedYield = Math.min(etf.yieldTTM || 5, 25); // Cap yield at 25% for safety
          const estimatedReturn = cappedYield / 100; // Use capped yield as proxy for return
          
          // Heavily penalize ETFs without sufficient historical data
          const dataPenalty = 0.2; // 80% penalty for insufficient data
          
          results.push({
            ...etf,
            lastPrice: livePrice.price,
            ret1Y: estimatedReturn * dataPenalty, // Penalized return
            r4: estimatedReturn * 0.077 * dataPenalty,
            r13: estimatedReturn * 0.25 * dataPenalty,
            r26: estimatedReturn * 0.5 * dataPenalty,
            r52: estimatedReturn * dataPenalty,
            p4: estimatedReturn * 0.077 / 4 * dataPenalty,
            p13: estimatedReturn * 0.25 / 13 * dataPenalty,
            p26: estimatedReturn * 0.5 / 26 * dataPenalty,
            p52: estimatedReturn / 52 * dataPenalty,
            d1: -0.5, d2: -0.5, d3: -0.5, // Negative trend for insufficient data
            trendRaw: estimatedReturn * 0.1 * dataPenalty, // Heavily penalized trend
            badge: "⚠️",
            badgeLabel: "Insufficient data",
            badgeColor: "orange",
            volAnn: etf.volatility1Y || 0.25, // Higher assumed volatility
            maxDrawdown: etf.maxDrawdown1Y || -0.2, // Worse assumed drawdown
            sharpe: null,
            trendScore: 0,
            ret1yScore: 0,
            blendScore: 0,
            weight: 0,
            isEstimated: true // Flag to identify estimated data
          });
          continue;
        } else {
          console.warn(`Skipping ${etf.ticker}: insufficient data (${historicalPrices.length} days, invalid yield: ${etf.yieldTTM}%)`);
          continue;
        }
      }
      
      console.log(`✅ Using historical data for ${etf.ticker} (${historicalPrices.length} days)`);
      
      const ret1Y = oneYearTotalReturn(historicalPrices);
      const [volAnn, maxDrawdown, sharpe] = riskMetrics(historicalPrices);
      
      // Trend & badge calculation using real data
      const [r4, r13, r26, r52] = computeDripWindows(historicalPrices);
      const [trendRaw, [p4, p13, p26, p52], [d1, d2, d3]] = ladderTrendRaw(r4, r13, r26, r52);
      const [badge, badgeLabel, badgeColor] = ladderBadge(d1, d2, d3);
      
      results.push({
        ...etf,
        lastPrice: livePrice.price,
        ret1Y: ret1Y || etf.totalReturn1Y, // Fallback to ETF data if calculation fails
        r4, r13, r26, r52,
        p4, p13, p26, p52,
        d1, d2, d3,
        trendRaw,
        badge,
        badgeLabel,
        badgeColor,
        volAnn: volAnn || etf.volatility1Y || 0.15,
        maxDrawdown: maxDrawdown || etf.maxDrawdown1Y || -0.1,
        sharpe,
        trendScore: 0, // Will be calculated below
        ret1yScore: 0, // Will be calculated below
        blendScore: 0, // Will be calculated below
        weight: 0,
        isEstimated: false // This ETF has real historical data
      });
    } catch (error) {
      // Skip ETFs with calculation errors
      console.warn(`Skipping ${etf.ticker} due to calculation error:`, error);
    }
  }
  
  if (results.length === 0) return [];
  
  // Calculate scores
  const trendRawValues = results.map(r => r.trendRaw || 0);
  const ret1YValues = results.map(r => r.ret1Y || 0);
  
  const trendScores = scaleSafe(trendRawValues);
  const ret1yScores = scaleSafe(ret1YValues);
  
  results.forEach((etf, i) => {
    etf.trendScore = trendScores[i];
    etf.ret1yScore = ret1yScores[i];
    etf.blendScore = 0.70 * etf.trendScore + 0.30 * etf.ret1yScore;
  });
  
  // Filter valid results and sort by chosen score
  const scoreKey = options.scoreSource === "trend" ? "trendScore" : 
                   options.scoreSource === "ret1y" ? "ret1yScore" : "blendScore";
  
  const validResults = results.filter(etf => isFinite(etf[scoreKey]));
  validResults.sort((a, b) => b[scoreKey] - a[scoreKey]);
  
  // Select top K (max 20 to prevent over-diversification)
  const topK = Math.max(1, Math.min(options.topK, Math.min(20, validResults.length)));
  const chosen = validResults.slice(0, topK);
  
  // Build weights
  const weights = buildWeights(chosen, options.weighting, options.maxWeight);
  
  chosen.forEach((etf, i) => {
    etf.weight = weights[i] || 0;
  });
  
  // Calculate allocations if capital is provided
  if (options.capital && options.capital > 0) {
    chosen.forEach(etf => {
      etf.allocationDollar = etf.weight * options.capital!;
      
      if (options.roundShares) {
        etf.shares = Math.round((etf.allocationDollar || 0) / etf.lastPrice);
        etf.allocRounded = etf.shares * etf.lastPrice;
      } else {
        etf.shares = (etf.allocationDollar || 0) / etf.lastPrice;
      }
    });
  }
  
  // Sort by allocation percentage (highest first)
  chosen.sort((a, b) => (b.weight || 0) - (a.weight || 0));
  
  return chosen;
}