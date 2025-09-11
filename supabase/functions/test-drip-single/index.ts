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
    
    const { ticker = 'MSTY' } = await req.json();
    console.log(`🧪 Testing DRIP calculation for ${ticker}`);

    // Get sample data
    const { data: priceData } = await supabase
      .from('historical_prices')
      .select('date, close_price')
      .eq('ticker', ticker)
      .gte('date', '2024-01-01')
      .order('date', { ascending: true });

    const { data: divData } = await supabase
      .from('dividends')
      .select('ex_date, amount')
      .eq('ticker', ticker)
      .gte('ex_date', '2024-01-01')
      .order('ex_date', { ascending: true });

    console.log(`📊 Found ${priceData?.length || 0} price records, ${divData?.length || 0} dividend records`);
    
    if (!priceData?.length || !divData?.length) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Insufficient data',
        priceCount: priceData?.length || 0,
        divCount: divData?.length || 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Simple 4-week calculation test
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Filter data for period
    const periodPrices = priceData.filter(p => p.date >= startDate && p.date <= endDate);
    const periodDivs = divData.filter(d => d.ex_date >= startDate && d.ex_date < endDate);
    
    console.log(`📊 Period ${startDate} to ${endDate}: ${periodPrices.length} prices, ${periodDivs.length} dividends`);

    // Simple DRIP calculation
    let shares = 1;
    let totalDividends = 0;
    const startPrice = periodPrices[0]?.close_price || 0;
    const endPrice = periodPrices[periodPrices.length - 1]?.close_price || 0;

    for (const div of periodDivs) {
      // Find price on or after dividend date (simple reinvestment)
      const reinvestPrice = periodPrices.find(p => p.date >= div.ex_date)?.close_price;
      if (reinvestPrice && reinvestPrice > 0) {
        const dividendAmount = shares * div.amount;
        const additionalShares = dividendAmount / reinvestPrice;
        shares += additionalShares;
        totalDividends += dividendAmount;
        
        console.log(`💰 ${div.ex_date}: $${div.amount} → +${additionalShares.toFixed(4)} shares @ $${reinvestPrice}`);
      }
    }

    const startValue = 1 * startPrice;
    const endValue = shares * endPrice;
    const growthPercent = ((endValue - startValue) / startValue) * 100;

    const result = {
      ticker,
      period: '4w',
      startDate,
      endDate,
      startPrice,
      endPrice,
      startShares: 1,
      endShares: shares,
      startValue,
      endValue,
      totalDividends,
      growthPercent,
      priceData: periodPrices.length,
      divData: periodDivs.length
    };

    console.log(`✅ ${ticker} 4W DRIP: ${growthPercent.toFixed(2)}% (${shares.toFixed(4)} shares)`);

    return new Response(JSON.stringify({
      success: true,
      result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});