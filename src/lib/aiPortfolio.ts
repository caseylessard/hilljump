// Enhanced AI Portfolio building logic for DRIP Income ETFs
// Optimized for dividend sustainability, yield, and risk-adjusted returns

export interface AIPortfolioETF {
  ticker: string;
  name: string;
  weight: number;
  shares?: number;
  alloc_dollars?: number;
  alloc_dollars_rounded?: number;
  current_price: number;
  last_date: string;
  
  // Return metrics
  ret_1y?: number;
  ret_3y?: number;
  ret_5y?: number;
  
  // Dividend metrics
  dividend_yield?: number;
  dividend_growth_1y?: number;
  dividend_growth_3y?: number;
  dividend_growth_5y?: number;
  payout_ratio?: number;
  dividend_frequency?: number;
  yield_on_cost_5y?: number;
  
  // Risk metrics
  vol_ann?: number;
  downside_deviation?: number;
  max_drawdown?: number;
  sharpe?: number;
  sortino?: number;
  
  // Quality metrics
  expense_ratio?: number;
  aum?: number;
  avg_volume?: number;
  fund_age_years?: number;
  
  // DRIP windows
  r4?: number;
  r13?: number;
  r26?: number;
  r52?: number;
  
  // Period rates
  p4?: number;
  p13?: number;
  p26?: number;
  p52?: number;
  
  // Deltas
  d1?: number;
  d2?: number;
  d3?: number;
  
  // Scores
  trend_score?: number;
  income_score?: number;
  quality_score?: number;
  risk_adjusted_score?: number;
  composite_score?: number;
  
  // Raw scores
  trend_raw?: number;
  income_raw?: number;
  quality_raw?: number;
  
  // Badge
  badge?: string;
  badge_label?: string;
  badge_color?: string;
  
  // Backward compatibility
  lastPrice?: number;
  trendScore?: number;
  allocRounded?: number;
  allocationDollar?: number;
  badgeLabel?: string;
  badgeColor?: string;
  isEstimated?: boolean;
  category?: string;
  exchange?: string;
}

export type WeightingMethod = 'equal' | 'dividend_yield' | 'risk_parity' | 'risk_adjusted' | 'quality_weighted';
export type ScoreSource = 'trend' | 'income' | 'quality' | 'risk_adjusted' | 'composite';

export interface PortfolioOptions {
  topK: number;
  minTradingDays: number;
  scoreSource: ScoreSource;
  weighting: WeightingMethod;
  maxWeight: number;
  minWeight?: number;
  capital: number;
  roundShares: boolean;
  
  // Income-focused options
  minDividendYield?: number;
  maxExpenseRatio?: number;
  maxDrawdown?: number;
  minFundAge?: number;
  minAUM?: number;
  
  // Score weights for composite
  compositeWeights?: {
    income: number;
    quality: number;
    risk_adjusted: number;
    trend: number;
  };
}

const DEFAULT_COMPOSITE_WEIGHTS = {
  income: 0.40,
  quality: 0.25,
  risk_adjusted: 0.25,
  trend: 0.10
};

