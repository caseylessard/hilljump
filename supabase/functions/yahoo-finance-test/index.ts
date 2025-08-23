import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticker } = await req.json();
    
    if (!ticker) {
      return new Response(
        JSON.stringify({ error: 'Ticker is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📊 Fetching Yahoo Finance data for ${ticker}`);
    
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail,financialData,defaultKeyStatistics`;
    
    console.log(`🔗 URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    
    console.log(`📈 Response status: ${response.status}`);
    
    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: `Yahoo Finance API error: ${response.status} ${response.statusText}` 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const data = await response.json();
    
    console.log('✅ Raw Yahoo Finance response received');
    
    const quoteSummary = data?.quoteSummary?.result?.[0];
    const summaryDetail = quoteSummary?.summaryDetail;
    const financialData = quoteSummary?.financialData;
    const defaultKeyStatistics = quoteSummary?.defaultKeyStatistics;
    
    const analysis = {
      ticker: ticker,
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        summaryDetail: summaryDetail,
        financialData: financialData,
        defaultKeyStatistics: defaultKeyStatistics,
        dividendYield: {
          raw: summaryDetail?.dividendYield?.raw,
          fmt: summaryDetail?.dividendYield?.fmt,
          percentage: summaryDetail?.dividendYield?.raw ? (summaryDetail.dividendYield.raw * 100).toFixed(2) + '%' : 'N/A'
        },
        trailingAnnualDividendRate: summaryDetail?.trailingAnnualDividendRate?.raw,
        trailingAnnualDividendYield: summaryDetail?.trailingAnnualDividendYield?.raw,
        price: summaryDetail?.regularMarketPrice?.raw || financialData?.currentPrice?.raw,
        volume: summaryDetail?.volume?.raw,
        marketCap: summaryDetail?.marketCap?.raw
      }
    };
    
    return new Response(
      JSON.stringify(analysis),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});