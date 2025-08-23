import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchYahooPrice(ticker: string): Promise<number | null> {
  try {
    console.log(`Fetching Yahoo Finance data for ${ticker}...`);
    
    // Yahoo Finance API endpoint
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`Yahoo Finance API error for ${ticker}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.chart?.result?.[0]?.meta?.regularMarketPrice) {
      console.error(`No price data found for ${ticker}`);
      return null;
    }
    
    const price = data.chart.result[0].meta.regularMarketPrice;
    console.log(`✅ ${ticker}: $${price}`);
    
    return price;
  } catch (error) {
    console.error(`Error fetching price for ${ticker}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { ticker } = await req.json();
    
    if (!ticker) {
      return new Response(JSON.stringify({ error: 'Ticker required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔍 Fetching price for ${ticker}...`);
    
    const price = await fetchYahooPrice(ticker);
    
    if (price === null) {
      return new Response(JSON.stringify({ error: 'Could not fetch price' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update database if we have Supabase access
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { error: updateError } = await supabase
        .from('etfs')
        .update({ 
          current_price: price,
          price_updated_at: new Date().toISOString()
        })
        .eq('ticker', ticker);

      if (updateError) {
        console.error('Database update error:', updateError);
      } else {
        console.log(`✅ Updated ${ticker} price in database: $${price}`);
      }
    } catch (dbError) {
      console.error('Database connection error:', dbError);
    }

    return new Response(JSON.stringify({ 
      ticker,
      price,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});