export const buildAIPortfolio = async (
  etfs: any[], 
  prices: Record<string, any>,
  options: PortfolioOptions,
  dripData?: Record<string, any>
): Promise<AIPortfolioETF[]> => {
  console.log(`🎯 Building DRIP Income Portfolio with ${etfs.length} ETFs`);
  console.log(`📊 Score source: ${options.scoreSource}, Weighting: ${options.weighting}`);
  console.log(`⚖️ Weight constraints: min=${((options.minWeight || 0.05) * 100).toFixed(1)}%, max=${(options.maxWeight * 100).toFixed(1)}%`);

  if (etfs.length === 0) {
    console.warn('No ETFs provided to buildAIPortfolio');
    return [];
  }

  const results: any[] = [];

  // Process each ETF
  for (const etf of etfs) {
    const ticker = etf.ticker;
    const priceData = prices[ticker];
    const cachedDrip = dripData?.[ticker];
    
    if (!priceData && !cachedDrip) continue;

    const lastPrice = priceData?.price || etf.current_price || 0;
    if (lastPrice <= 0) continue;

    // Calculate returns
    const ret_1y = calculateReturn(etf, cachedDrip, '1y');
    const ret_3y = calculateReturn(etf, cachedDrip, '3y');
    const ret_5y = calculateReturn(etf, cachedDrip, '5y');

    // Extract dividend metrics
    const dividendMetrics = extractDividendMetrics(etf);
    
    // Calculate risk metrics
    const riskMetrics = calculateEnhancedRiskMetrics(etf, cachedDrip);
    
    // Extract quality metrics
    const qualityMetrics = extractQualityMetrics(etf);

    // Calculate DRIP windows
    const { r4, r13, r26, r52 } = computeDripWindows(etf, cachedDrip);
    
    let trend_raw, income_raw, quality_raw;
    let p4, p13, p26, p52, d1, d2, d3;
    let badge, badge_label, badge_color;

    // Calculate trend score with balanced weighting (less short-term focused)
    if (r4 !== undefined && r13 !== undefined && r26 !== undefined && r52 !== undefined) {
      ({ trend_raw, p4, p13, p26, p52, d1, d2, d3 } = balancedTrendScore(r4, r13, r26, r52));
      ({ badge, badge_label, badge_color } = trendBadge(d1!, d2!, d3!));
    }

    // Calculate income score (dividend-focused)
    income_raw = calculateIncomeScore(dividendMetrics, ret_1y);
    
    // Calculate quality score
    quality_raw = calculateQualityScore(qualityMetrics);

    const row = {
      ticker,
      name: etf.name || ticker,
      last_price_adj: lastPrice,
      ret_1y,
      ret_3y,
      ret_5y,
      ...dividendMetrics,
      ...riskMetrics,
      ...qualityMetrics,
      r4, r13, r26, r52,
      p4, p13, p26, p52,
      d1, d2, d3,
      trend_raw,
      income_raw,
      quality_raw,
      badge,
      badge_label,
      badge_color,
      last_date: new Date().toISOString().split('T')[0]
    };
    
    results.push(row);
  }

  if (results.length === 0) {
    console.warn('No usable data. Check tickers or data quality.');
    return [];
  }

  // Apply filters for income ETFs
  let filtered = applyIncomeFilters(results, options);
  console.log(`🔍 After filters: ${filtered.length}/${results.length} ETFs remaining`);

  if (filtered.length === 0) {
    console.warn('All ETFs filtered out. Relaxing constraints...');
    filtered = results;
  }

  // Calculate normalized scores (0-100)
  calculateNormalizedScores(filtered);

  // Calculate composite score
  const compositeWeights = options.compositeWeights || DEFAULT_COMPOSITE_WEIGHTS;
  filtered.forEach(etf => {
    etf.composite_score = 
      compositeWeights.income * (etf.income_score || 50) +
      compositeWeights.quality * (etf.quality_score || 50) +
      compositeWeights.risk_adjusted * (etf.risk_adjusted_score || 50) +
      compositeWeights.trend * (etf.trend_score || 50);
  });

  // Select scoring method
  const scoreField = getScoreField(options.scoreSource);

  // Sort by score
  const validResults = filtered.filter(r => r[scoreField] !== undefined && isFinite(r[scoreField]));
  if (validResults.length === 0) {
    console.warn('No tickers with valid scores.');
    return [];
  }

  validResults.sort((a, b) => b[scoreField] - a[scoreField]);

  // Select top K
  const topK = Math.max(1, Math.min(options.topK, validResults.length));
  const chosen = validResults.slice(0, topK);

  console.log(`📊 Selected top ${chosen.length} ETFs from ${validResults.length} candidates`);
  logTopHoldings(chosen, scoreField);

  // Build weights
  const weights = buildWeights(chosen, options.weighting, options.maxWeight, options.minWeight || 0.05);
  
  // Filter out zero weights
  const portfolio = createPortfolioPositions(chosen, weights, options);
  
  console.log(`✅ Portfolio built: ${portfolio.length} positions, total weight: ${(portfolio.reduce((s, e) => s + e.weight, 0) * 100).toFixed(1)}%`);
  logPortfolioMetrics(portfolio);

  return portfolio;
};

// ==================== DIVIDEND METRICS ====================

