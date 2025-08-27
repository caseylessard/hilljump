import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting manual daily updates...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      etfUpdate: null,
      dividendUpdate: null,
      dripUpdate: null,
      historicalUpdate: null,
      errors: []
    };

    // 1. Update ETF data from Yahoo Finance
    try {
      console.log('📊 Running Yahoo Finance ETF updates...');
      const { data: etfData, error: etfError } = await supabase.functions.invoke('daily-etf-updater-yahoo', {
        body: { manual: true }
      });
      if (etfError) throw etfError;
      results.etfUpdate = etfData;
      console.log('✅ ETF update completed');
    } catch (error) {
      console.error('❌ ETF update failed:', error);
      results.errors.push(`ETF update: ${error.message}`);
    }

    // 2. Update dividend data
    try {
      console.log('💰 Running dividend updates...');
      const { data: divData, error: divError } = await supabase.functions.invoke('dividend-updater', {
        body: { manual: true }
      });
      if (divError) throw divError;
      results.dividendUpdate = divData;
      console.log('✅ Dividend update completed');
    } catch (error) {
      console.error('❌ Dividend update failed:', error);
      results.errors.push(`Dividend update: ${error.message}`);
    }

    // 3. Calculate DRIP data
    try {
      console.log('📈 Running DRIP calculations...');
      const { data: dripData, error: dripError } = await supabase.functions.invoke('daily-drip-calculator', {
        body: { manual: true }
      });
      if (dripError) throw dripError;
      results.dripUpdate = dripData;
      console.log('✅ DRIP calculation completed');
    } catch (error) {
      console.error('❌ DRIP calculation failed:', error);
      results.errors.push(`DRIP calculation: ${error.message}`);
    }

    // 4. Update historical prices
    try {
      console.log('📊 Running historical price updates...');
      const { data: histData, error: histError } = await supabase.functions.invoke('update-historical-prices-daily', {
        body: { manual: true }
      });
      if (histError) throw histError;
      results.historicalUpdate = histData;
      console.log('✅ Historical price update completed');
    } catch (error) {
      console.error('❌ Historical price update failed:', error);
      results.errors.push(`Historical update: ${error.message}`);
    }

    console.log('🎉 Daily updates completed!');
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily updates completed',
        results,
        totalErrors: results.errors.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Daily updates failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});