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
  return rows.slice().sort((a, b) => a.date.localeCompare(b.date));
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
  const dists  = distsInput.slice().sort((a, b) => a.exDate.localeCompare(b.exDate));

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

// Convenience: fixed windows ending at endISO
export function dripWindows(
  prices: PriceRow[],
  dists: DistRow[],
  endISO: string,
  windowsDays = [28, 91, 182, 364], // 4w, 13w, 26w, 52w
  startShares = 1,
  opts?: DripOptions
): Record<number, DripResult> {
  const end = new Date(endISO);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const out: Record<number, DripResult> = {};
  for (const days of windowsDays) {
    const start = new Date(end);
    // Start from the day before the measurement period to get true N-day performance
    start.setDate(start.getDate() - days - 1);
    out[days] = dripOverPeriod(prices, dists, fmt(start), fmt(end), startShares, opts);
  }
  return out;
}