function extractDividendMetrics(etf: any): any {
  let dividend_yield = etf.dividend_yield || etf.dividendYield || etf.yield;
  let dividend_growth_1y = etf.dividend_growth_1y || etf.dividendGrowth1Y;
  let dividend_growth_3y = etf.dividend_growth_3y || etf.dividendGrowth3Y;
  let dividend_growth_5y = etf.dividend_growth_5y || etf.dividendGrowth5Y;
  let payout_ratio = etf.payout_ratio || etf.payoutRatio;
  
  // Convert percentages to decimals if needed
  if (dividend_yield && dividend_yield > 1) dividend_yield /= 100;
  if (dividend_growth_1y && dividend_growth_1y > 2) dividend_growth_1y /= 100;
  if (dividend_growth_3y && dividend_growth_3y > 2) dividend_growth_3y /= 100;
  if (dividend_growth_5y && dividend_growth_5y > 2) dividend_growth_5y /= 100;
  if (payout_ratio && payout_ratio > 2) payout_ratio /= 100;

  return {
    dividend_yield,
    dividend_growth_1y,
    dividend_growth_3y,
    dividend_growth_5y,
    payout_ratio,
    dividend_frequency: etf.dividend_frequency || 4,
    yield_on_cost_5y: etf.yield_on_cost_5y
  };
}

function calculateIncomeScore(metrics: any, ret_1y?: number): number {
  let score = 0;
  let weights = 0;

  // Current yield (40% weight) - most important for income
  if (metrics.dividend_yield && metrics.dividend_yield > 0) {
    score += 0.40 * metrics.dividend_yield * 100; // Scale to ~0-10 range
    weights += 0.40;
  }

  // Dividend growth 3y (25% weight)
  if (metrics.dividend_growth_3y !== undefined) {
    score += 0.25 * Math.max(0, metrics.dividend_growth_3y * 100);
    weights += 0.25;
  }

  // Dividend growth 1y (15% weight)
  if (metrics.dividend_growth_1y !== undefined) {
    score += 0.15 * Math.max(0, metrics.dividend_growth_1y * 100);
    weights += 0.15;
  }

  // Payout sustainability (20% weight) - penalize high payout ratios
  if (metrics.payout_ratio !== undefined && metrics.payout_ratio > 0) {
    const sustainability = metrics.payout_ratio < 0.60 ? 1.0 :
                          metrics.payout_ratio < 0.80 ? 0.7 :
                          metrics.payout_ratio < 1.00 ? 0.4 : 0.1;
    score += 0.20 * sustainability * 10;
    weights += 0.20;
  }

  // If we have no dividend data, use total return as proxy
  if (weights === 0 && ret_1y !== undefined) {
    score = Math.max(0, ret_1y * 100);
    weights = 1.0;
  }

  return weights > 0 ? score / weights : 0;
}

// ==================== RISK METRICS ====================

function calculateEnhancedRiskMetrics(etf: any, cachedDrip?: any): any {
  let vol_ann = etf.volatility || etf.vol_ann;
  let downside_deviation = etf.downside_deviation || etf.downsideDeviation;
  let max_drawdown = etf.max_drawdown || etf.maxDrawdown;
  let sharpe = etf.sharpe || etf.sharpeRatio;
  let sortino = etf.sortino || etf.sortinoRatio;

  // Convert percentages to decimals
  if (vol_ann && vol_ann > 2) vol_ann /= 100;
  if (downside_deviation && downside_deviation > 2) downside_deviation /= 100;
  if (max_drawdown && Math.abs(max_drawdown) > 2) max_drawdown /= 100;

  // Ensure max_drawdown is negative
  if (max_drawdown && max_drawdown > 0) max_drawdown = -max_drawdown;

  return {
    vol_ann,
    downside_deviation,
    max_drawdown,
    sharpe,
    sortino
  };
}

// ==================== QUALITY METRICS ====================

function extractQualityMetrics(etf: any): any {
  let expense_ratio = etf.expense_ratio || etf.expenseRatio || etf.fee;
  let aum = etf.aum || etf.totalAssets || etf.assetsUnderManagement;
  let avg_volume = etf.avg_volume || etf.avgVolume || etf.volume;
  let fund_age_years = etf.fund_age_years || etf.fundAge;

  // Convert expense ratio to decimal if needed
  if (expense_ratio && expense_ratio > 2) expense_ratio /= 100;

  // Convert AUM to millions if in other units
  if (aum && aum > 1e9) aum /= 1e6; // Convert from dollars to millions

  return {
    expense_ratio,
    aum,
    avg_volume,
    fund_age_years
  };
}

