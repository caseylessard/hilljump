// AI Portfolio building logic with Ladder-Delta Trend and Past Performance scoring
// Translated from Python script methodology

export interface AIPortfolioETF {
  ticker: string;
  name: string;
  weight: number;
  shares?: number;
  alloc_dollars?: number;
  alloc_dollars_rounded?: number;
  current_price: number;
  last_date: string;
  ret_1y?: number;
  trend_score: number;
  pastperf_score?: number;
  blend_score?: number;
  ret1y_score?: number;
  badge?: string;
  badge_label?: string;
  badge_color?: string;
  vol_ann?: number;
  max_drawdown?: number;
  sharpe?: number;
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
  trend_raw?: number;
  pastperf_raw?: number;
  obs?: number;
  pw_0_4?: number;
  pw_5_13?: number;
  pw_14_26?: number;
  pw_27_52?: number;
  
  // Backward compatibility properties
  lastPrice?: number;
  trendScore?: number;
  ret1yScore?: number;
  allocRounded?: number;
  allocationDollar?: number;
  badgeLabel?: string;
  badgeColor?: string;
  isEstimated?: boolean;
  category?: string;
  exchange?: string;
}

export type WeightingMethod = 'equal' | 'return' | 'risk_parity';
export type ScoreSource = 'trend' | 'ret1y' | 'pastperf' | 'blend';
export type PastPerfMode = 'equal' | 'time';

// Trading days per period (weeks * 5 approximately)
const WIN = { r4: 20, r13: 65, r26: 130, r52: 260 };

