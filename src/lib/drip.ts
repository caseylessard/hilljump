// True DRIP math from prices + distributions over a period.
// Assumes: (1) split-adjusted closes, (2) split-adjusted $/share dividends,
// (3) you only have exDate, and payDate ≈ exDate + payOffsetDays (default 2).
// Reinvestment occurs at the first trading day ON OR AFTER that inferred pay date.

export type PriceRow = { date: string; close: number };   // ISO yyyy-mm-dd, sorted asc
export type DistRow  = { exDate: string; amount: number }; // $/share; ex-date only

export type DripOptions = {
  // Include dividend if EX-DATE in (start, end] (recommended) or (start, end)
  includePolicy?: 'open-closed' | 'open-open';
  // Business-day offset from exDate to nominal pay date (default 2 business days)
  payOffsetDays?: number; // default 2
  // Use business days (true) or calendar days (false) for pay offset
  useBusinessDays?: boolean; // default true
  // Optional withholding (e.g., 0.15 for 15%)
  taxWithholdRate?: number;
};

export type DripResult = {
  startISO: string;
  endISO: string;
  startPrice: number;
  endPrice: number;
  startShares: number;
  totalShares: number;
  dripShares: number;      // shares created via reinvestment
  startValue: number;      // startShares * startPrice
  endValue: number;        // totalShares * endPrice
  dripDollarValue: number; // dripShares * endPrice
  dripPercent: number;     // (endValue/startValue - 1) * 100
  // Audit trail of each reinvestment factor used
  factors: Array<{ exDate: string; inferredPayRef: string; reinvestDate: string; reinvestPrice: number; netAmount: number; factor: number }>;
};

function ensureSorted<T extends { date: string }>(rows: T[]): T[] {
  return rows.filter(row => row && row.date).slice().sort((a, b) => a.date.localeCompare(b.date));
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Add business days (excluding weekends) to a date
function addBusinessDaysISO(iso: string, businessDays: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  let added = 0;
  
  while (added < businessDays) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
      added++;
    }
  }
  
  return d.toISOString().slice(0, 10);
}

// Last close on or before iso
function priceOnOrBefore(prices: PriceRow[], iso: string): number {
  let lo = 0, hi = prices.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (prices[mid].date <= iso) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans >= 0 ? prices[ans].close : NaN;
}

// First close on or after iso; returns index or -1 if none
function indexOnOrAfter(prices: PriceRow[], iso: string): number {
  let lo = 0, hi = prices.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (prices[mid].date < iso) lo = mid + 1;
    else { ans = mid; hi = mid - 1; }
  }
  return ans;
}

export function dripOverPeriod(
  pricesInput: PriceRow[],
  distsInput: DistRow[],
  startISO: string,
  endISO: string,
  startShares = 1,
  opts: DripOptions = {}
): DripResult {
  const prices = ensureSorted(pricesInput);
  const dists  = distsInput.filter(d => d && d.exDate && d.amount != null).slice().sort((a, b) => a.exDate.localeCompare(b.exDate));

  const startPrice = priceOnOrBefore(prices, startISO);
  const endPrice   = priceOnOrBefore(prices, endISO);
  
  // Check if we have insufficient data for this time period
  const hasStartPrice = isFinite(startPrice) && startPrice > 0;
  const hasEndPrice = isFinite(endPrice) && endPrice > 0;
  
  if (!hasStartPrice || !hasEndPrice || startShares <= 0) {
    return {
      startISO, endISO, 
      startPrice: hasStartPrice ? startPrice : NaN, 
      endPrice: hasEndPrice ? endPrice : NaN,
      startShares, totalShares: startShares, dripShares: 0,
      startValue: 0, endValue: 0, dripDollarValue: 0, dripPercent: 0, factors: []
    };
  }

  const includePolicy = opts.includePolicy ?? 'open-closed';
  const payOffsetDays = Number.isFinite(opts.payOffsetDays ?? 0) ? (opts.payOffsetDays as number) : 2;
  const useBusinessDays = opts.useBusinessDays ?? true;
  const taxRate = opts.taxWithholdRate ?? 0;

  let shares = startShares;
  const factors: DripResult['factors'] = [];

  for (const ev of dists) {
    const ex = ev.exDate;
    const inWindow =
      includePolicy === 'open-closed'
        ? (ex > startISO && ex <= endISO)
        : (ex > startISO && ex < endISO);
    if (!inWindow) continue;

    // Calculate nominal pay date using business days or calendar days
    const nominalPayRef = useBusinessDays 
      ? addBusinessDaysISO(ex, payOffsetDays)
      : addDaysISO(ex, payOffsetDays);
    // Actual reinvestment occurs on the first trading day ON OR AFTER this ref date
    const idx = indexOnOrAfter(prices, nominalPayRef);
    if (idx < 0) continue; // no trading days at/after ref → skip
    const actualReinvestDate = prices[idx].date;

    // If the actual reinvestment trading day is after the window end, it hasn't reinvested yet → exclude
    if (actualReinvestDate > endISO) continue;

    const reinvestPrice = prices[idx].close;
    const netAmt = ev.amount * (1 - taxRate);
    if (!(netAmt > 0) || !(reinvestPrice > 0)) continue;

    const factor = 1 + netAmt / reinvestPrice;
    shares *= factor;
    factors.push({
      exDate: ex,
      inferredPayRef: nominalPayRef,
      reinvestDate: actualReinvestDate,
      reinvestPrice,
      netAmount: netAmt,
      factor
    });
  }

  const totalShares = shares;
  const dripShares = totalShares - startShares;
  const startValue = startShares * startPrice;
  const endValue   = totalShares * endPrice;
  const dripDollarValue = dripShares * endPrice;
  const dripPercent = ((endValue / startValue) - 1) * 100;

  return {
    startISO, endISO, startPrice, endPrice,
    startShares, totalShares, dripShares,
    startValue, endValue, dripDollarValue, dripPercent, factors
  };
}