function calculateQualityScore(metrics: any): number {
  let score = 0;
  let weights = 0;

  // Low expense ratio (30% weight)
  if (metrics.expense_ratio !== undefined && metrics.expense_ratio >= 0) {
    const expenseScore = metrics.expense_ratio < 0.002 ? 10 :
                        metrics.expense_ratio < 0.005 ? 8 :
                        metrics.expense_ratio < 0.010 ? 6 :
                        metrics.expense_ratio < 0.020 ? 4 : 2;
    score += 0.30 * expenseScore;
    weights += 0.30;
  }

  // Large AUM (30% weight) - stability and liquidity
  if (metrics.aum !== undefined && metrics.aum > 0) {
    const aumScore = metrics.aum > 10000 ? 10 :
                    metrics.aum > 5000 ? 8 :
                    metrics.aum > 1000 ? 6 :
                    metrics.aum > 500 ? 4 : 2;
    score += 0.30 * aumScore;
    weights += 0.30;
  }

  // Fund maturity (25% weight)
  if (metrics.fund_age_years !== undefined && metrics.fund_age_years >= 0) {
    const ageScore = metrics.fund_age_years > 10 ? 10 :
                    metrics.fund_age_years > 5 ? 8 :
                    metrics.fund_age_years > 3 ? 6 :
                    metrics.fund_age_years > 1 ? 4 : 2;
    score += 0.25 * ageScore;
    weights += 0.25;
  }

  // Trading volume (15% weight) - liquidity
  if (metrics.avg_volume !== undefined && metrics.avg_volume > 0) {
    const volumeScore = metrics.avg_volume > 1000000 ? 10 :
                       metrics.avg_volume > 500000 ? 8 :
                       metrics.avg_volume > 100000 ? 6 :
                       metrics.avg_volume > 50000 ? 4 : 2;
    score += 0.15 * volumeScore;
    weights += 0.15;
  }

  return weights > 0 ? score / weights : 5; // Default to middle score
}

// ==================== TREND ANALYSIS ====================

function balancedTrendScore(r4: number, r13: number, r26: number, r52: number): {
  trend_raw: number;
  p4: number;
  p13: number;
  p26: number;
  p52: number;
  d1: number;
  d2: number;
  d3: number;
} {
  // Calculate periodic returns (weekly rates)
  const p4 = r4 / 4;
  const p13 = r13 / 13;
  const p26 = r26 / 26;
  const p52 = r52 / 52;

  // Calculate deltas (momentum)
  const d1 = p4 - p13;
  const d2 = p13 - p26;
  const d3 = p26 - p52;

  // Balanced weighting (less short-term focus for income ETFs)
  const base = 0.20 * p4 + 0.30 * p13 + 0.30 * p26 + 0.20 * p52;
  
  // Modest momentum bonus/penalty
  const pos = (x: number) => Math.max(0, x);
  const neg = (x: number) => Math.max(0, -x);
  
  const bonus = 0.50 * pos(d1) + 0.35 * pos(d2) + 0.25 * pos(d3);
  const penalty = 0.30 * (neg(d1) + neg(d2) + neg(d3));

  const trend_raw = base + bonus - penalty;

  return { trend_raw, p4, p13, p26, p52, d1, d2, d3 };
}

function trendBadge(d1: number, d2: number, d3: number): {
  badge: string;
  badge_label: string;
  badge_color: string;
} {
  const eps = 0.0005;
  const arrow = (d: number) => d > eps ? "↑" : d < -eps ? "↓" : "→";

  const arrows = [arrow(d1), arrow(d2), arrow(d3)];
  const badge = arrows.join("");
  const pos = arrows.filter(a => a === "↑").length;
  const neg = arrows.filter(a => a === "↓").length;

  let badge_label: string;
  let badge_color: string;

  if (pos === 3) {
    badge_label = "Strong momentum";
    badge_color = "green";
  } else if (pos >= 2 && neg === 0) {
    badge_label = "Positive momentum";
    badge_color = "lightgreen";
  } else if (neg === 3) {
    badge_label = "Weak momentum";
    badge_color = "red";
  } else if (neg >= 2 && pos === 0) {
    badge_label = "Declining";
    badge_color = "orange";
  } else {
    badge_label = "Stable";
    badge_color = "gray";
  }

  return { badge, badge_label, badge_color };
}