export const buildAIPortfolio = async (
  etfs: any[], 
  prices: Record<string, any>,
  options: {
    topK: number;
    minTradingDays: number;
    scoreSource: ScoreSource;
    weighting: WeightingMethod;
    maxWeight: number;
    capital: number;
    roundShares: boolean;
    pastperfMode?: PastPerfMode;
  },
  dripData?: Record<string, any>
): Promise<AIPortfolioETF[]> => {
  console.log(`🎯 Building AI portfolio with ${etfs.length} ETFs, source: ${options.scoreSource}, weighting: ${options.weighting}`);

  if (etfs.length === 0) {
    console.warn('No ETFs provided to buildAIPortfolio');
    return [];
  }

  const results: any[] = [];
  const pastperfMode = options.pastperfMode || 'equal';

  // Process each ETF
  for (const etf of etfs) {
    const ticker = etf.ticker;
    const priceData = prices[ticker];
    const cachedDrip = dripData?.[ticker];
    
    // Skip ETFs without sufficient data
    if (!priceData && !cachedDrip) {
      continue;
    }

    const lastPrice = priceData?.price || etf.current_price || 0;
    if (lastPrice <= 0) continue;

    // Calculate 1-year return
    const ret1y = calculateOneYearReturn(etf, cachedDrip);
    
    // Calculate risk metrics
    const { vol_ann, max_drawdown, sharpe } = calculateRiskMetrics(etf, cachedDrip);

    // Calculate DRIP windows (r4, r13, r26, r52)
    let r4: number | undefined, r13: number | undefined, r26: number | undefined, r52: number | undefined;
    let trend_raw: number | undefined, pastperf_raw: number | undefined;
    let p4: number | undefined, p13: number | undefined, p26: number | undefined, p52: number | undefined;
    let d1: number | undefined, d2: number | undefined, d3: number | undefined;
    let badge: string | undefined, badge_label: string | undefined, badge_color: string | undefined;
    let pp_rungs: Record<string, number> = {};

    try {
      ({ r4, r13, r26, r52 } = computeDripWindows(etf, cachedDrip));
      
      if (r4 !== undefined && r13 !== undefined && r26 !== undefined && r52 !== undefined) {
        // Calculate trend score using Ladder-Delta methodology
        ({ trend_raw, p4, p13, p26, p52, d1, d2, d3 } = ladderTrendRaw(r4, r13, r26, r52));
        
        // Calculate badge from deltas
        ({ badge, badge_label, badge_color } = ladderBadge(d1!, d2!, d3!));
        
        // Calculate past performance score using non-overlapping rungs
        ({ pastperf_raw, pp_rungs } = pastperfFlatFromRungs(r4, r13, r26, r52, pastperfMode));
      }
    } catch (error) {
      console.warn(`Failed to calculate scores for ${ticker}:`, error);
    }

    const row = {
      ticker,
      name: etf.name || ticker,
      last_price_adj: lastPrice,
      ret_1y: ret1y,
      r4, r13, r26, r52,
      p4, p13, p26, p52,
      d1, d2, d3,
      trend_raw,
      pastperf_raw,
      badge,
      badge_label,
      badge_color,
      vol_ann,
      max_drawdown,
      sharpe,
      obs: 252, // Assume full year of data
      last_date: new Date().toISOString().split('T')[0],
      ...pp_rungs // Include rung weekly rates
    };
    
    results.push(row);
  }

  if (results.length === 0) {
    console.warn('No usable data. Check tickers or lookback.');
    return [];
  }

  // Calculate normalized scores (0-100)
  const trend_scores = results.map(r => r.trend_raw).filter(x => x !== undefined);
  const ret1y_scores = results.map(r => r.ret_1y).filter(x => x !== undefined);  
  const pastperf_scores = results.map(r => r.pastperf_raw).filter(x => x !== undefined);

  // Apply scaling
  const trend_score_map = scaleSafe(trend_scores);
  const ret1y_score_map = scaleSafe(ret1y_scores);
  const pastperf_score_map = scaleSafe(pastperf_scores);

  // Add scores to results
  results.forEach((result, i) => {
    const trendIdx = trend_scores.findIndex((_, idx) => results.filter(r => r.trend_raw !== undefined)[idx] === result);
    const ret1yIdx = ret1y_scores.findIndex((_, idx) => results.filter(r => r.ret_1y !== undefined)[idx] === result);
    const pastperfIdx = pastperf_scores.findIndex((_, idx) => results.filter(r => r.pastperf_raw !== undefined)[idx] === result);

    result.trend_score = trendIdx >= 0 ? trend_score_map[trendIdx] : 50;
    result.ret1y_score = ret1yIdx >= 0 ? ret1y_score_map[ret1yIdx] : 50;
    result.pastperf_score = pastperfIdx >= 0 ? pastperf_score_map[pastperfIdx] : 50;
    result.blend_score = 0.70 * result.trend_score + 0.30 * result.ret1y_score;
  });

  // Choose score source for ranking
  const scoreField = {
    trend: 'trend_score',
    ret1y: 'ret1y_score', 
    pastperf: 'pastperf_score',
    blend: 'blend_score'
  }[options.scoreSource];

  // Filter valid results and sort by score
  const validResults = results.filter(r => r[scoreField] !== undefined);
  if (validResults.length === 0) {
    console.warn('No tickers with valid scores.');
    return [];
  }

  validResults.sort((a, b) => b[scoreField] - a[scoreField]);

  // Select top K
  const topK = Math.max(1, Math.min(options.topK, validResults.length));
  const chosen = validResults.slice(0, topK);

  console.log(`📊 Selected top ${chosen.length} ETFs from ${validResults.length} candidates`);

  // Build weights
  const weights = buildWeights(chosen, options.weighting, options.maxWeight);
  
  // Create portfolio ETFs with allocations
  const portfolioETFs: AIPortfolioETF[] = chosen.map((etf, i) => {
    const weight = weights[i];
    const alloc_dollars = weight * options.capital;
    const shares = options.roundShares 
      ? Math.floor(alloc_dollars / etf.last_price_adj)
      : alloc_dollars / etf.last_price_adj;
    
    const alloc_dollars_rounded = shares * etf.last_price_adj;

    return {
      ticker: etf.ticker,
      name: etf.name,
      weight,
      shares,
      alloc_dollars,
      alloc_dollars_rounded,
      current_price: etf.last_price_adj,
      last_date: etf.last_date,
      ret_1y: etf.ret_1y,
      trend_score: etf.trend_score,
      pastperf_score: etf.pastperf_score,
      blend_score: etf.blend_score,
      ret1y_score: etf.ret1y_score,
      badge: etf.badge,
      badge_label: etf.badge_label,
      badge_color: etf.badge_color,
      vol_ann: etf.vol_ann,
      max_drawdown: etf.max_drawdown,
      sharpe: etf.sharpe,
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
      trend_raw: etf.trend_raw,
      pastperf_raw: etf.pastperf_raw,
      obs: etf.obs,
      pw_0_4: etf.pw_0_4,
      pw_5_13: etf.pw_5_13,
      pw_14_26: etf.pw_14_26,
      pw_27_52: etf.pw_27_52,
      
      // Backward compatibility properties
      lastPrice: etf.last_price_adj,
      trendScore: etf.trend_score,
      ret1yScore: etf.ret1y_score,
      allocRounded: alloc_dollars_rounded,
      allocationDollar: alloc_dollars,
      badgeLabel: etf.badge_label,
      badgeColor: etf.badge_color,
      isEstimated: !etf.ret_1y || (!etf.trend_raw && !etf.pastperf_raw),
      category: etf.category || 'ETF',
      exchange: etf.exchange || 'N/A'
    };
  });

  const totalWeight = portfolioETFs.reduce((sum, etf) => sum + etf.weight, 0);
  console.log(`✅ Portfolio built: ${portfolioETFs.length} positions, total weight: ${(totalWeight * 100).toFixed(1)}%`);

  return portfolioETFs;
};

