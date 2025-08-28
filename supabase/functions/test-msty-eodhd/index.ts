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

    // 1. Test Real-Time Price
    console.log(`📊 Testing real-time price for ${ticker}`);
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

    // 2. Test Fundamentals Data
    console.log(`📈 Testing fundamentals for ${ticker}`);
    try {
      const fundUrl = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${eodhApiKey}&fmt=json`;
      const fundResponse = await fetch(fundUrl);
      
      if (fundResponse.ok) {
        const fundData = await fundResponse.json();
        results.fundamentals = {
          success: true,
          dividend_yield: fundData?.AnalystRatings?.DividendYield || fundData?.Highlights?.DividendYield,
          total_assets: fundData?.General?.TotalAssets || fundData?.Highlights?.TotalAssets,
          expense_ratio: fundData?.General?.ExpenseRatio || fundData?.Highlights?.ExpenseRatio,
          shares_outstanding: fundData?.General?.SharesOutstanding || fundData?.Highlights?.SharesOutstanding,
          description: fundData?.General?.Description,
          fund_family: fundData?.General?.FundFamily,
          category: fundData?.General?.Category,
          available_fields: Object.keys(fundData || {})
        };
        console.log(`✅ Fundamentals loaded: ${results.fundamentals.available_fields.length} data sections`);
      } else {
        results.fundamentals = { 
          success: false, 
          error: `HTTP ${fundResponse.status}`,
          status: fundResponse.status
        };
      }
    } catch (error) {
      results.fundamentals = { success: false, error: error.message };
    }

    // 3. Test Historical Data (last 30 days for quick test)
    console.log(`📊 Testing historical data for ${ticker}`);
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const histUrl = `https://eodhd.com/api/eod/${ticker}?api_token=${eodhApiKey}&period=d&from=${startDate}&to=${endDate}`;
      const histResponse = await fetch(histUrl);
      
      if (histResponse.ok) {
        const histData = await histResponse.json();
        
        if (Array.isArray(histData) && histData.length > 0) {
          const oldestPrice = histData[0]?.close;
          const newestPrice = histData[histData.length - 1]?.close;
          const monthReturn = oldestPrice > 0 ? ((newestPrice - oldestPrice) / oldestPrice) * 100 : null;
          
          results.historical = {
            success: true,
            data_points: histData.length,
            date_range: `${startDate} to ${endDate}`,
            oldest_price: oldestPrice,
            newest_price: newestPrice,
            month_return: monthReturn ? `${monthReturn.toFixed(2)}%` : 'N/A',
            sample_data: histData.slice(0, 3) // First 3 days
          };
          console.log(`✅ Historical data: ${histData.length} days, ${monthReturn?.toFixed(2)}% monthly return`);
        } else {
          results.historical = { success: false, error: 'No historical data returned' };
        }
      } else {
        results.historical = { 
          success: false, 
          error: `HTTP ${histResponse.status}`,
          status: histResponse.status
        };
      }
    } catch (error) {
      results.historical = { success: false, error: error.message };
    }

    // 4. API Call Summary
    results.api_usage = {
      calls_made: 3,
      estimated_daily_for_192_etfs: 192 * 3,
      percentage_of_100k_limit: ((192 * 3) / 100000 * 100).toFixed(3) + '%'
    };

    // 5. Data Quality Comparison
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
        source: 'EODHD Professional API',
        comprehensive_data: true,
        additional_metrics: [
          'Real-time price & volume',
          'Dividend yield',
          'Total assets (AUM)',
          'Expense ratio',
          'Historical performance',
          'Risk metrics',
          'Fund details'
        ]
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