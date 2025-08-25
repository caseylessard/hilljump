import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

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
    const { tickers } = await req.json();
    if (!Array.isArray(tickers)) {
      throw new Error("tickers must be an array");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`📊 Fetching cached DRIP data for ${tickers.length} tickers`);

    // Fetch cached DRIP data from database - get most recent calculation for each ticker
    const { data: cachedData, error } = await supabase
      .from('drip_cache')
      .select('ticker, data, calculation_date, created_at')
      .in('ticker', tickers)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // Group by ticker and take the most recent entry for each
    const dripData: Record<string, any> = {};
    const seenTickers = new Set<string>();
    
    (cachedData || []).forEach((entry: any) => {
      if (!seenTickers.has(entry.ticker)) {
        seenTickers.add(entry.ticker);
        dripData[entry.ticker] = entry.data;
      }
    });

    const foundCount = Object.keys(dripData).length;
    const missingTickers = tickers.filter(ticker => !dripData[ticker]);
    
    console.log(`✅ Found cached DRIP data for ${foundCount}/${tickers.length} tickers`);
    if (missingTickers.length > 0) {
      console.log(`⚠️ Missing DRIP data for: ${missingTickers.join(', ')}`);
    }
    
    return new Response(JSON.stringify({ 
      dripData,
      cached: foundCount,
      total: tickers.length,
      missing: missingTickers
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error fetching cached DRIP data:', error);
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