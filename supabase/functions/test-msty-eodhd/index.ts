import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 Testing EODHD Premium Data Quality for MSTY');
    
    const eodhApiKey = Deno.env.get('EODHD_API_KEY');
    if (!eodhApiKey) {
      return new Response(
        JSON.stringify({ error: 'EODHD API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const ticker = 'MSTY';
    const results: any = {
      ticker,
      timestamp: new Date().toISOString(),
      comparison: {}
    };

    // 1. Test Real-Time Price ONLY (fundamentals not included in basic plan)
    console.log(`📊 Testing real-time price for ${ticker} (fundamentals not available in basic plan)`);
    try {
      const priceUrl = `https://eodhd.com/api/real-time/${ticker}?api_token=${eodhApiKey}&fmt=json`;
      const priceResponse = await fetch(priceUrl);
      
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        results.realtime_price = {
          success: true,
          price: priceData.close || priceData.price,
          volume: priceData.volume,
          change: priceData.change,
          change_p: priceData.change_p,
          timestamp: priceData.timestamp,
          raw_data: priceData
        };
        console.log(`✅ Real-time price: $${results.realtime_price.price}`);
      } else {
        results.realtime_price = { 
          success: false, 
          error: `HTTP ${priceResponse.status}`,
          status: priceResponse.status
        };
      }
    } catch (error) {
      results.realtime_price = { success: false, error: error.message };
    }

    // 2. Note: Fundamentals and Historical Data require higher-tier EODHD plans
    results.plan_limitations = {
      fundamentals: 'Not included in basic plan - requires higher tier',
      historical_data: 'Limited in basic plan - use Yahoo Finance for comprehensive historical data',
      recommendation: 'Current setup: EODHD for real-time prices + Yahoo Finance for fundamentals'
    };

    // 3. API Call Summary (adjusted for basic plan)
    results.api_usage = {
      calls_made: 1, // Only real-time price call
      estimated_daily_for_192_etfs: 192 * 1, // 192 price calls only
      percentage_of_100k_limit: ((192 * 1) / 100000 * 100).toFixed(3) + '%',
      note: 'Basic plan optimized for price-only calls'
    };

    // 4. Data Quality Comparison
    results.comparison = {
      current_system: {
        price: '$17.33',
        age: '24+ hours old',
        source: 'Yahoo Finance (unreliable)',
        comprehensive_data: false
      },
      eodhd_premium: {
        price: results.realtime_price.success ? `$${results.realtime_price.price}` : 'Failed to fetch',
        age: 'Real-time',
        source: 'EODHD Professional API (Basic Plan)',
        comprehensive_data: 'Price + Volume only (basic plan)',
        included_metrics: [
          'Real-time price & volume',
          'Change & percentage change',
          'Market hours coverage'
        ],
        not_included: [
          'Fundamentals (requires higher tier)',
          'Extended historical data',
          'Advanced analytics'
        ],
        hybrid_solution: 'EODHD prices + Yahoo Finance fundamentals = Best of both worlds'
      }
    };

    console.log('🎉 EODHD test completed for MSTY');
    
    return new Response(
      JSON.stringify(results, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error testing EODHD for MSTY:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});