// ==================== FILTERING ====================

function applyIncomeFilters(etfs: any[], options: PortfolioOptions): any[] {
  return etfs.filter(etf => {
    // Minimum dividend yield
    if (options.minDividendYield && etf.dividend_yield) {
      if (etf.dividend_yield < options.minDividendYield) return false;
    }

    // Maximum expense ratio
    if (options.maxExpenseRatio && etf.expense_ratio) {
      if (etf.expense_ratio > options.maxExpenseRatio) return false;
    }

    // Maximum drawdown
    if (options.maxDrawdown && etf.max_drawdown) {
      if (Math.abs(etf.max_drawdown) > Math.abs(options.maxDrawdown)) return false;
    }

    // Minimum fund age
    if (options.minFundAge && etf.fund_age_years) {
      if (etf.fund_age_years < options.minFundAge) return false;
    }

    // Minimum AUM
    if (options.minAUM && etf.aum) {
      if (etf.aum < options.minAUM) return false;
    }

    return true;
  });
}

// ==================== SCORE NORMALIZATION ====================

function calculateNormalizedScores(etfs: any[]): void {
  // Trend scores
  const trendValues = etfs.map(e => e.trend_raw).filter(v => v !== undefined);
  const trendScores = scale0to100Safe(trendValues);
  let trendIdx = 0;
  etfs.forEach(e => {
    if (e.trend_raw !== undefined) {
      e.trend_score = trendScores[trendIdx++];
    } else {
      e.trend_score = 50;
    }
  });

  // Income scores
  const incomeValues = etfs.map(e => e.income_raw).filter(v => v !== undefined);
  const incomeScores = scale0to100Safe(incomeValues);
  let incomeIdx = 0;
  etfs.forEach(e => {
    if (e.income_raw !== undefined) {
      e.income_score = incomeScores[incomeIdx++];
    } else {
      e.income_score = 50;
    }
  });

  // Quality scores
  const qualityValues = etfs.map(e => e.quality_raw).filter(v => v !== undefined);
  const qualityScores = scale0to100Safe(qualityValues);
  let qualityIdx = 0;
  etfs.forEach(e => {
    if (e.quality_raw !== undefined) {
      e.quality_score = qualityScores[qualityIdx++];
    } else {
      e.quality_score = 50;
    }
  });

  // Risk-adjusted scores (using Sortino ratio if available, else Sharpe)
  etfs.forEach(e => {
    const riskMetric = e.sortino || e.sharpe;
    if (riskMetric !== undefined && isFinite(riskMetric)) {
      // Map Sortino/Sharpe to 0-100 scale
      // Typical range: -1 to 3, with >1 being good
      e.risk_adjusted_score = Math.max(0, Math.min(100, 50 + riskMetric * 20));
    } else {
      e.risk_adjusted_score = 50;
    }
  });
}

function scale0to100Safe(values: number[]): number[] {
  if (values.length === 0) return [];
  
  const validValues = values.filter(v => isFinite(v));
  if (validValues.length === 0) return values.map(() => 50);
  
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  
  if (max <= min) return values.map(() => 50);
  
  return values.map(v => {
    if (!isFinite(v)) return 50;
    return 100 * (v - min) / (max - min);
  });
}

// ==================== WEIGHTING ====================