// Helper functions

function calculateOneYearReturn(etf: any, cachedDrip?: any): number | undefined {
  // Try multiple sources for 1-year return
  let ret1y = etf.total_return_1y || etf.totalReturn1Y || etf.totalReturn;
  
  if (ret1y && ret1y !== 0) {
    // Handle both decimal (0.25) and percentage (25) formats
    if (Math.abs(ret1y) > 5) {
      ret1y = ret1y / 100; // Convert percentage to decimal
    }
    return ret1y;
  }

  // Fallback to DRIP 52w data
  if (cachedDrip?.drip52wPercent) {
    return cachedDrip.drip52wPercent / 100; // Convert to decimal
  }

  if (etf.drip_52w) {
    return etf.drip_52w / 100; // Convert to decimal
  }

  return undefined;
}

function calculateRiskMetrics(etf: any, cachedDrip?: any): { vol_ann?: number; max_drawdown?: number; sharpe?: number } {
  // Try to get volatility and risk metrics from ETF data
  let vol_ann = etf.volatility || etf.vol_ann;
  let max_drawdown = etf.max_drawdown;
  let sharpe = etf.sharpe;

  // Convert percentages to decimals if needed
  if (vol_ann && vol_ann > 5) {
    vol_ann = vol_ann / 100;
  }
  if (max_drawdown && max_drawdown > 0) {
    max_drawdown = max_drawdown / 100;
  }

  return { vol_ann, max_drawdown, sharpe };
}

function computeDripWindows(etf: any, cachedDrip?: any): { r4?: number; r13?: number; r26?: number; r52?: number } {
  // Use cached DRIP data if available
  if (cachedDrip) {
    return {
      r4: cachedDrip.drip4wPercent ? cachedDrip.drip4wPercent / 100 : undefined,
      r13: cachedDrip.drip13wPercent ? cachedDrip.drip13wPercent / 100 : undefined,  
      r26: cachedDrip.drip26wPercent ? cachedDrip.drip26wPercent / 100 : undefined,
      r52: cachedDrip.drip52wPercent ? cachedDrip.drip52wPercent / 100 : undefined
    };
  }

  // Fallback to ETF object DRIP data
  return {
    r4: etf.drip_4w ? etf.drip_4w / 100 : undefined,
    r13: etf.drip_13w ? etf.drip_13w / 100 : undefined,
    r26: etf.drip_26w ? etf.drip_26w / 100 : undefined,
    r52: etf.drip_52w ? etf.drip_52w / 100 : undefined
  };
}

