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
    // Ladder-Delta Trend Model
    // Convert to per-week returns
    const p4 = (drip4w[i] || 0) / 4;
    const p13 = (drip13w[i] || 0) / 13;
    const p26 = (drip26w[i] || 0) / 26;
    const p52 = (drip52w[i] || 0) / 52;
    
    // Calculate deltas (recent minus longer)
    const d1 = p4 - p13;
    const d2 = p13 - p26;
    const d3 = p26 - p52;
    
    // Calculate Ladder-Delta Trend score
    const baseScore = 0.60 * p4 + 0.25 * p13 + 0.10 * p26 + 0.05 * p52;
    const positiveDeltaBonus = 1.00 * Math.max(0, d1) + 0.70 * Math.max(0, d2) + 0.50 * Math.max(0, d3);
    const negativeDeltaPenalty = 0.50 * (Math.max(0, -d1) + Math.max(0, -d2) + Math.max(0, -d3));
    
    const compositeScore = baseScore + positiveDeltaBonus - negativeDeltaPenalty;
    
    // Debug logging for MSTY specifically
    if (d.ticker === 'MSTY') {
      console.log('🔍 MSTY Ladder-Delta Scoring:', {
        ticker: d.ticker,
        rawDrip: { drip4w: drip4w[i], drip13w: drip13w[i], drip26w: drip26w[i], drip52w: drip52w[i] },
        perWeek: { p4, p13, p26, p52 },
        deltas: { d1, d2, d3 },
        scoring: { baseScore, positiveDeltaBonus, negativeDeltaPenalty, compositeScore }
      });
    }
    
    // Keep dripSumScore for compatibility
    const dripSumScore = (drip4w[i] || 0) + (drip13w[i] || 0) + (drip26w[i] || 0) + (drip52w[i] || 0);

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
