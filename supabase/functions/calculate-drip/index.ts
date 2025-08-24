import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

// DRIP calculation types and functions (embedded for edge function)
type PriceRow = { date: string; close: number };
type DistRow = { exDate: string; amount: number };

type DripOptions = {
  includePolicy?: 'open-closed' | 'open-open';
  payOffsetDays?: number;
  useBusinessDays?: boolean;
  taxWithholdRate?: number;
};

type DripResult = {
  startISO: string;
  endISO: string;
  startPrice: number;
  endPrice: number;
  startShares: number;
  totalShares: number;
  dripShares: number;
  startValue: number;
  endValue: number;
  dripDollarValue: number;
  dripPercent: number;
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

function priceOnOrBefore(prices: PriceRow[], iso: string): number {
  let lo = 0, hi = prices.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (prices[mid].date <= iso) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans >= 0 ? prices[ans].close : NaN;
}

function indexOnOrAfter(prices: PriceRow[], iso: string): number {
  let lo = 0, hi = prices.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (prices[mid].date < iso) lo = mid + 1;
    else { ans = mid; hi = mid - 1; }
  }
  return ans;
}

function dripOverPeriod(
  pricesInput: PriceRow[],
  distsInput: DistRow[],
  startISO: string,
  endISO: string,
  startShares = 1,
  opts: DripOptions = {}
): DripResult {
  const prices = ensureSorted(pricesInput);
  const dists = distsInput.slice().sort((a, b) => a.exDate.localeCompare(b.exDate));

  const startPrice = priceOnOrBefore(prices, startISO);
  const endPrice = priceOnOrBefore(prices, endISO);
  if (!isFinite(startPrice) || !isFinite(endPrice) || endPrice <= 0 || startShares <= 0) {
    return {
      startISO, endISO, startPrice: NaN, endPrice: NaN,
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
    const idx = indexOnOrAfter(prices, nominalPayRef);
    if (idx < 0) continue;
    const actualReinvestDate = prices[idx].date;

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
  const endValue = totalShares * endPrice;
  const dripDollarValue = dripShares * endPrice;
  const dripPercent = ((endValue / startValue) - 1) * 100;

  return {
    startISO, endISO, startPrice, endPrice,
    startShares, totalShares, dripShares,
    startValue, endValue, dripDollarValue, dripPercent, factors
  };
}

function dripWindows(
  prices: PriceRow[],
  dists: DistRow[],
  endISO: string,
  windowsDays = [28, 91, 182, 364],
  startShares = 1,
  opts?: DripOptions
): Record<number, DripResult> {
  const end = new Date(endISO);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const out: Record<number, DripResult> = {};
  for (const days of windowsDays) {
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    out[days] = dripOverPeriod(prices, dists, fmt(start), fmt(end), startShares, opts);
  }
  return out;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { tickers } = await req.json()
    
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid or empty tickers array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`🧮 Calculating DRIP data for ${tickers.length} tickers`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Pre-filter tickers to only process those with ETF data (remove price requirement temporarily)
    const { data: etfsWithData, error: etfError } = await supabase
      .from('etfs')
      .select('ticker, current_price, currency')
      .in('ticker', tickers)
      .eq('active', true)

    if (etfError) {
      console.error('❌ Failed to fetch ETF data:', etfError)
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to fetch ETF data for DRIP calculations',
        details: etfError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const validTickers = etfsWithData?.map(etf => etf.ticker) || []
    console.log(`📊 Processing ${validTickers.length} valid tickers (filtered from ${tickers.length})`)

    if (validTickers.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        dripData: {},
        processed: 0,
        errors: 0,
        total: 0,
        message: 'No valid tickers found for DRIP calculation'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Use cached prices from database instead of live API calls
    console.log('📊 Using cached prices from database for DRIP calculations...')
    
    const cachedPrices: Record<string, number> = {}
    for (const etf of etfsWithData || []) {
      if (etf.current_price && etf.current_price > 0) {
        cachedPrices[etf.ticker] = Number(etf.current_price)
      }
    }
    
    console.log(`✅ Using ${Object.keys(cachedPrices).length} cached prices from database`)

    const dripData: Record<string, any> = {}
    let processedCount = 0
    let errorCount = 0

    const today = new Date().toISOString().slice(0, 10)
    const windowsDays = [28, 91, 182, 364] // 4W, 13W, 26W, 52W
    const periodLabels = ['4w', '13w', '26w', '52w']

    // Calculate true DRIP percentages for each valid ticker
    for (const ticker of validTickers) {
      try {
        console.log(`[${processedCount + 1}/${validTickers.length}] 📊 Processing ${ticker}...`)
        
        // Get historical price data for at least 1 year
        const oneYearAgo = new Date()
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
        const startDate = oneYearAgo.toISOString().slice(0, 10)

        // For now, we'll use current price as a single price point
        // TODO: Get actual historical price data when available
        const currentPrice = cachedPrices[ticker]
        
        if (!currentPrice || currentPrice <= 0) {
          console.log(`❌ No price data for ${ticker}`)
           dripData[ticker] = {
             ticker,
             currentPrice: null,
             drip4wPercent: 0,
             drip4wDollar: 0,
             drip13wPercent: 0,
             drip13wDollar: 0,
             drip26wPercent: 0,
             drip26wDollar: 0,
             drip52wPercent: 0,
             drip52wDollar: 0,
             error: 'No price data available'
           }
          errorCount++
          continue
        }

        // Get dividend data for the past year
        const { data: dividends, error: divError } = await supabase
          .from('dividends')
          .select('amount, ex_date')
          .eq('ticker', ticker)
          .gte('ex_date', startDate)
          .order('ex_date', { ascending: true })

        if (divError) {
          console.log(`❌ Error fetching dividends for ${ticker}:`, divError.message)
           dripData[ticker] = {
             ticker,
             currentPrice,
             drip4wPercent: 0,
             drip4wDollar: 0,
             drip13wPercent: 0,
             drip13wDollar: 0,
             drip26wPercent: 0,
             drip26wDollar: 0,
             drip52wPercent: 0,
             drip52wDollar: 0,
             error: 'Failed to fetch dividend data'
           }
          errorCount++
          continue
        }

        // Get actual historical price data from the database
        const { data: priceRows, error: priceError } = await supabase
          .from('historical_prices')
          .select('date, close_price')
          .eq('ticker', ticker)
          .gte('date', startDate)
          .lte('date', today)
          .order('date', { ascending: true })

        if (priceError || !priceRows || priceRows.length === 0) {
          console.log(`❌ No historical price data for ${ticker}`)
           dripData[ticker] = {
              ticker,
              currentPrice,
              drip4wPercent: 0,
              drip4wDollar: 0,
              drip13wPercent: 0,
              drip13wDollar: 0,
              drip26wPercent: 0,
              drip26wDollar: 0,
              drip52wPercent: 0,
              drip52wDollar: 0,
              error: 'No historical price data available'
            }
          errorCount++
          continue
        }

        // Convert to PriceRow format for DRIP calculation
        const prices: PriceRow[] = priceRows.map(row => ({
          date: row.date,
          close: Number(row.close_price)
        }))

        console.log(`  📊 Found ${prices.length} price records for ${ticker} from ${prices[0]?.date} to ${prices[prices.length - 1]?.date}`)
        
        const dists: DistRow[] = (dividends || []).map(div => ({
          exDate: div.ex_date,
          amount: Number(div.amount || 0)
        }))

        console.log(`  📊 Found ${dists.length} dividends for ${ticker}`)

        // Calculate DRIP for all periods using business days for more accurate pay dates
        const dripResults = dripWindows(
          prices,
          dists,
          today,
          windowsDays,
          1,
          { includePolicy: 'open-closed', payOffsetDays: 2, useBusinessDays: true, taxWithholdRate: 0 }
        )

        const result: any = { ticker, currentPrice }

        // Map results to expected format
        for (let i = 0; i < windowsDays.length; i++) {
          const days = windowsDays[i]
          const period = periodLabels[i]
          const dripResult = dripResults[days]
          
          result[`drip${period}Percent`] = Math.round(dripResult.dripPercent * 100) / 100
          result[`drip${period}Dollar`] = Math.round(dripResult.dripDollarValue * 10000) / 10000
          
          console.log(`  📈 ${ticker} ${period.toUpperCase()}: ${dripResult.dripPercent.toFixed(2)}% (${dripResult.factors.length} reinvestments)`)
        }

        dripData[ticker] = result
        processedCount++

      } catch (error) {
        console.error(`💥 Error calculating DRIP for ${ticker}:`, error)
         dripData[ticker] = {
           ticker,
           currentPrice: null,
           drip4wPercent: 0,
           drip4wDollar: 0,
           drip13wPercent: 0,
           drip13wDollar: 0,
           drip26wPercent: 0,
           drip26wDollar: 0,
           drip52wPercent: 0,
           drip52wDollar: 0,
           error: error.message
         }
        errorCount++
      }
    }

    console.log(`🎉 DRIP calculation complete: ${processedCount} successful, ${errorCount} errors`)

    return new Response(JSON.stringify({ 
      success: true,
      dripData,
      processed: processedCount,
      errors: errorCount,
      total: validTickers.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('💥 DRIP calculation error:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Failed to calculate DRIP data',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})