function ladderTrendRaw(r4: number, r13: number, r26: number, r52: number, eps: number = 0.0): {
  trend_raw: number;
  p4: number;
  p13: number; 
  p26: number;
  p52: number;
  d1: number;
  d2: number;
  d3: number;
} {
  // Calculate periodic returns (per-period rates)
  const p4 = r4 / 4;
  const p13 = r13 / 13;
  const p26 = r26 / 26;
  const p52 = r52 / 52;

  // Calculate deltas (momentum differences)
  const d1 = p4 - p13;
  const d2 = p13 - p26;
  const d3 = p26 - p52;

  // Utility functions
  const pos = (x: number) => Math.max(0.0, x - eps);
  const neg = (x: number) => Math.max(0.0, -x - eps);

  // Calculate trend score
  const base = 0.60 * p4 + 0.25 * p13 + 0.10 * p26 + 0.05 * p52;
  const bonus = 1.00 * pos(d1) + 0.70 * pos(d2) + 0.50 * pos(d3);
  const penalty = 0.50 * (neg(d1) + neg(d2) + neg(d3));

  const trend_raw = base + bonus - penalty;

  return { trend_raw, p4, p13, p26, p52, d1, d2, d3 };
}

function ladderBadge(d1: number, d2: number, d3: number, eps: number = 0.0005): {
  badge: string;
  badge_label: string;
  badge_color: string;
} {
  const arrow = (d: number) => {
    if (d > eps) return "↑";
    if (d < -eps) return "↓";
    return "↔";
  };

  const arrows = [arrow(d1), arrow(d2), arrow(d3)];
  const badge = arrows.join("");
  const pos = arrows.filter(a => a === "↑").length;
  const neg = arrows.filter(a => a === "↓").length;

  let badge_label: string;
  let badge_color: string;

  if (pos === 3) {
    badge_label = "Strong uptrend";
    badge_color = "green";
  } else if (pos === 2 && neg === 0) {
    badge_label = "Uptrend (moderate)";
    badge_color = "green";
  } else if (neg === 3) {
    badge_label = "Strong downtrend";
    badge_color = "red";
  } else if (neg === 2 && pos === 0) {
    badge_label = "Downtrend (moderate)";
    badge_color = "red";
  } else {
    badge_label = "Mixed / choppy";
    badge_color = "yellow";
  }

  return { badge, badge_label, badge_color };
}

function weeklyCagr(r: number, weeks: number): number {
  // (1+R)^(1/weeks) - 1; safe for R >= -1
  if (r <= -1.0) return -1.0;
  return Math.pow(1.0 + r, 1.0 / weeks) - 1.0;
}

function pastperfFlatFromRungs(r4: number, r13: number, r26: number, r52: number, mode: PastPerfMode = 'equal'): {
  pastperf_raw: number;
  pp_rungs: Record<string, number>;
} {
  // Split year into non-overlapping rungs: [0-4w], [5-13w], [14-26w], [27-52w]
  const g4 = 1 + r4;
  const g13 = 1 + r13;
  const g26 = 1 + r26;
  const g52 = 1 + r52;

  const g_0_4 = g4;
  const g_5_13 = g13 / g4;
  const g_14_26 = g26 / g13;
  const g_27_52 = g52 / g26;

  const r_0_4 = g_0_4 - 1.0;
  const r_5_13 = g_5_13 - 1.0;
  const r_14_26 = g_14_26 - 1.0;
  const r_27_52 = g_27_52 - 1.0;

  const weeks = [4, 9, 13, 26];
  const pw = [
    weeklyCagr(r_0_4, 4),
    weeklyCagr(r_5_13, 9),
    weeklyCagr(r_14_26, 13),
    weeklyCagr(r_27_52, 26)
  ];

  const pp_rungs = {
    pw_0_4: pw[0],
    pw_5_13: pw[1],
    pw_14_26: pw[2],
    pw_27_52: pw[3]
  };

  // Calculate score based on mode
  let pastperf_raw: number;
  if (mode === 'time') {
    // Time-weighted average
    const totalWeeks = weeks.reduce((sum, w) => sum + w, 0);
    pastperf_raw = pw.reduce((sum, p, i) => sum + p * weeks[i], 0) / totalWeeks;
  } else {
    // Equal-weighted average
    pastperf_raw = pw.reduce((sum, p) => sum + p, 0) / pw.length;
  }

  return { pastperf_raw, pp_rungs };
}

