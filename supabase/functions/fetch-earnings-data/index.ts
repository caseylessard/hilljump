import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tickers } = await req.json(); // Changed: accept array of tickers

    if (!tickers || !Array.isArray(tickers)) {
      throw new Error("Tickers array is required");
    }

    const apiKey = Deno.env.get("FMP_API_KEY");

    if (!apiKey) {
      throw new Error("FMP_API_KEY not configured");
    }

    console.log(`📊 Fetching earnings for ${tickers.length} tickers in ONE API call...`);

    // ONE API call gets ALL earnings
    const url = `https://financialmodelingprep.com/stable/earnings-calendar?apikey=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ FMP error: ${errorText.substring(0, 200)}`);

      // Return empty earnings for all tickers
      const results: any = {};
      tickers.forEach((ticker) => {
        results[ticker] = null;
      });

      return new Response(JSON.stringify({ earnings: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const allEarnings = await response.json();
    console.log(`📦 Got ${allEarnings.length} total earnings records from FMP`);

    // Process earnings for each ticker
    const results: any = {};
    const now = new Date();

    tickers.forEach((ticker) => {
      // Filter for this ticker
      const tickerEarnings = allEarnings.filter(
        (e: any) => e.symbol === ticker || e.symbol === `${ticker}.US` || e.symbol.startsWith(ticker),
      );

      if (tickerEarnings.length === 0) {
        results[ticker] = null;
        return;
      }

      // Find next earnings date
      const futureEarnings = tickerEarnings
        .filter((e: any) => new Date(e.date) > now)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let earningsDate: string | undefined;
      if (futureEarnings.length > 0) {
        earningsDate = futureEarnings[0].date;
      }

      // Calculate beat rate from last 8 quarters
      const pastEarnings = tickerEarnings
        .filter((e: any) => new Date(e.date) <= now && e.epsActual !== null)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8);

      let epsBeats = 0;
      let epsCount = 0;

      pastEarnings.forEach((quarter: any) => {
        const estimate = quarter.epsEstimated;
        const actual = quarter.epsActual;

        if (estimate !== null && actual !== null && estimate !== undefined && actual !== undefined) {
          epsCount++;
          if (actual >= estimate) {
            epsBeats++;
          }
        }
      });

      const epsBeatRate = epsCount > 0 ? (epsBeats / epsCount) * 100 : undefined;

      results[ticker] = {
        nextEarningsDate: earningsDate,
        earningsHistory: pastEarnings,
        epsBeatRate: epsBeatRate,
      };
    });

    console.log(`✅ Processed earnings for ${Object.keys(results).length} tickers`);

    return new Response(JSON.stringify({ earnings: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error(`❌ Error:`, error.message);

    return new Response(JSON.stringify({ earnings: {} }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
