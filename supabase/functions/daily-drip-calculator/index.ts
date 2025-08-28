import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

// DRIP calculation logic (copied from calculate-drip for consistency)
interface PriceRow {
  date: string;
  close_price: number;
}

interface DistRow {
  ex_date: string;
  amount: number;
}

interface DripResult {
  startPrice: number;
  endPrice: number;
  startShares: number;
  endShares: number;
  startValue: number;
  endValue: number;
  totalDividends: number;
  reinvestmentFactor: number;
  growthPercent: number;
  auditTrail: Array<{
    date: string;
    dividend: number;
    price: number;
    shares: number;
    factor: number;
  }>;
}

interface DripOptions {
  includeLastDividend?: boolean;
  paymentOffsetDays?: number;
  taxWithholding?: number;
}

function ensureSorted<T extends { date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

function addDaysISO(dateISO: string, days: number): string {
  const date = new Date(dateISO + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

function addBusinessDaysISO(dateISO: string, businessDays: number): string {
  if (businessDays === 0) return dateISO;
  
  const date = new Date(dateISO + 'T00:00:00Z');
  let daysAdded = 0;
  let totalDays = 0;
  
  while (daysAdded < businessDays) {
    totalDays++;
    date.setUTCDate(date.getUTCDate() + 1);
    const dayOfWeek = date.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }
  
  return date.toISOString().split('T')[0];
}

function priceOnOrBefore(prices: PriceRow[], targetDate: string): number | null {
  const sortedPrices = ensureSorted(prices);
  let result: number | null = null;
  
  for (const row of sortedPrices) {
    if (row.date <= targetDate) {
      result = row.close_price;
    } else {
      break;
    }
  }
  
  return result;
}

function indexOnOrAfter(prices: PriceRow[], targetDate: string): number {
  const sortedPrices = ensureSorted(prices);
  for (let i = 0; i < sortedPrices.length; i++) {
    if (sortedPrices[i].date >= targetDate) {
      return i;
    }
  }
  return sortedPrices.length;
}

function dripOverPeriod(
  prices: PriceRow[],
  distributions: DistRow[],
  startISO: string,
  endISO: string,
  initialShares: number = 1,
  options: DripOptions = {}
): DripResult {
  const { includeLastDividend = false, paymentOffsetDays = 2, taxWithholding = 0 } = options;
  
  const sortedPrices = ensureSorted(prices);
  const sortedDists = ensureSorted(distributions);
  
  const startPrice = priceOnOrBefore(sortedPrices, startISO);
  if (!startPrice) {
    throw new Error(`No price data available on or before ${startISO}`);
  }
  
  const startIdx = indexOnOrAfter(sortedPrices, startISO);
  const endIdx = indexOnOrAfter(sortedPrices, endISO);
  
  if (startIdx >= sortedPrices.length || endIdx > sortedPrices.length) {
    throw new Error(`Insufficient price data for period ${startISO} to ${endISO}`);
  }
  
  const endPrice = endIdx < sortedPrices.length ? 
    sortedPrices[endIdx].close_price : 
    sortedPrices[sortedPrices.length - 1].close_price;
  
  let shares = initialShares;
  let totalDividends = 0;
  const auditTrail: Array<{ date: string; dividend: number; price: number; shares: number; factor: number }> = [];
  
  const relevantDists = sortedDists.filter(d => {
    const exDate = d.ex_date;
    if (includeLastDividend) {
      return exDate >= startISO && exDate <= endISO;
    } else {
      return exDate >= startISO && exDate < endISO;
    }
  });
  
  for (const dist of relevantDists) {
    const reinvestDate = addBusinessDaysISO(dist.ex_date, paymentOffsetDays);
    const reinvestPrice = priceOnOrBefore(sortedPrices, reinvestDate);
    
    if (reinvestPrice && reinvestPrice > 0) {
      const dividendPerShare = dist.amount * (1 - taxWithholding);
      const totalDividend = shares * dividendPerShare;
      totalDividends += totalDividend;
      
      const additionalShares = totalDividend / reinvestPrice;
      const factor = (shares + additionalShares) / shares;
      
      shares += additionalShares;
      
      auditTrail.push({
        date: dist.ex_date,
        dividend: dividendPerShare,
        price: reinvestPrice,
        shares: additionalShares,
        factor: factor
      });
    }
  }
  
  const startValue = initialShares * startPrice;
  const endValue = shares * endPrice;
  const growthPercent = ((endValue - startValue) / startValue) * 100;
  const reinvestmentFactor = shares / initialShares;
  
  return {
    startPrice,
    endPrice,
    startShares: initialShares,
    endShares: shares,
    startValue,
    endValue,
    totalDividends,
    reinvestmentFactor,
    growthPercent,
    auditTrail
  };
}

function dripWindows(
  prices: PriceRow[],
  distributions: DistRow[],
  endDateISO: string,
  options: DripOptions = {}
): Record<string, DripResult> {
  const endDate = new Date(endDateISO + 'T00:00:00Z');
  
  const periods = [
    { key: '4w', days: 28 },
    { key: '13w', days: 91 },
    { key: '26w', days: 182 },
    { key: '52w', days: 364 }
  ];
  
  const results: Record<string, DripResult> = {};
  
  for (const period of periods) {
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - period.days);
    const startDateISO = startDate.toISOString().split('T')[0];
    
    try {
      results[period.key] = dripOverPeriod(prices, distributions, startDateISO, endDateISO, 1, options);
    } catch (error) {
      console.warn(`Could not calculate ${period.key} DRIP for period ${startDateISO} to ${endDateISO}:`, error.message);
    }
  }
  
  return results;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🕰️ Starting daily DRIP calculation...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active ETFs
    const { data: etfs, error: etfError } = await supabase
      .from('etfs')
      .select('ticker')
      .eq('active', true);

    if (etfError) throw etfError;

    const tickers = etfs?.map(etf => etf.ticker) || [];
    console.log(`📊 Processing ${tickers.length} active ETFs for DRIP calculation`);

    // Process in batches of 10 to avoid memory issues
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < tickers.length; i += batchSize) {
      batches.push(tickers.slice(i, i + batchSize));
    }

    let totalProcessed = 0;
    let totalErrors = 0;

    for (const [batchIndex, batch] of batches.entries()) {
      console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} tickers)`);
      
      // Calculate DRIP for this batch
      const endDateISO = new Date().toISOString().split('T')[0];
      const batchResults: Array<{
        ticker: string;
        calculation_date: string;
        data: any;
      }> = [];

      for (const ticker of batch) {
        try {
          // Fetch ETF info for tax calculations
          const { data: etfInfo } = await supabase
            .from('etfs')
            .select('country')
            .eq('ticker', ticker)
            .maybeSingle();

          // Fetch price data (last 400 days to ensure we have enough for 52w)
          const { data: priceData } = await supabase
            .from('historical_prices')
            .select('date, close_price')
            .eq('ticker', ticker)
            .gte('date', new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('date', { ascending: true });

          // Fetch dividend data (last 2 years)
          const { data: divData } = await supabase
            .from('dividends')
            .select('ex_date, amount')
            .eq('ticker', ticker)
            .gte('ex_date', new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('ex_date', { ascending: true });

          if (priceData && priceData.length > 0 && divData) {
            // Apply 15% withholding tax on foreign ETFs (assume CA user for daily calculation)
            const fundCountry = etfInfo?.country || 'US';
            const taxWithholding = (fundCountry === 'US') ? 0.15 : 0; // Default to CA user perspective
            
            const dripData = dripWindows(priceData, divData, endDateISO, { taxWithholding });
            
            batchResults.push({
              ticker,
              calculation_date: endDateISO,
              data: dripData
            });
            
            totalProcessed++;
          }
        } catch (error) {
          console.error(`❌ Error calculating DRIP for ${ticker}:`, error);
          totalErrors++;
        }
      }

      // Store batch results in database
      if (batchResults.length > 0) {
        const { error: insertError } = await supabase
          .from('drip_cache')
          .upsert(batchResults, { 
            onConflict: 'ticker,calculation_date',
            ignoreDuplicates: false 
          });

        if (insertError) {
          console.error('❌ Error storing DRIP batch:', insertError);
        } else {
          console.log(`✅ Stored ${batchResults.length} DRIP calculations`);
        }
      }

      // Small delay between batches to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`🎉 Daily DRIP calculation complete: ${totalProcessed} processed, ${totalErrors} errors`);

    return new Response(JSON.stringify({
      success: true,
      processed: totalProcessed,
      errors: totalErrors,
      total: tickers.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Daily DRIP calculation failed:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});