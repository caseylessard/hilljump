import { ETF } from "@/data/etfs";
import type { LivePrice } from "@/lib/live";
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
  drip12wNorm: number;
  drip52wNorm: number;
  dripWeightedNorm: number;
  // Signal derived from DRIP momentum
  buySignal: boolean;
  riskScore: number;     // 0..1 higher = riskier
  compositeScore: number; // higher is better
};

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

function minMax(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return { min, max, span };
}

export function scoreETFs(data: ETF[], weights: Weights, live?: Record<string, LivePrice>): ScoredETF[] {
  const wSum = weights.return + weights.yield + weights.risk || 1;
  const w = {
    r: weights.return / wSum,
    y: weights.yield / wSum,
    k: weights.risk / wSum,
  };

  const retStats = minMax(data.map(d => d.totalReturn1Y));
  const yStats = minMax(data.map(d => d.yieldTTM));
  const volStats = minMax(data.map(d => d.volatility1Y));
  const ddStats = minMax(data.map(d => d.maxDrawdown1Y)); // negative numbers
  const expStats = minMax(data.map(d => d.expenseRatio));
  const volmStats = minMax(data.map(d => d.avgVolume));
  const aumStats = minMax(data.map(d => d.aum));

  // Prepare DRIP percent arrays (fallback to approximations from 1Y return if live not available)
  const approx = (annualPct: number, days: number) => {
    const daily = Math.pow(1 + annualPct / 100, 1 / 365) - 1;
    return (Math.pow(1 + daily, days) - 1) * 100;
  };

  const drip4wPercents = data.map(d => {
    const lp = live?.[d.ticker];
    return lp?.drip4wPercent ?? approx(d.totalReturn1Y, 28);
  });
  const drip12wPercents = data.map(d => {
    const lp = live?.[d.ticker];
    return lp?.drip12wPercent ?? approx(d.totalReturn1Y, 90);
  });
  const drip52wPercents = data.map(d => {
    const lp = live?.[d.ticker];
    return lp?.drip52wPercent ?? approx(d.totalReturn1Y, 365);
  });

  const drip4wStats = minMax(drip4wPercents);
  const drip12wStats = minMax(drip12wPercents);
  const drip52wStats = minMax(drip52wPercents);

  const scored = data.map((d, idx) => {
    const returnNorm = (d.totalReturn1Y - retStats.min) / retStats.span;
    const yieldNorm = (d.yieldTTM - yStats.min) / yStats.span;
    const volNormRaw = (d.volatility1Y - volStats.min) / volStats.span; // higher = worse
    const drawdownNormRaw = (d.maxDrawdown1Y - ddStats.min) / ddStats.span; // less negative (higher) = better; we want worse risk positive
    const drawdownRisk = 1 - drawdownNormRaw; // higher drawdown => higher risk
    const expenseNormRaw = (d.expenseRatio - expStats.min) / expStats.span; // higher = worse
    const volumeNorm = (d.avgVolume - volmStats.min) / volmStats.span; // higher = better
    const aumNorm = (d.aum - aumStats.min) / aumStats.span; // higher = better

    // DRIP normals (favor 12W > 4W > 52W)
    const drip4wRaw = drip4wPercents[idx];
    const drip12wRaw = drip12wPercents[idx];
    const drip52wRaw = drip52wPercents[idx];
    const drip4wNorm = (drip4wRaw - drip4wStats.min) / drip4wStats.span;
    const drip12wNorm = (drip12wRaw - drip12wStats.min) / drip12wStats.span;
    const drip52wNorm = (drip52wRaw - drip52wStats.min) / drip52wStats.span;
    const dripWeightedNorm = clamp(0.6 * drip12wNorm + 0.3 * drip4wNorm + 0.1 * drip52wNorm);

    // Risk components: high volatility, high expense, deep drawdown, low volume
    const riskScore = clamp(
      0.35 * volNormRaw +
      0.25 * expenseNormRaw +
      0.25 * drawdownRisk +
      0.15 * (1 - volumeNorm)
    );

    // Buy/Sell signal boost based on DRIP momentum
    const buySignal = (drip12wRaw ?? 0) > 0 && (drip4wRaw ?? 0) > 0;
    const signalBoost = buySignal ? 0.05 : -0.05;

    // Composite score prioritizing DRIP momentum while honoring weights controls
    const compositeScore = clamp(
      0.85 * (w.r * dripWeightedNorm + w.y * yieldNorm - w.k * riskScore) +
      0.15 * aumNorm +
      signalBoost
    );

    return {
      ...d,
      returnNorm,
      yieldNorm,
      volumeNorm,
      aumNorm,
      expenseNorm: expenseNormRaw,
      volNorm: volNormRaw,
      drawdownNorm: drawdownNormRaw,
      drip4wNorm,
      drip12wNorm,
      drip52wNorm,
      dripWeightedNorm,
      buySignal,
      riskScore,
      compositeScore,
    };
  });

  return scored.sort((a, b) => b.compositeScore - a.compositeScore);
}
