import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { ticker } = await req.json();
    
    if (!ticker) {
      throw new Error("Ticker is required");
    }

    // Get API key from environment
    const apiKey = Deno.env.get("EODHD_API_KEY");
    
    if (!apiKey) {
      throw new Error("EODHD_API_KEY not configured");
    }

    // Fetch earnings data from EODHD
    const url = `https://eodhd.com/api/fundamentals/${ticker}.US?api_token=${apiKey}`;
    
    console.log(`Fetching earnings for ${ticker}...`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract only the earnings-related data we need
    const earningsData = {
      ticker,
      earnings: data.Earnings || null,
    };

    return new Response(JSON.stringify(earningsData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