function buildWeights(etfs: any[], method: WeightingMethod, maxWeight: number, minWeight: number): number[] {
  if (etfs.length === 0) return [];
  
  let baseWeights: number[];
  
  switch (method) {
    case 'equal':
      baseWeights = new Array(etfs.length).fill(1.0);
      break;
      
    case 'dividend_yield':
      baseWeights = etfs.map(e => Math.max(0, e.dividend_yield || 0));
      if (baseWeights.every(w => w === 0)) {
        baseWeights = new Array(etfs.length).fill(1.0);
      }
      break;
      
    case 'risk_parity':
      baseWeights = etfs.map(e => {
        const vol = e.downside_deviation || e.vol_ann;
        return (vol && vol > 0) ? 1.0 / vol : 0;
      });
      if (baseWeights.every(w => w === 0)) {
        baseWeights = new Array(etfs.length).fill(1.0);
      }
      break;

    case 'risk_adjusted':
      baseWeights = etfs.map(e => {
        const metric = e.sortino || e.sharpe || 0;
        return Math.max(0, metric);
      });
      if (baseWeights.every(w => w === 0)) {
        baseWeights = new Array(etfs.length).fill(1.0);
      }
      break;

    case 'quality_weighted':
      baseWeights = etfs.map(e => Math.max(0, e.quality_score || 50) / 100);
      break;
      
    default:
      baseWeights = new Array(etfs.length).fill(1.0);
  }
  
  return normalizeWeights(baseWeights, maxWeight, minWeight);
}

function normalizeWeights(weights: number[], maxWeight: number, minWeight: number): number[] {
  console.log(`🔧 Normalizing weights: min=${(minWeight * 100).toFixed(1)}%, max=${(maxWeight * 100).toFixed(1)}%`);
  
  let w = weights.map(x => Math.max(0, x));
  
  // Initial normalization
  let sum = w.reduce((a, b) => a + b, 0);
  if (sum === 0) return new Array(w.length).fill(1.0 / w.length);
  
  w = w.map(x => x / sum);
  
  // Apply constraints iteratively
  for (let iter = 0; iter < 20; iter++) {
    let changed = false;
    
    // Apply minimum weight to non-zero positions
    const nonZero = w.filter(x => x > 1e-6);
    if (nonZero.length > 0 && minWeight * nonZero.length <= 1.0) {
      w = w.map(x => {
        if (x > 1e-6 && x < minWeight) {
          changed = true;
          return minWeight;
        }
        return x;
      });
    }
    
    // Apply maximum weight cap
    const overMax = w.map(x => x > maxWeight);
    if (overMax.some(Boolean)) {
      changed = true;
      const excess = w.reduce((acc, x, i) => acc + (overMax[i] ? x - maxWeight : 0), 0);
      
      w = w.map((x, i) => overMax[i] ? maxWeight : x);
      
      // Redistribute excess proportionally to under-weight positions
      const underSum = w.reduce((acc, x, i) => acc + (overMax[i] ? 0 : x), 0);
      if (underSum > 0 && excess > 0) {
        w = w.map((x, i) => overMax[i] ? x : x + (x / underSum) * excess);
      }
    }
    
    // Renormalize
    sum = w.reduce((a, b) => a + b, 0);
    if (sum > 0) w = w.map(x => x / sum);
    
    if (!changed) break;
  }
  
  console.log(`✅ Normalized weights:`, w.map(x => (x * 100).toFixed(1) + '%').join(', '));
  return w;
}

// ==================== PORTFOLIO CONSTRUCTION ====================

