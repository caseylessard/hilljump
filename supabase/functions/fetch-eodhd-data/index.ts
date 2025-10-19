import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EODHDPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close: number;
  volume: number;
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
        JSON.stringify({ error: 'Ticker symbol is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const EODHD_API_KEY = Deno.env.get('EODHD_API_KEY');
    
    if (!EODHD_API_KEY) {
      console.error('EODHD_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch data from EODHD
    const url = `https://eodhd.com/api/eod/${ticker}.US?api_token=${EODHD_API_KEY}&period=d&fmt=json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`EODHD API error for ${ticker}: ${response.status}`);
      return new Response(
        JSON.stringify({ 
          error: `Failed to fetch data for ${ticker}`,
          status: response.status 
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    const data: EODHDPrice[] = await response.json();
    
    // Return the data (limit to 365 days)
    return new Response(
      JSON.stringify({
        ticker,
        historicalPrices: data.slice(0, 365)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in fetch-eodhd-data function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
