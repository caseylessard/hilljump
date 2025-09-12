// Ranking preset system for ETF scoring
export type RankingPrefs = {
  // Core weight factors (should sum to ~100 for balanced scoring)
  wYield: number;           // TTM yield weight
  wDivStability: number;    // Dividend consistency weight  
  wRisk: number;            // Risk adjustment (volatility + drawdown)
  wTotalReturn12m: number;  // 12-month total return weight
  wMomentum13w: number;     // 13-week DRIP momentum weight
  wMomentum52w: number;     // 52-week DRIP momentum weight  
  wLiquidity: number;       // Trading volume + spread weight
  wFees: number;            // Expense ratio weight
  wSizeAge: number;         // AUM + fund age weight

  // Modifier caps (bonus/penalty points, typically 0-12)
  capHomeBias?: number;     // Home country bonus cap
  capCurrency?: number;     // Currency match bonus cap
  capCadence?: number;      // Distribution frequency bonus cap
  capLeverage?: number;     // Leveraged ETF penalty cap
  capAumAge?: number;       // Small/young fund penalty cap
  capIlliquidity?: number;  // Low volume penalty cap

  // Guardrails
  aumMinUSD?: number;       // Minimum AUM threshold
  addvMinUSD?: number;      // Minimum average daily dollar volume
  ageMinDays?: number;      // Minimum fund age in days
  winsorize?: boolean;      // Use winsorization for outlier handling
};

export const presets: Record<string, RankingPrefs> = {
  balanced: {
    wYield: 10,              // Reduced from 25
    wDivStability: 15,       // Reduced from 20
    wRisk: 20,
    wTotalReturn12m: 15,
    wMomentum13w: 20,        // Increased from 8 - DRIP is now primary
    wMomentum52w: 15,        // Increased from 2 - Long-term DRIP momentum
    wLiquidity: 3,           // Reduced from 5
    wFees: 2,                // Reduced from 3
    wSizeAge: 0,             // Reduced from 2
    capHomeBias: 6,
    capCurrency: 2,
    capCadence: 2,
    capLeverage: 8,
    capAumAge: 6,
    capIlliquidity: 6,
    aumMinUSD: 25_000_000,
    addvMinUSD: 150_000,
    ageMinDays: 90,
    winsorize: true,
  },

  income_first: {
    wYield: 8,               // Drastically reduced from 35
    wDivStability: 15,       // Reduced from 25
    wRisk: 15,               // Reduced from 20
    wTotalReturn12m: 10,     // Increased from 5
    wMomentum13w: 30,        // Massively increased from 3 - DRIP is king
    wMomentum52w: 20,        // Massively increased from 2 - Long-term DRIP
    wLiquidity: 2,           // Reduced from 5
    wFees: 0,                // Reduced from 3
    wSizeAge: 0,             // Reduced from 2
    capHomeBias: 6,
    capCurrency: 2,
    capCadence: 2,
    capLeverage: 8,
    capAumAge: 6,
    capIlliquidity: 6,
    aumMinUSD: 25_000_000,
    addvMinUSD: 150_000,
    ageMinDays: 90,
    winsorize: true,
  },

  total_return: {
    wYield: 5,               // Reduced from 15
    wDivStability: 5,        // Reduced from 10
    wRisk: 15,               // Reduced from 20
    wTotalReturn12m: 35,     // Increased from 30
    wMomentum13w: 25,        // Increased from 10 - DRIP momentum critical
    wMomentum52w: 15,        // Increased from 10 - Long-term DRIP
    wLiquidity: 0,           // Reduced from 3
    wFees: 0,                // Reduced from 2
    wSizeAge: 0,
    capHomeBias: 6,
    capCurrency: 2,
    capCadence: 1,
    capLeverage: 8,
    capAumAge: 6,
    capIlliquidity: 3,
    aumMinUSD: 15_000_000,
    addvMinUSD: 100_000,
    ageMinDays: 60,
    winsorize: true,
  },
};

// Helper to normalize core weights to sum to 100
export function normalizeCore(core: {
  wYield: number;
  wDivStability: number;
  wRisk: number;
  wTotalReturn12m: number;
  wMomentum13w: number;
  wMomentum52w: number;
  wLiquidity: number;
  wFees: number;
  wSizeAge: number;
}) {
  const sum = sumCore(core);
  if (sum <= 0) {
    // Fallback to balanced if all zero
    return {
      wYield: 20, wDivStability: 10, wRisk: 15, wTotalReturn12m: 25,
      wMomentum13w: 15, wMomentum52w: 10, wLiquidity: 3, wFees: 2, wSizeAge: 0
    };
  }
  const factor = 100 / sum;
  return {
    wYield: core.wYield * factor,
    wDivStability: core.wDivStability * factor,
    wRisk: core.wRisk * factor,
    wTotalReturn12m: core.wTotalReturn12m * factor,
    wMomentum13w: core.wMomentum13w * factor,
    wMomentum52w: core.wMomentum52w * factor,
    wLiquidity: core.wLiquidity * factor,
    wFees: core.wFees * factor,
    wSizeAge: core.wSizeAge * factor,
  };
}

export function sumCore(core: {
  wYield: number;
  wDivStability: number;
  wRisk: number;
  wTotalReturn12m: number;
  wMomentum13w: number;
  wMomentum52w: number;
  wLiquidity: number;
  wFees: number;
  wSizeAge: number;
}) {
  return core.wYield + core.wDivStability + core.wRisk + core.wTotalReturn12m +
         core.wMomentum13w + core.wMomentum52w + core.wLiquidity + core.wFees + core.wSizeAge;
}