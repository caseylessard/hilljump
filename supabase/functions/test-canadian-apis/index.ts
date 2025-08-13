// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const results: any = {};
    
    // Test QQCL with Yahoo Finance
    console.log('Testing QQCL.TO with Yahoo Finance...');
    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/QQCL.TO`;
      const yahooResponse = await fetch(yahooUrl);
      const yahooData = await yahooResponse.json();
      results.qqcl_yahoo = {
        url: yahooUrl,
        status: yahooResponse.status,
        data: yahooData
      };
      console.log('QQCL Yahoo data:', JSON.stringify(yahooData, null, 2));
    } catch (error) {
      results.qqcl_yahoo_error = error.message;
    }

    // Test HTAE with Yahoo Finance  
    console.log('Testing HTAE.TO with Yahoo Finance...');
    try {
      const yahooUrl2 = `https://query1.finance.yahoo.com/v8/finance/chart/HTAE.TO`;
      const yahooResponse2 = await fetch(yahooUrl2);
      const yahooData2 = await yahooResponse2.json();
      results.htae_yahoo = {
        url: yahooUrl2,
        status: yahooResponse2.status,
        data: yahooData2
      };
      console.log('HTAE Yahoo data:', JSON.stringify(yahooData2, null, 2));
    } catch (error) {
      results.htae_yahoo_error = error.message;
    }

    // Test with Alpha Vantage if key is available
    const alphaVantageKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
    if (alphaVantageKey) {
      console.log('Testing QQCL.TO with Alpha Vantage...');
      try {
        const alphaUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=QQCL.TO&apikey=${alphaVantageKey}`;
        const alphaResponse = await fetch(alphaUrl);
        const alphaData = await alphaResponse.json();
        results.qqcl_alpha = {
          url: alphaUrl,
          status: alphaResponse.status,
          data: alphaData
        };
        console.log('QQCL Alpha Vantage data:', JSON.stringify(alphaData, null, 2));
      } catch (error) {
        results.qqcl_alpha_error = error.message;
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Test API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});