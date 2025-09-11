import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    console.log('🔍 Debug DRIP calculation issues...');

    // Test with a single ticker (MSTY)
    const testTicker = 'MSTY';
    
    // Get ETF info
    const { data: etfData, error: etfError } = await supabaseClient
      .from('etfs')
      .select('*')
      .eq('ticker', testTicker)
      .single();
      
    if (etfError || !etfData) {
      throw new Error(`Failed to get ETF data: ${etfError?.message}`);
    }
    
    console.log('📊 ETF Data:', etfData);
    
    // Get price data
    const { data: priceData, error: priceError } = await supabaseClient
      .from('historical_prices')
      .select('date, close_price')
      .eq('ticker', testTicker)
      .gte('date', new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: true })
      .limit(50);
      
    console.log(`📈 Price data count: ${priceData?.length || 0}`);
    console.log(`📈 Sample prices:`, priceData?.slice(-5));
    
    // Get dividend data
    const { data: divData, error: divError } = await supabaseClient
      .from('dividends')
      .select('ex_date, amount')
      .eq('ticker', testTicker)
      .gte('ex_date', new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('ex_date', { ascending: true })
      .limit(20);
      
    console.log(`💰 Dividend data count: ${divData?.length || 0}`);
    console.log(`💰 Sample dividends:`, divData?.slice(-5));
    
    // Check current DRIP cache
    const { data: usDripCache, error: usDripError } = await supabaseClient
      .from('drip_cache_us')
      .select('*')
      .eq('ticker', testTicker)
      .single();
      
    console.log('💾 US DRIP Cache:', usDripCache);
    
    // Try to manually calculate DRIP for 4-week period
    if (priceData && divData && priceData.length > 0) {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      console.log(`🔄 Manual calc from ${startDate} to ${endDate}`);
      
      // Find prices for this period
      const relevantPrices = priceData.filter(p => p.date >= startDate && p.date <= endDate);
      const relevantDivs = divData.filter(d => d.ex_date >= startDate && d.ex_date < endDate);
      
      console.log(`📊 Relevant prices: ${relevantPrices.length}, divs: ${relevantDivs.length}`);
      
      if (relevantPrices.length > 0) {
        const startPrice = relevantPrices[0].close_price;
        const endPrice = relevantPrices[relevantPrices.length - 1].close_price;
        const totalDivs = relevantDivs.reduce((sum, d) => sum + d.amount, 0);
        
        console.log(`💡 Simple calc: Start $${startPrice}, End $${endPrice}, Divs $${totalDivs}`);
        console.log(`💡 Price change: ${((endPrice - startPrice) / startPrice * 100).toFixed(2)}%`);
        console.log(`💡 Dividend yield: ${(totalDivs / startPrice * 100).toFixed(2)}%`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        ticker: testTicker,
        etfData: etfData,
        priceCount: priceData?.length || 0,
        divCount: divData?.length || 0,
        usDripCache: usDripCache
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Debug failed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})