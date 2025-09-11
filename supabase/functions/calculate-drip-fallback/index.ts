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
    const { tickers, taxCountry = 'US' } = await req.json();
    console.log(`🚨 DRIP Fallback calculation for ${tickers?.length || 0} tickers (${taxCountry})`);
    
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No tickers provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limiting check - only allow calculation once per hour per ticker
    const tableName = taxCountry === 'CA' ? 'drip_cache_ca' : 'drip_cache_us';
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: recentCalcs } = await supabase
      .from(tableName)
      .select('ticker, updated_at')
      .in('ticker', tickers)
      .gte('updated_at', oneHourAgo);

    const recentTickers = new Set(recentCalcs?.map(r => r.ticker) || []);
    const tickersToCalculate = tickers.filter((t: string) => !recentTickers.has(t));
    
    if (tickersToCalculate.length === 0) {
      console.log('⏰ All tickers calculated within last hour, skipping');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'All tickers recently calculated',
        calculated: 0,
        skipped: tickers.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔄 Calculating DRIP for ${tickersToCalculate.length} tickers, skipping ${recentTickers.size} recent`);

    const results: any[] = [];
    const endDateISO = new Date().toISOString().split('T')[0];

    // Simple DRIP calculation for fallback
    for (const ticker of tickersToCalculate.slice(0, 10)) { // Limit to 10 tickers per call
      try {
        // Get recent price data (last 400 days)
        const { data: priceData } = await supabase
          .from('historical_prices')
          .select('date, close_price')
          .eq('ticker', ticker)
          .gte('date', new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date', { ascending: true });

        // Get dividend data (last 2 years)
        const { data: divData } = await supabase
          .from('dividends')
          .select('ex_date, amount')
          .eq('ticker', ticker)
          .gte('ex_date', new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('ex_date', { ascending: true });

        if (!priceData?.length || !divData?.length) {
          console.warn(`⚠️ ${ticker}: Insufficient data`);
          continue;
        }

        // Calculate simple 4-week DRIP
        const calculateSimpleDRIP = (days: number) => {
          const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          
          const periodPrices = priceData.filter(p => p.date >= startDate && p.date <= endDateISO);
          const periodDivs = divData.filter(d => d.ex_date >= startDate && d.ex_date < endDateISO);
          
          if (periodPrices.length < 2) return null;
          
          let shares = 1;
          let totalDividends = 0;
          const startPrice = periodPrices[0].close_price;
          const endPrice = periodPrices[periodPrices.length - 1].close_price;

          // Simple reinvestment logic
          for (const div of periodDivs) {
            const reinvestPrice = periodPrices.find(p => p.date >= div.ex_date)?.close_price;
            if (reinvestPrice && reinvestPrice > 0) {
              const dividendAmount = shares * div.amount;
              shares += dividendAmount / reinvestPrice;
              totalDividends += dividendAmount;
            }
          }

          const startValue = 1 * startPrice;
          const endValue = shares * endPrice;
          const growthPercent = ((endValue - startValue) / startValue) * 100;

          return {
            growthPercent,
            startPrice,
            endPrice,
            totalDividends,
            endShares: shares,
            reinvestmentFactor: shares
          };
        };

        const drip4w = calculateSimpleDRIP(28);
        const drip13w = calculateSimpleDRIP(91);
        const drip26w = calculateSimpleDRIP(182);
        const drip52w = calculateSimpleDRIP(364);

        // Ensure we have valid structured data
        const result = {
          ticker,
          period_4w: drip4w ? JSON.stringify(drip4w) : null,
          period_13w: drip13w ? JSON.stringify(drip13w) : null,
          period_26w: drip26w ? JSON.stringify(drip26w) : null,
          period_52w: drip52w ? JSON.stringify(drip52w) : null,
          updated_at: new Date().toISOString()
        };
        
        console.log(`📊 ${ticker} DRIP Results:`, {
          '4W': drip4w?.growthPercent?.toFixed(2) + '%',
          '13W': drip13w?.growthPercent?.toFixed(2) + '%',
          '26W': drip26w?.growthPercent?.toFixed(2) + '%',
          '52W': drip52w?.growthPercent?.toFixed(2) + '%'
        });
        
        results.push(result);

        console.log(`✅ ${ticker}: 4W=${drip4w?.growthPercent?.toFixed(1)}%`);

      } catch (error) {
        console.error(`❌ ${ticker} calculation failed:`, error.message);
      }
    }

    // Store results
    if (results.length > 0) {
      const { error } = await supabase
        .from(tableName)
        .upsert(results, { onConflict: 'ticker' });

      if (error) {
        console.error('❌ Failed to store fallback results:', error);
      } else {
        console.log(`✅ Stored ${results.length} fallback DRIP calculations`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      calculated: results.length,
      skipped: recentTickers.size,
      total: tickers.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Fallback calculation failed:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});