// Infer distribution frequency from historical dividend data
function inferDistributionFrequency(dists: DistRow[]): 'weekly' | 'monthly' | 'quarterly' | 'unknown' {
  if (dists.length < 2) return 'unknown';
  
  // Filter out invalid dates and calculate average days between distributions
  const validDists = dists.filter(d => d && d.exDate);
  const sortedDists = validDists.slice().sort((a, b) => a.exDate.localeCompare(b.exDate));
  
  if (sortedDists.length < 2) return 'unknown';
  
  const intervals: number[] = [];
  
  for (let i = 1; i < sortedDists.length; i++) {
    const prev = new Date(sortedDists[i-1].exDate);
    const curr = new Date(sortedDists[i].exDate);
    if (isNaN(prev.getTime()) || isNaN(curr.getTime())) continue;
    const daysDiff = Math.abs((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    intervals.push(daysDiff);
  }
  
  if (intervals.length === 0) return 'unknown';
  
  const avgInterval = intervals.reduce((sum, int) => sum + int, 0) / intervals.length;
  
  // Classify based on average interval
  if (avgInterval <= 10) return 'weekly'; // 7 days ± tolerance
  if (avgInterval <= 40) return 'monthly'; // 30 days ± tolerance
  if (avgInterval <= 120) return 'quarterly'; // 90 days ± tolerance
  
  return 'unknown';
}

// Calculate smart window that ensures minimum distribution count
function calculateSmartWindow(
  dists: DistRow[], 
  endISO: string, 
  targetDays: number,
  minDistributions: number
): { startISO: string; actualDays: number } {
  const end = new Date(endISO);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  
  // Start with target window
  let windowDays = targetDays;
  const maxWindowDays = targetDays * 2; // Don't extend beyond 2x target
  
  while (windowDays <= maxWindowDays) {
    const start = new Date(end);
    start.setDate(start.getDate() - windowDays);
    const startISO = fmt(start);
    
    // Count distributions in this window (open-closed policy)
    const distributionsInWindow = dists.filter(d => 
      d.exDate > startISO && d.exDate <= endISO
    ).length;
    
    if (distributionsInWindow >= minDistributions) {
      return { startISO, actualDays: windowDays };
    }
    
    // Extend window by 7 days and try again
    windowDays += 7;
  }
  
  // Fallback to original target if we can't meet minimum
  const start = new Date(end);
  start.setDate(start.getDate() - targetDays);
  return { startISO: fmt(start), actualDays: targetDays };
}

// Enhanced windows that ensure minimum distribution counts
export function dripWindows(
  prices: PriceRow[],
  dists: DistRow[],
  endISO: string,
  windowsDays = [28, 91, 182, 364], // 4w, 13w, 26w, 52w
  startShares = 1,
  opts?: DripOptions
): Record<number, DripResult> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const out: Record<number, DripResult> = {};
  
  // Infer distribution frequency for smart windowing
  const frequency = inferDistributionFrequency(dists);
  
  for (const days of windowsDays) {
    let startISO: string;
    let actualDays = days;
    
    // For 4w period, ensure minimum distributions based on frequency
    if (days === 28) {
      let minDistributions = 1; // Default minimum
      
      switch (frequency) {
        case 'weekly':
          minDistributions = 4; // 4 weeks should have 4 weekly distributions
          break;
        case 'monthly':
          minDistributions = 1; // 4 weeks should have 1 monthly distribution
          break;
        case 'quarterly':
          minDistributions = 1; // Quarterly is fine with 1 in 4w if available
          break;
      }
      
      const smartWindow = calculateSmartWindow(dists, endISO, days, minDistributions);
      startISO = smartWindow.startISO;
      actualDays = smartWindow.actualDays;
    } else {
      // For longer periods, use standard calculation
      const end = new Date(endISO);
      const start = new Date(end);
      start.setDate(start.getDate() - days);
      startISO = fmt(start);
    }
    
    const result = dripOverPeriod(prices, dists, startISO, endISO, startShares, opts);
    
    // Add metadata about the window calculation
    (result as any).windowMetadata = {
      requestedDays: days,
      actualDays,
      inferredFrequency: frequency,
      distributionsInWindow: dists.filter(d => d.exDate > startISO && d.exDate <= endISO).length
    };
    
    out[days] = result;
  }
  
  return out;
}