function createPortfolioPositions(etfs: any[], weights: number[], options: PortfolioOptions): AIPortfolioETF[] {
  const positions: AIPortfolioETF[] = [];
  
  for (let i = 0; i < etfs.length; i++) {
    const weight = weights[i];
    if (weight < 0.001) continue; // Skip negligible weights
    
    const etf = etfs[i];
    const alloc_dollars = weight * options.capital;
    const shares = options.roundShares 
      ? Math.floor(alloc_dollars / etf.last_price_adj)
      : alloc_dollars / etf.last_price_adj;
    
    const alloc_dollars_rounded = shares * etf.last_price_adj;

    positions.push({
      ticker: etf.ticker,
      name: etf.name,
      weight,
      shares,
      alloc_dollars,
      alloc_dollars_rounded,
      current_price: etf.last_price_adj,
      last_date: etf.last_date,
      ret_1y: etf.ret_1y,
      ret_3y: etf.ret_3y,
      ret_5y: etf.ret_5y,
      dividend_yield: etf.dividend_yield,
      dividend_growth_1y: etf.dividend_growth_1y,
      dividend_growth_3y: etf.dividend_growth_3y,
      dividend_growth_5y: etf.dividend_growth_5y,
      payout_ratio: etf.payout_ratio,
      dividend_frequency: etf.dividend_frequency,
      vol_ann: etf.vol_ann,
      downside_deviation: etf.downside_deviation,
      max_drawdown: etf.max_drawdown,
      sharpe: etf.sharpe,
      sortino: etf.sortino,
      expense_ratio: etf.expense_ratio,
      aum: etf.aum,
      avg_volume: etf.avg_volume,
      fund_age_years: etf.fund_age_years,
      r4: etf.r4,
      r13: etf.r13,
      r26: etf.r26,
      r52: etf.r52,
      p4: etf.p4,
      p13: etf.p13,
      p26: etf.p26,
      p52: etf.p52,
      d1: etf.d1,
      d2: etf.d2,
      d3: etf.d3,
      trend_score: etf.trend_score,
      income_score: etf.income_score,
      quality_score: etf.quality_score,
      risk_adjusted_score: etf.risk_adjusted_score,
      composite_score: etf.composite_score,
      trend_raw: etf.trend_raw,
      income_raw: etf.income_raw,
      quality_raw: etf.quality_raw,
      badge: etf.badge,
      badge_label: etf.badge_label,
      badge_color: etf.badge_color,
      
      // Backward compatibility
      lastPrice: etf.last_price_adj,
      trendScore: etf.trend_score,
      allocRounded: alloc_dollars_rounded,
      allocationDollar: alloc_dollars,
      badgeLabel: etf.badge_label,
      badgeColor: etf.badge_color,
      isEstimated: !etf.dividend_yield && !etf.ret_1y,
      category: etf.category || 'Income ETF',
      exchange: etf.exchange || 'N/A'
    });
  }

  // Sort by weight descending
  positions.sort((a, b) => b.weight - a.weight);
  
  return positions;
}

// ==================== UTILITY FUNCTIONS ====================

function calculateReturn(etf: any, cachedDrip: any, period: '1y' | '3y' | '5y'): number | undefined {
  const fieldMap = {
    '1y': ['total_return_1y', 'totalReturn1Y', 'ret_1y'],
    '3y': ['total_return_3y', 'totalReturn3Y', 'ret_3y'],
    '5y': ['total_return_5y', 'totalReturn5Y', 'ret_5y']
  };
  
  const dripMap = {
    '1y': 'drip52wPercent',
    '3y': 'drip156wPercent',
    '5y': 'drip260wPercent'
  };

  // Try ETF data sources
  for (const field of fieldMap[period]) {
    let ret = etf[field];
    if (ret !== undefined && ret !== 0) {
      // Handle both decimal (0.25) and percentage (25) formats
      if (Math.abs(ret) > 5) ret /= 100;
      return ret;
    }
  }

  // Try DRIP cache
  if (cachedDrip?.[dripMap[period]]) {
    return cachedDrip[dripMap[period]] / 100;
  }

  return undefined;
}

function computeDripWindows(etf: any, cachedDrip?: any): {
  r4?: number;
  r13?: number;
  r26?: number;
  r52?: number;
} {
  if (cachedDrip) {
    return {
      r4: cachedDrip.drip4wPercent !== undefined ? cachedDrip.drip4wPercent / 100 : undefined,
      r13: cachedDrip.drip13wPercent !== undefined ? cachedDrip.drip13wPercent / 100 : undefined,
      r26: cachedDrip.drip26wPercent !== undefined ? cachedDrip.drip26wPercent / 100 : undefined,
      r52: cachedDrip.drip52wPercent !== undefined ? cachedDrip.drip52wPercent / 100 : undefined
    };
  }

  return {
    r4: etf.drip_4w !== undefined ? etf.drip_4w / 100 : undefined,
    r13: etf.drip_13w !== undefined ? etf.drip_13w / 100 : undefined,
    r26: etf.drip_26w !== undefined ? etf.drip_26w / 100 : undefined,
    r52: etf.drip_52w !== undefined ? etf.drip_52w / 100 : undefined
  };
}

function getScoreField(source: ScoreSource): string {
  const fieldMap = {
    trend: 'trend_score',
    income: 'income_score',
    quality: 'quality_score',
    risk_adjusted: 'risk_adjusted_score',
    composite: 'composite_score'
  };
  return fieldMap[source] || 'composite_score';
}

