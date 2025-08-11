import { ETF } from "@/data/etfs";

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

export function scoreETFs(data: ETF[], weights: Weights): ScoredETF[] {
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

  const scored = data.map(d => {
    const returnNorm = (d.totalReturn1Y - retStats.min) / retStats.span;
    const yieldNorm = (d.yieldTTM - yStats.min) / yStats.span;
    const volNormRaw = (d.volatility1Y - volStats.min) / volStats.span; // higher = worse
    const drawdownNormRaw = (d.maxDrawdown1Y - ddStats.min) / ddStats.span; // less negative (higher) = better; we want worse risk positive
    const drawdownRisk = 1 - drawdownNormRaw; // higher drawdown => higher risk
    const expenseNormRaw = (d.expenseRatio - expStats.min) / expStats.span; // higher = worse
    const volumeNorm = (d.avgVolume - volmStats.min) / volmStats.span; // higher = better
    const aumNorm = (d.aum - aumStats.min) / aumStats.span; // higher = better
    // Risk components: high volatility, high expense, deep drawdown, low volume
    const riskScore = clamp(
      0.35 * volNormRaw +
      0.25 * expenseNormRaw +
      0.25 * drawdownRisk +
      0.15 * (1 - volumeNorm)
    );

    const compositeScore = clamp(0.9 * (w.r * returnNorm + w.y * yieldNorm - w.k * riskScore) + 0.1 * aumNorm);

    return {
      ...d,
      returnNorm,
      yieldNorm,
      volumeNorm,
      aumNorm,
      expenseNorm: expenseNormRaw,
      volNorm: volNormRaw,
      drawdownNorm: drawdownNormRaw,
      riskScore,
      compositeScore,
    };
  });

  return scored.sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 100);
}
