import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { ticker } = await req.json();

    const apiKey = Deno.env.get("EODHD_API_KEY");
    if (!apiKey) {
      throw new Error("EODHD_API_KEY not configured");
    }

    const url = `https://eodhd.com/api/fundamentals/${ticker}.US?api_token=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status}`);
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        ticker,
        earnings: data.Earnings || null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
