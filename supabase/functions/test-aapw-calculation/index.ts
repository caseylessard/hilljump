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

    console.log('🧪 Testing AAPW DRIP calculation and storage');

    // Manual calculation for AAPW 4-week period
    const calculateDRIP = () => {
      let shares = 1.0;
      
      // Aug 18: $0.485 dividend, reinvest at $38.06
      shares += (shares * 0.485) / 38.06;
      
      // Aug 25: $0.231 dividend, reinvest at $37.82  
      shares += (shares * 0.231) / 37.82;
      
      // Sep 2: $0.173 dividend, reinvest at $38.88
      shares += (shares * 0.173) / 38.88;
      
      // Sep 8: $0.233 dividend, reinvest at $37.99
      shares += (shares * 0.233) / 37.99;
      
      const startValue = 1.0 * 39.21;
      const endValue = shares * 36.58;
      const growthPercent = ((endValue - startValue) / startValue) * 100;
      
      return {
        growthPercent,
        startPrice: 39.21,
        endPrice: 36.58,
        endShares: shares,
        reinvestmentFactor: shares
      };
    };

    const result4w = calculateDRIP();
    console.log(`📊 AAPW 4W DRIP: ${result4w.growthPercent.toFixed(2)}%`);

    // Store the result
    const dripResult = {
      ticker: 'AAPW',
      period_4w: result4w,
      period_13w: { growthPercent: 0, startPrice: 39.21, endPrice: 36.58, endShares: 1, reinvestmentFactor: 1 },
      period_26w: { growthPercent: 0, startPrice: 39.21, endPrice: 36.58, endShares: 1, reinvestmentFactor: 1 },
      period_52w: { growthPercent: 0, startPrice: 39.21, endPrice: 36.58, endShares: 1, reinvestmentFactor: 1 },
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('drip_cache_us')
      .upsert(dripResult, { onConflict: 'ticker' });

    if (error) {
      console.error('❌ Storage failed:', error);
      throw error;
    }

    console.log('✅ Successfully stored AAPW DRIP calculation');

    // Verify storage
    const { data: stored } = await supabase
      .from('drip_cache_us')
      .select('*')
      .eq('ticker', 'AAPW')
      .single();

    console.log('🔍 Stored data:', stored);

    return new Response(JSON.stringify({
      success: true,
      calculation: result4w,
      stored: stored
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});