function logTopHoldings(etfs: any[], scoreField: string): void {
  console.log(`\n📈 Top ${Math.min(5, etfs.length)} Holdings by ${scoreField}:`);
  etfs.slice(0, 5).forEach((etf, i) => {
    const score = etf[scoreField]?.toFixed(1) || 'N/A';
    const yield_str = etf.dividend_yield ? `${(etf.dividend_yield * 100).toFixed(2)}%` : 'N/A';
    const badge_str = etf.badge || 'N/A';
    console.log(`  ${i + 1}. ${etf.ticker} - Score: ${score}, Yield: ${yield_str}, Trend: ${badge_str}`);
  });
}

function logPortfolioMetrics(portfolio: AIPortfolioETF[]): void {
  const totalAlloc = portfolio.reduce((s, e) => s + (e.alloc_dollars_rounded || 0), 0);
  const avgYield = portfolio.reduce((s, e) => s + (e.dividend_yield || 0) * e.weight, 0);
  const avgExpense = portfolio.reduce((s, e) => s + (e.expense_ratio || 0) * e.weight, 0);
  const avgQuality = portfolio.reduce((s, e) => s + (e.quality_score || 50) * e.weight, 0);
  
  console.log(`\n💼 Portfolio Metrics:`);
  console.log(`  Total Allocated: ${totalAlloc.toFixed(2)}`);
  console.log(`  Weighted Avg Yield: ${(avgYield * 100).toFixed(2)}%`);
  console.log(`  Weighted Avg Expense: ${(avgExpense * 100).toFixed(3)}%`);
  console.log(`  Weighted Avg Quality Score: ${avgQuality.toFixed(1)}/100`);
  console.log(`  Number of Holdings: ${portfolio.length}`);
  console.log(`  Largest Position: ${(Math.max(...portfolio.map(e => e.weight)) * 100).toFixed(1)}%`);
  console.log(`  Smallest Position: ${(Math.min(...portfolio.map(e => e.weight)) * 100).toFixed(1)}%`);
}

// ==================== EXPORTS ====================

export const PRESET_STRATEGIES = {
  conservative_income: {
    scoreSource: 'composite' as ScoreSource,
    weighting: 'dividend_yield' as WeightingMethod,
    compositeWeights: {
      income: 0.50,
      quality: 0.30,
      risk_adjusted: 0.15,
      trend: 0.05
    },
    minDividendYield: 0.03,
    maxExpenseRatio: 0.01,
    maxDrawdown: -0.20,
    minFundAge: 3
  },
  
  balanced_income: {
    scoreSource: 'composite' as ScoreSource,
    weighting: 'risk_adjusted' as WeightingMethod,
    compositeWeights: {
      income: 0.40,
      quality: 0.25,
      risk_adjusted: 0.25,
      trend: 0.10
    },
    minDividendYield: 0.02,
    maxExpenseRatio: 0.015,
    maxDrawdown: -0.30
  },
  
  growth_income: {
    scoreSource: 'composite' as ScoreSource,
    weighting: 'quality_weighted' as WeightingMethod,
    compositeWeights: {
      income: 0.30,
      quality: 0.20,
      risk_adjusted: 0.20,
      trend: 0.30
    },
    minDividendYield: 0.015,
    maxExpenseRatio: 0.02
  },
  
  high_yield: {
    scoreSource: 'income' as ScoreSource,
    weighting: 'dividend_yield' as WeightingMethod,
    compositeWeights: {
      income: 0.60,
      quality: 0.20,
      risk_adjusted: 0.10,
      trend: 0.10
    },
    minDividendYield: 0.04,
    maxExpenseRatio: 0.015
  }
};

// Helper to apply preset strategy
export function applyPresetStrategy(
  baseOptions: Partial<PortfolioOptions>,
  presetName: keyof typeof PRESET_STRATEGIES
): PortfolioOptions {
  const preset = PRESET_STRATEGIES[presetName];
  
  return {
    topK: 10,
    minTradingDays: 252,
    capital: 100000,
    roundShares: true,
    maxWeight: 0.25,
    minWeight: 0.05,
    ...preset,
    ...baseOptions
  } as PortfolioOptions;
}
