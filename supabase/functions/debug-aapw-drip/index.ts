import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const ticker = 'AAPW';
    console.log(`🔍 Manual DRIP calculation for ${ticker}`);

    // Get 60 days of price data
    const { data: priceData } = await supabase
      .from('historical_prices')
      .select('date, close_price')
      .eq('ticker', ticker)
      .gte('date', '2025-07-15')
      .order('date', { ascending: true });

    // Get dividend data
    const { data: divData } = await supabase
      .from('dividends')
      .select('ex_date, amount')
      .eq('ticker', ticker)
      .gte('ex_date', '2025-07-15')
      .order('ex_date', { ascending: true });

    console.log(`📊 Price data points: ${priceData?.length || 0}`);
    console.log(`💰 Dividend data points: ${divData?.length || 0}`);

    if (!priceData?.length || !divData?.length) {
      throw new Error('Insufficient data for calculation');
    }

    // Manual 4-week DRIP calculation
    const endDate = '2025-09-10';
    const startDate = '2025-08-13'; // 28 days back

    console.log(`📅 Period: ${startDate} to ${endDate}`);

    const periodPrices = priceData.filter(p => p.date >= startDate && p.date <= endDate);
    const periodDivs = divData.filter(d => d.ex_date >= startDate && d.ex_date < endDate);

    console.log('📈 Price data for period:');
    periodPrices.forEach(p => console.log(`  ${p.date}: $${p.close_price}`));

    console.log('💵 Dividends in period:');
    periodDivs.forEach(d => console.log(`  ${d.ex_date}: $${d.amount}`));

    if (periodPrices.length < 2) {
      throw new Error('Not enough price data for calculation');
    }

    const startPrice = periodPrices[0].close_price;
    const endPrice = periodPrices[periodPrices.length - 1].close_price;
    
    console.log(`🏁 Start price: $${startPrice}`);
    console.log(`🎯 End price: $${endPrice}`);

    // DRIP simulation
    let shares = 1.0; // Start with 1 share
    let totalDividends = 0;
    const reinvestmentLog: any[] = [];

    console.log(`\n🔄 DRIP Simulation Starting with 1 share:`);

    for (const div of periodDivs) {
      const dividendPerShare = div.amount;
      const totalDividendReceived = shares * dividendPerShare;
      
      // Find the next available price for reinvestment (on or after ex-date)
      const reinvestPrice = periodPrices.find(p => p.date >= div.ex_date)?.close_price;
      
      if (reinvestPrice && reinvestPrice > 0) {
        const newShares = totalDividendReceived / reinvestPrice;
        shares += newShares;
        totalDividends += totalDividendReceived;
        
        const logEntry = {
          date: div.ex_date,
          dividend_per_share: dividendPerShare,
          shares_before: shares - newShares,
          total_dividend: totalDividendReceived,
          reinvest_price: reinvestPrice,
          new_shares: newShares,
          total_shares: shares
        };
        
        reinvestmentLog.push(logEntry);
        
        console.log(`  ${div.ex_date}: $${dividendPerShare}/share × ${(shares - newShares).toFixed(4)} = $${totalDividendReceived.toFixed(4)} → ${newShares.toFixed(4)} new shares @ $${reinvestPrice} → ${shares.toFixed(4)} total`);
      } else {
        console.log(`  ${div.ex_date}: No price found for reinvestment`);
      }
    }

    // Calculate final values
    const startValue = 1.0 * startPrice;
    const endValue = shares * endPrice;
    const growthPercent = ((endValue - startValue) / startValue) * 100;
    const priceOnlyReturn = ((endPrice - startPrice) / startPrice) * 100;
    const dividendContribution = growthPercent - priceOnlyReturn;

    const result = {
      ticker,
      period: '4 weeks',
      start_date: startDate,
      end_date: endDate,
      start_price: startPrice,
      end_price: endPrice,
      start_value: startValue,
      end_value: endValue,
      total_shares: shares,
      total_dividends: totalDividends,
      growth_percent: growthPercent,
      price_only_return: priceOnlyReturn,
      dividend_contribution: dividendContribution,
      reinvestment_factor: shares,
      reinvestment_log: reinvestmentLog
    };

    console.log(`\n📊 Final Results:`);
    console.log(`  Start Value: $${startValue.toFixed(2)} (1 share × $${startPrice})`);
    console.log(`  End Value: $${endValue.toFixed(2)} (${shares.toFixed(4)} shares × $${endPrice})`);
    console.log(`  Total Dividends: $${totalDividends.toFixed(4)}`);
    console.log(`  DRIP Growth: ${growthPercent.toFixed(2)}%`);
    console.log(`  Price-Only Return: ${priceOnlyReturn.toFixed(2)}%`);
    console.log(`  Dividend Contribution: ${dividendContribution.toFixed(2)}%`);

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Debug calculation failed:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});