// Quick DRIP estimation for immediate display while calculations run
export interface ETFPriceData {
  current_price?: number;
  yield_ttm?: number;
  total_return_1y?: number;
}

export interface QuickDripEstimate {
  period: string;
  estimatedDrip: number;
  confidence: 'high' | 'medium' | 'low';
  note: string;
}

// Estimate DRIP returns based on yield and price appreciation
export function estimateQuickDrip(etf: ETFPriceData, period: '4w' | '13w' | '26w' | '52w'): QuickDripEstimate {
  const { yield_ttm, total_return_1y, current_price } = etf;

  // Default fallback values
  if (!yield_ttm || !current_price) {
    return {
      period,
      estimatedDrip: 0,
      confidence: 'low',
      note: 'Insufficient data for estimation'
    };
  }

  // Period multipliers (fraction of year)
  const periodMultipliers = {
    '4w': 4 / 52,    // 4 weeks out of 52
    '13w': 13 / 52,  // 13 weeks out of 52  
    '26w': 26 / 52,  // 26 weeks out of 52
    '52w': 1         // Full year
  };

  const periodFraction = periodMultipliers[period];
  
  // Estimate dividend income for the period
  const estimatedDividendYield = yield_ttm * periodFraction;
  
  // Estimate price appreciation (conservative: 50% of 1Y return)
  const estimatedPriceReturn = (total_return_1y || 0) * periodFraction * 0.5;
  
  // Simple DRIP estimation: dividend yield + modest compounding effect
  // Formula: base return + (dividend_yield * reinvestment_factor)
  const reinvestmentBonus = estimatedDividendYield * 0.1; // 10% compounding benefit
  const estimatedDrip = estimatedPriceReturn + estimatedDividendYield + reinvestmentBonus;
  
  // Determine confidence based on data quality
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  let note = 'Estimated based on yield and returns';
  
  if (yield_ttm > 8) {
    confidence = 'high';
    note = 'High-yield ETF estimation';
  } else if (yield_ttm < 2) {
    confidence = 'low';
    note = 'Low-yield ETF - estimation less reliable';
  }

  if (!total_return_1y) {
    confidence = 'low';
    note = 'Missing return data - yield-only estimate';
  }

  return {
    period,
    estimatedDrip: Math.round(estimatedDrip * 100) / 100, // Round to 2 decimals
    confidence,
    note
  };
}

// Get estimates for all periods
export function estimateAllPeriods(etf: ETFPriceData): Record<string, QuickDripEstimate> {
  const periods: Array<'4w' | '13w' | '26w' | '52w'> = ['4w', '13w', '26w', '52w'];
  const estimates: Record<string, QuickDripEstimate> = {};
  
  periods.forEach(period => {
    estimates[period] = estimateQuickDrip(etf, period);
  });
  
  return estimates;
}

// Check if we should show estimate vs actual DRIP
export function shouldShowEstimate(
  cachedDrip: any, 
  period: string,
  maxCacheAge: number = 24 * 60 * 60 * 1000 // 24 hours
): boolean {
  if (!cachedDrip) return true;
  
  const periodData = cachedDrip[period];
  if (!periodData) return true;
  
  // Check cache age
  const lastUpdated = cachedDrip.lastUpdated ? new Date(cachedDrip.lastUpdated) : null;
  if (!lastUpdated || (Date.now() - lastUpdated.getTime()) > maxCacheAge) {
    return true;
  }
  
  return false;
}