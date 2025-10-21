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
    const { ticker } = await req.json();

    if (!ticker) {
      throw new Error("Ticker is required");
    }

    const apiKey = Deno.env.get("FMP_API_KEY");

    if (!apiKey) {
      throw new Error("FMP_API_KEY not configured");
    }

    console.log(`📊 Fetching earnings for ${ticker} from FMP...`);

    // Get earnings calendar (includes next earnings date)
    const calendarUrl = `https://financialmodelingprep.com/api/v3/earning_calendar?symbol=${ticker}&apikey=${apiKey}`;
    const calendarResponse = await fetch(calendarUrl);

    if (!calendarResponse.ok) {
      throw new Error(`FMP calendar error: ${calendarResponse.status}`);
    }

    const calendarData = await calendarResponse.json();

    // Get historical earnings (for beat rate)
    const historyUrl = `https://financialmodelingprep.com/api/v3/historical/earning_calendar/${ticker}?apikey=${apiKey}`;
    const historyResponse = await fetch(historyUrl);

    if (!historyResponse.ok) {
      throw new Error(`FMP history error: ${historyResponse.status}`);
    }

    const historyData = await historyResponse.json();

    console.log(`📅 Calendar entries: ${calendarData.length}`);
    console.log(`📊 History entries: ${historyData.length}`);

    // Get next earnings date (future dates only)
    let earningsDate: string | undefined;
    const now = new Date();

    const futureEarnings = calendarData.filter((e: any) => new Date(e.date) > now);
    if (futureEarnings.length > 0) {
      earningsDate = futureEarnings[0].date;
      console.log(`📆 Next earnings: ${earningsDate}`);
    }

    // Calculate beat rate from last 8 quarters
    const recentHistory = historyData.slice(0, 8);
    let epsBeats = 0;
    let epsCount = 0;

    recentHistory.forEach((quarter: any) => {
      const estimate = quarter.epsEstimated;
      const actual = quarter.eps;

      if (estimate !== null && actual !== null && estimate !== undefined && actual !== undefined) {
        epsCount++;
        if (actual >= estimate) {
          epsBeats++;
        }
      }
    });

    const epsBeatRate = epsCount > 0 ? (epsBeats / epsCount) * 100 : undefined;

    console.log(`✅ Beat rate: ${epsBeatRate}% (${epsBeats}/${epsCount})`);

    return new Response(
      JSON.stringify({
        ticker,
        earnings: {
          nextEarningsDate: earningsDate,
          earningsHistory: historyData,
          epsBeatRate: epsBeatRate,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error(`❌ Error:`, error.message);

    return new Response(
      JSON.stringify({
        error: error.message,
        ticker: null,
        earnings: null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  }
});
