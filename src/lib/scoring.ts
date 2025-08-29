import { ETF } from "@/data/etfs";
import type { LivePrice } from "@/lib/live";
import type { RankingPrefs } from "@/lib/rankingPresets";
import { presets } from "@/lib/rankingPresets";

export type Weights = {
  return: number; // 0..1
  yield: number;  // 0..1
  risk: number;   // 0..1
};

export type ScoredETF = ETF & {
  returnNorm: number;
  yieldNorm: number;
  volumeNorm: number;
  aumNorm: number;
  expenseNorm: number;
  volNorm: number;
  drawdownNorm: number;
  // DRIP-normalized scores (0..1)
    drip4wNorm: number;
    drip13wNorm: number;
    drip26wNorm: number;
    drip52wNorm: number;
  dripWeightedNorm: number;
  dripSumScore: number; // Sum of 4w+13w+26w+52w percentages
  // Signal derived from DRIP momentum
  buySignal: boolean;
  riskScore: number;      // 0..1 higher = riskier
  compositeScore: number; // higher is better
};

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const safe = (n: number | undefined | null, fallback = 0) => (Number.isFinite(n as number) ? (n as number) : fallback);

// ---------- Utility ----------
function approxPeriodFromAnnual(annualPct: number, days: number) {
  const daily = Math.pow(1 + safe(annualPct, 0) / 100, 1 / 365) - 1;
  return (Math.pow(1 + daily, days) - 1) * 100;
}

// ---------- Simplified DRIP-only scoring ----------
export function scoreETFsWithPrefs(
  data: ETF[],
  prefs: RankingPrefs,
  live?: Record<string, LivePrice>,
  dripData?: Record<string, any>,
  options?: {
    homeCountry?: string;   // e.g., 'CA', 'US'
    currency?: string;      // e.g., 'USD', 'CAD'
  }
): ScoredETF[] {
  
  const returns1y = data.map(d => safe(d.totalReturn1Y, 0));
  
  // DRIP perf (prefer cached, then live; else approximate from 1y)
  const drip4w = data.map((d, i) => {
    const cachedDrip = dripData?.[d.ticker];
    if (cachedDrip && typeof cachedDrip.drip4wPercent === 'number') {
      return cachedDrip.drip4wPercent;
    }
    const lp = live?.[d.ticker];
    return safe(lp?.drip4wPercent, approxPeriodFromAnnual(returns1y[i], 28));
  });
  const drip13w = data.map((d, i) => {
    const cachedDrip = dripData?.[d.ticker];
    if (cachedDrip && typeof cachedDrip.drip13wPercent === 'number') {
      return cachedDrip.drip13wPercent;
    }
    const lp = live?.[d.ticker];
    return safe(lp?.drip13wPercent, approxPeriodFromAnnual(returns1y[i], 91));
  });
  const drip26w = data.map((d, i) => {
    const cachedDrip = dripData?.[d.ticker];
    if (cachedDrip && typeof cachedDrip.drip26wPercent === 'number') {
      return cachedDrip.drip26wPercent;
    }
    const lp = live?.[d.ticker];
    return safe(lp?.drip26wPercent, approxPeriodFromAnnual(returns1y[i], 182));
  });
  const drip52w = data.map((d, i) => {
    const cachedDrip = dripData?.[d.ticker];
    if (cachedDrip && typeof cachedDrip.drip52wPercent === 'number') {
      return cachedDrip.drip52wPercent;
    }
    const lp = live?.[d.ticker];
    return safe(lp?.drip52wPercent, approxPeriodFromAnnual(returns1y[i], 365));
  });

  const scored = data.map((d, i) => {
    // Calculate per-week returns for each horizon
    const t = [4, 13, 26, 52]; // time horizons
    const p = [
      (drip4w[i] || 0) / 4,    // r4/4
      (drip13w[i] || 0) / 13,  // r13/13
      (drip26w[i] || 0) / 26,  // r26/26
      (drip52w[i] || 0) / 52   // r52/52
    ];
    
    // Calculate OLS slope: m = cov(t,p)/var(t)
    const t_mean = t.reduce((sum, val) => sum + val, 0) / t.length;
    const p_mean = p.reduce((sum, val) => sum + val, 0) / p.length;
    
    let covariance = 0;
    let variance = 0;
    
    for (let j = 0; j < t.length; j++) {
      const t_diff = t[j] - t_mean;
      const p_diff = p[j] - p_mean;
      covariance += t_diff * p_diff;
      variance += t_diff * t_diff;
    }
    
    const slope = variance > 0 ? covariance / variance : 0;
    
    // Trend score: -m (bigger is better, inverts negative slope)
    let trendScore = -slope;
    
    // Optional tie-breaker: add 0.25 * p4 (4-week per-week return)
    trendScore += 0.25 * p[0];
    
    // Sum of all DRIP percentages for backward compatibility
    const dripSumScore = (drip4w[i] || 0) + (drip13w[i] || 0) + (drip26w[i] || 0) + (drip52w[i] || 0);
    
    // Composite score is now the trend score
    const compositeScore = trendScore;

    // Keep normalized values for compatibility (set to defaults)
    const returnNorm = 0.5;
    const yieldNormRaw = 0.5;
    const volNormRaw = 0.5;
    const mddNormRaw = 0.5;
    const expenseNormRaw = 0.5;
    const volumeNorm = 0.5;
    const aumNorm = 0.5;
    const drip4wNorm = 0.5;
    const drip13wNorm = 0.5;
    const drip26wNorm = 0.5;
    const drip52wNorm = 0.5;
    const dripWeightedNorm = 0.5;
    
    // Simple buy signal based on positive DRIP momentum
    const buySignal = (drip13w[i] ?? 0) > 0 && (drip4w[i] ?? 0) > 0;
    
    // Risk score (neutral since we're not using it)
    const riskScore = 0.5;

    return {
      ...d,
      returnNorm,
      yieldNorm: yieldNormRaw,
      volumeNorm,
      aumNorm,
      expenseNorm: expenseNormRaw,
      volNorm: volNormRaw,
      drawdownNorm: mddNormRaw,
      drip4wNorm,
      drip13wNorm,
      drip26wNorm,
      drip52wNorm,
      dripWeightedNorm,
      dripSumScore,
      buySignal,
      riskScore,
      compositeScore,
    };
  });

  return scored.sort((a, b) => b.compositeScore - a.compositeScore);
}

// ---------- Back-compat wrapper using the old 3-slider weights ----------
// Chooses a preset from weights (return -> total_return, yield -> income_first, else balanced).
// You can pass options.homeCountry / options.currency to enable those modifiers.
export function scoreETFs(
  data: ETF[],
  weights: Weights,
  live?: Record<string, LivePrice>,
  dripData?: Record<string, any>,
  options?: { homeCountry?: string; currency?: string }
): ScoredETF[] {
  const r = safe(weights.return, 0);
  const y = safe(weights.yield, 0);
  const k = safe(weights.risk, 0);
  const max = Math.max(r, y, k);

  let chosen: RankingPrefs;
  if (max === r) chosen = presets.total_return;
  else if (max === y) chosen = presets.income_first;
  else chosen = presets.balanced;

  return scoreETFsWithPrefs(data, chosen, live, dripData, options);
}
