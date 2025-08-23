import { ETF } from "@/data/etfs";
import type { LivePrice } from "@/lib/live";
import type { RankingPrefs } from "@/lib/rankingPresets";
import { presets, normalizeCore, sumCore } from "@/lib/rankingPresets";

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
  riskScore: number;      // 0..1 higher = riskier
  compositeScore: number; // higher is better
};

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const safe = (n: number | undefined | null, fallback = 0) => (Number.isFinite(n as number) ? (n as number) : fallback);

// ---------- Percentile helpers (winsorization) ----------
function quantile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function winsorStats(values: number[], pLow = 0.05, pHigh = 0.95) {
  const arr = values.map(v => safe(v, 0)).filter(v => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (arr.length === 0) return { low: 0, high: 1, span: 1 };
  const low = quantile(arr, pLow);
  const high = quantile(arr, pHigh);
  const span = high - low || 1;
  return { low, high, span };
}

function normWins(v: number, stats: { low: number; high: number; span: number }, invert = false) {
  const x = clamp((v - stats.low) / stats.span, 0, 1);
  return invert ? 1 - x : x;
}

// ---------- Utility ----------
function approxPeriodFromAnnual(annualPct: number, days: number) {
  const daily = Math.pow(1 + safe(annualPct, 0) / 100, 1 / 365) - 1;
  return (Math.pow(1 + daily, days) - 1) * 100;
}

function daysSince(dateIso?: string) {
  if (!dateIso) return undefined;
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) return undefined;
  const ms = Date.now() - t;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

// ---------- Core scoring using RankingPrefs ----------
export function scoreETFsWithPrefs(
  data: ETF[],
  prefs: RankingPrefs,
  live?: Record<string, LivePrice>,
  options?: {
    homeCountry?: string;   // e.g., 'CA', 'US'
    currency?: string;      // e.g., 'USD', 'CAD'
  }
): ScoredETF[] {
  // Normalize core weights to sum to 100 (defensive)
  const core = normalizeCore({
    wYield: prefs.wYield,
    wDivStability: prefs.wDivStability,
    wRisk: prefs.wRisk,
    wTotalReturn12m: prefs.wTotalReturn12m,
    wMomentum13w: prefs.wMomentum13w,
    wMomentum52w: prefs.wMomentum52w,
    wLiquidity: prefs.wLiquidity,
    wFees: prefs.wFees,
    wSizeAge: prefs.wSizeAge,
  });

  // Guardrails thresholds
  const aumMin = safe(prefs.aumMinUSD, 25_000_000);
  const addvMin = safe(prefs.addvMinUSD, 150_000);
  const ageMin = safe(prefs.ageMinDays, 90);
  const wins = prefs.winsorize !== false;

  // Build measurement arrays
  const lastPrices = data.map(d => {
    const lp = live?.[d.ticker];
    return safe(lp?.price, safe((d as any).lastPrice, safe((d as any).nav, 0)));
  });

  const dollarVolumes = data.map((d, i) => {
    const px = lastPrices[i] || 0;
    const sh = safe(d.avgVolume, 0);
    return px > 0 ? sh * px : sh; // fallback to shares if no price
  });

  const returns1y = data.map(d => safe(d.totalReturn1Y, 0));      // %
  const yieldsTtm = data.map(d => safe((d as any).yieldForward ?? d.yieldTTM, 0)); // prefer forward if present
  const vols1y    = data.map(d => safe(d.volatility1Y, 0));       // %
  const mdd1yAbs  = data.map(d => Math.abs(safe(d.maxDrawdown1Y, 0))); // treat as positive magnitude
  const eratio    = data.map(d => safe(d.expenseRatio, 0));       // %
  const spreads   = data.map(d => safe((d as any).spreadPct, NaN));     // % (optional)
  const aums      = data.map(d => safe(d.aum, 0));
  const agesDays  = data.map(d => safe((d as any).inceptionDays, undefined) ?? daysSince((d as any).inceptionDate));

  // DRIP perf (prefer live; else approximate from 1y)
  const drip4w = data.map((d, i) => {
    const lp = live?.[d.ticker];
    return safe(lp?.drip4wPercent, approxPeriodFromAnnual(returns1y[i], 28));
  });
  const drip12w = data.map((d, i) => {
    const lp = live?.[d.ticker];
    return safe(lp?.drip12wPercent, approxPeriodFromAnnual(returns1y[i], 90));
  });
  const drip52w = data.map((d, i) => {
    const lp = live?.[d.ticker];
    return safe(lp?.drip52wPercent, approxPeriodFromAnnual(returns1y[i], 365));
  });

  // Stats (winsorized)
  const rStats   = wins ? winsorStats(returns1y)   : { low: Math.min(...returns1y),   high: Math.max(...returns1y),   span: Math.max(...returns1y)   - Math.min(...returns1y)   || 1 };
  const yStats   = wins ? winsorStats(yieldsTtm)   : { low: Math.min(...yieldsTtm),   high: Math.max(...yieldsTtm),   span: Math.max(...yieldsTtm)   - Math.min(...yieldsTtm)   || 1 };
  const volStats = wins ? winsorStats(vols1y)      : { low: Math.min(...vols1y),      high: Math.max(...vols1y),      span: Math.max(...vols1y)      - Math.min(...vols1y)      || 1 };
  const mddStats = wins ? winsorStats(mdd1yAbs)    : { low: Math.min(...mdd1yAbs),    high: Math.max(...mdd1yAbs),    span: Math.max(...mdd1yAbs)    - Math.min(...mdd1yAbs)    || 1 };
  const erStats  = wins ? winsorStats(eratio)      : { low: Math.min(...eratio),      high: Math.max(...eratio),      span: Math.max(...eratio)      - Math.min(...eratio)      || 1 };
  const dvStats  = wins ? winsorStats(dollarVolumes):{ low: Math.min(...dollarVolumes),high: Math.max(...dollarVolumes),span: Math.max(...dollarVolumes)- Math.min(...dollarVolumes)|| 1 };
  const aumStats = wins ? winsorStats(aums)        : { low: Math.min(...aums),        high: Math.max(...aums),        span: Math.max(...aums)        - Math.min(...aums)        || 1 };
  const sprStats = (() => {
    const has = spreads.filter(v => Number.isFinite(v));
    if (has.length === 0) return null;
    return wins ? winsorStats(has) : { low: Math.min(...has), high: Math.max(...has), span: Math.max(...has) - Math.min(...has) || 1 };
  })();
  const ageStats = (() => {
    const has = agesDays.filter((v): v is number => Number.isFinite(v));
    if (has.length === 0) return null;
    return wins ? winsorStats(has) : { low: Math.min(...has), high: Math.max(...has), span: Math.max(...has) - Math.min(...has) || 1 };
  })();

  const d4Stats  = wins ? winsorStats(drip4w)  : { low: Math.min(...drip4w),  high: Math.max(...drip4w),  span: Math.max(...drip4w)  - Math.min(...drip4w)  || 1 };
  const d12Stats = wins ? winsorStats(drip12w) : { low: Math.min(...drip12w), high: Math.max(...drip12w), span: Math.max(...drip12w) - Math.min(...drip12w) || 1 };
  const d52Stats = wins ? winsorStats(drip52w) : { low: Math.min(...drip52w), high: Math.max(...drip52w), span: Math.max(...drip52w) - Math.min(...drip52w) || 1 };

  const scored = data.map((d, i) => {
    // --- Normalized factors (0..1)
    const returnNorm = normWins(returns1y[i], rStats);          // higher better
    const yieldNormRaw = normWins(yieldsTtm[i], yStats);        // higher better

    const volNormRaw = normWins(vols1y[i], volStats);           // higher = worse (we'll invert later)
    const mddNormRaw = normWins(mdd1yAbs[i], mddStats);         // higher = worse (deeper DD)
    const expenseNormRaw = normWins(eratio[i], erStats);        // higher = worse
    const volumeNorm = normWins(dollarVolumes[i], dvStats);     // higher better
    const aumNorm = normWins(aums[i], aumStats);                // higher better
    const spreadNorm = sprStats ? normWins(safe(spreads[i], sprStats.low), sprStats, true) : 0.5; // lower spread better
    const ageNorm = ageStats ? normWins(safe(agesDays[i], ageStats.low), ageStats) : 0.5;        // older better

    // Dividend stability (optional fields: divStdDev12M, divMean12M)
    const divMean = safe((d as any).divMean12M, NaN);
    const divStd = safe((d as any).divStdDev12M, NaN);
    const stability = Number.isFinite(divMean) && divMean > 0 && Number.isFinite(divStd)
      ? clamp(1 - divStd / divMean, 0, 1)
      : 0.5; // neutral if unknown
    const yieldQuality = clamp(0.5 * yieldNormRaw + 0.5 * (yieldNormRaw * (0.5 + 0.5 * stability)), 0, 1);

    // Risk adjustment (lower is better). Combine vol + drawdown, then invert.
    const riskBlend = clamp(0.5 * volNormRaw + 0.5 * mddNormRaw, 0, 1); // 0 good, 1 bad
    const riskAdj = 1 - riskBlend;                                      // higher better
    const feeScore = 1 - expenseNormRaw;                                 // lower ER better
    const liqScore = clamp(0.8 * volumeNorm + 0.2 * spreadNorm, 0, 1);   // spread helps if available
    const sizeAgeScore = clamp(0.7 * aumNorm + 0.3 * ageNorm, 0, 1);

    // Momentum (DRIP-based): 12w (primary), then 4w, small 52w
    const drip4wNorm = normWins(drip4w[i], d4Stats);
    const drip12wNorm = normWins(drip12w[i], d12Stats);
    const drip52wNorm = normWins(drip52w[i], d52Stats);
    const momentum13w = drip12wNorm;
    const momentum52w = drip52wNorm;
    const dripWeightedNorm = clamp(0.6 * drip12wNorm + 0.3 * drip4wNorm + 0.1 * drip52wNorm, 0, 1);

    // Buy signal: positive 12w and 4w DRIP
    const buySignal = (drip12w[i] ?? 0) > 0 && (drip4w[i] ?? 0) > 0;
    const signalBoost = buySignal ? 0.05 : -0.05; // ±5pts in 0..1 space

    // --- Core weighted score (0..1)
    const coreSum = sumCore(core) || 100;
    const to01 = (w: number) => w / coreSum;

    const scoreCore =
      to01(core.wYield)           * yieldQuality +
      to01(core.wDivStability)    * stability +
      to01(core.wRisk)            * riskAdj +
      to01(core.wTotalReturn12m)  * returnNorm +
      to01(core.wMomentum13w)     * momentum13w +
      to01(core.wMomentum52w)     * momentum52w +
      to01(core.wLiquidity)       * liqScore +
      to01(core.wFees)            * feeScore +
      to01(core.wSizeAge)         * sizeAgeScore;

    // --- Post-score modifiers (capped; mapped to 0..1 by ÷100)
    let bonus = 0;
    // Home bias
    if (options?.homeCountry && (d as any).country && (d as any).country === options.homeCountry) {
      bonus += Math.min(+(prefs.capHomeBias ?? 6), 6);
    }
    // Currency match / hedged
    if (options?.currency) {
      const ccy = (d as any).currency as string | undefined;
      const hedgedTo = (d as any).hedgedTo as string | undefined;
      if (ccy === options.currency || hedgedTo === options.currency) {
        bonus += Math.min(+(prefs.capCurrency ?? 2), 2);
      }
    }
    // Distribution cadence
    const cadence = ((d as any).payoutSchedule || '').toString().toLowerCase();
    if (cadence === 'weekly') {
      bonus += Math.min(+(prefs.capCadence ?? 2), 2);
    } else if (cadence === 'monthly') {
      bonus += Math.min(+(prefs.capCadence ?? 2), 1);
    }

    // Penalties
    let penalty = 0;
    const isLev = !!(d as any).isLeveraged || safe((d as any).leverage, 1) > 1.05;
    if (isLev) penalty += Math.min(+(prefs.capLeverage ?? 8), 8);

    // AUM / Age penalty (continuous up to cap)
    const aumShortfall = aums[i] < aumMin ? clamp((aumMin - aums[i]) / Math.max(1, aumMin), 0, 1) : 0;
    const ageShortfall = (agesDays[i] ?? Infinity) < ageMin ? clamp((ageMin - (agesDays[i] ?? 0)) / Math.max(1, ageMin), 0, 1) : 0;
    const aumAgePenalty = Math.min(+(prefs.capAumAge ?? 12), 12) * Math.max(aumShortfall, ageShortfall);
    penalty += aumAgePenalty;

    // Illiquidity penalty (based on $ volume)
    const dvShortfall = dollarVolumes[i] < addvMin ? clamp((addvMin - dollarVolumes[i]) / Math.max(1, addvMin), 0, 1) : 0;
    penalty += Math.min(+(prefs.capIlliquidity ?? 6), 6) * dvShortfall;

    // Map bonus/penalty "points" to 0..1 (each point ~ 0.01)
    const modifiers = clamp((bonus - penalty) / 100, -0.2, 0.2);

    // Final composite
    const compositeScore = clamp(scoreCore + modifiers + signalBoost, 0, 1);

    // Risk score (for display; higher = riskier)
    const riskScore = clamp(riskBlend, 0, 1);

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
      drip12wNorm,
      drip52wNorm,
      dripWeightedNorm,
      buySignal,
      riskScore,
      compositeScore,
    };
  });

  // Hard filters: if you want true exclusion, zero them out here
  const out = scored.map((s, i) => {
    const ageOk = (agesDays[i] ?? Infinity) >= ageMin;
    const aumOk = aums[i] >= aumMin;
    const dvOk = dollarVolumes[i] >= addvMin;
    if (!ageOk || !aumOk || !dvOk) {
      // Keep in list but push to bottom
      return { ...s, compositeScore: Math.min(s.compositeScore, 0.0001), buySignal: false };
    }
    return s;
  });

  return out.sort((a, b) => b.compositeScore - a.compositeScore);
}

// ---------- Back-compat wrapper using the old 3-slider weights ----------
// Chooses a preset from weights (return -> total_return, yield -> income_first, else balanced).
// You can pass options.homeCountry / options.currency to enable those modifiers.
export function scoreETFs(
  data: ETF[],
  weights: Weights,
  live?: Record<string, LivePrice>,
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

  return scoreETFsWithPrefs(data, chosen, live, options);
}
