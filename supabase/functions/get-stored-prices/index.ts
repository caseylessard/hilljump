import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tickers } = await req.json();
    if (!Array.isArray(tickers)) {
      throw new Error("tickers must be an array");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch current prices from database
    const { data: etfs, error } = await supabase
      .from('etfs')
      .select('ticker, current_price, price_updated_at')
      .in('ticker', tickers)
      .not('current_price', 'is', null);

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // Format prices for response
    const prices: Record<string, any> = {};
    
    (etfs || []).forEach((etf: any) => {
      if (etf.current_price && etf.current_price > 0) {
        prices[etf.ticker] = {
          price: etf.current_price,
          lastUpdated: etf.price_updated_at
        };
      }
    });

    console.log(`📊 Retrieved ${Object.keys(prices).length} stored prices for ${tickers.length} tickers`);
    
    return new Response(JSON.stringify({ prices }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error fetching stored prices:', error);
    return new Response(
      JSON.stringify({ error: String(error?.message || error) }), 
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
});