function scale0to100(values: number[]): number[] {
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

function scaleSafe(values: number[]): number[] {
  // Replace infinities with NaN, then fill NaN with min value
  const safeValues = values.map(v => isFinite(v) ? v : NaN);
  const validValues = safeValues.filter(v => !isNaN(v));
  
  if (validValues.length === 0) {
    return safeValues.map(() => 50);
  }
  
  const fillValue = Math.min(...validValues);
  const filledValues = safeValues.map(v => isNaN(v) ? fillValue : v);
  
  return scale0to100(filledValues);
}

function capAndNormalize(weights: number[], maxWeight?: number): number[] {
  let w = [...weights];
  
  // Set negative weights to 0
  w = w.map(weight => Math.max(0, weight));
  
  // Handle all-zero case
  const sum = w.reduce((acc, weight) => acc + weight, 0);
  if (sum === 0) {
    return new Array(w.length).fill(1.0 / w.length);
  }
  
  // Normalize
  w = w.map(weight => weight / sum);
  
  // Apply max weight cap if specified
  if (maxWeight !== undefined && maxWeight > 0 && maxWeight < 1) {
    for (let iter = 0; iter < 10; iter++) {
      const over = w.map(weight => weight > maxWeight);
      const hasOver = over.some(Boolean);
      
      if (!hasOver) break;
      
      const excess = w.reduce((acc, weight, i) => 
        acc + (over[i] ? weight - maxWeight : 0), 0);
      
      // Cap overweight positions
      w = w.map((weight, i) => over[i] ? maxWeight : weight);
      
      // Redistribute excess to underweight positions
      const underWeights = w.filter((_, i) => !over[i]);
      const underSum = underWeights.reduce((acc, weight) => acc + weight, 0);
      
      if (underSum <= 0 || excess <= 0) break;
      
      w = w.map((weight, i) => 
        over[i] ? weight : weight + (weight / underSum) * excess);
    }
    
    // Final normalization
    const finalSum = w.reduce((acc, weight) => acc + weight, 0);
    if (finalSum > 0) {
      w = w.map(weight => weight / finalSum);
    }
  }
  
  return w;
}

function buildWeights(etfs: any[], method: WeightingMethod, maxWeight?: number): number[] {
  if (etfs.length === 0) return [];
  
  let baseWeights: number[];
  
  switch (method.toLowerCase()) {
    case 'equal':
      baseWeights = new Array(etfs.length).fill(1.0);
      break;
      
    case 'return':
      baseWeights = etfs.map(etf => Math.max(0, etf.ret_1y || 0));
      if (baseWeights.every(w => w === 0)) {
        baseWeights = new Array(etfs.length).fill(1.0);
      }
      break;
      
    case 'risk_parity':
    case 'inverse_vol':
      baseWeights = etfs.map(etf => {
        const vol = etf.vol_ann;
        if (!vol || vol <= 0) return 0;
        return 1.0 / vol;
      });
      if (baseWeights.every(w => w === 0)) {
        baseWeights = new Array(etfs.length).fill(1.0);
      }
      break;
      
    default:
      throw new Error(`Unknown weighting method: ${method}`);
  }
  
  return capAndNormalize(baseWeights, maxWeight);
}