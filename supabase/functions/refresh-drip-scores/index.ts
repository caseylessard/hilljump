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

    console.log('🔄 Starting DRIP and Score refresh...');

    // Step 1: Run DRIP calculator
    console.log('📊 Step 1: Calculating DRIP data...');
    const dripResponse = await supabaseClient.functions.invoke('daily-drip-calculator');
    
    if (dripResponse.error) {
      console.error('❌ DRIP calculation failed:', dripResponse.error);
    } else {
      console.log('✅ DRIP calculation completed:', dripResponse.data);
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Run score updater
    console.log('📊 Step 2: Updating ETF scores...');
    const scoreResponse = await supabaseClient.functions.invoke('hourly-score-updater');
    
    if (scoreResponse.error) {
      console.error('❌ Score update failed:', scoreResponse.error);
    } else {
      console.log('✅ Score update completed:', scoreResponse.data);
    }

    // Step 3: Check results
    console.log('📊 Step 3: Checking results...');
    
    // Check DRIP data
    const { data: dripCheck } = await supabaseClient
      .from('drip_cache_us')
      .select('ticker, period_4w')
      .not('period_4w', 'is', null)
      .limit(5);
    
    // Check scores
    const { data: scoreCheck } = await supabaseClient
      .from('etf_scores')
      .select('ticker, composite_score')
      .neq('composite_score', 50)
      .eq('country', 'US')
      .limit(5);
    
    console.log(`📊 Results: ${dripCheck?.length || 0} ETFs with DRIP data, ${scoreCheck?.length || 0} ETFs with updated scores`);

    return new Response(
      JSON.stringify({ 
        success: true,
        dripResponse: dripResponse.data,
        scoreResponse: scoreResponse.data,
        dripCount: dripCheck?.length || 0,
        scoreCount: scoreCheck?.length || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Refresh failed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})