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

    console.log(`📊 Fetching earnings for ${ticker} from Yahoo Finance...`);

    // Yahoo Finance API endpoint
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=calendarEvents,earningsHistory`;

    console.log(`🌐 URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    console.log(`📡 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Yahoo Finance error: ${response.status} - ${errorText}`);
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`📦 Raw data structure:`, JSON.stringify(data, null, 2).substring(0, 500));

    if (!data.quoteSummary?.result?.[0]) {
      console.error("❌ No result in quoteSummary");
      throw new Error("No data returned from Yahoo Finance");
    }

    const result = data.quoteSummary.result[0];
    console.log(`✅ Got result for ${ticker}`);

    // Extract earnings data
    const calendarEvents = result.calendarEvents || {};
    const earningsHistory = result.earningsHistory?.history || [];

    console.log(`📅 Calendar events:`, JSON.stringify(calendarEvents, null, 2).substring(0, 300));
    console.log(`📊 Earnings history count: ${earningsHistory.length}`);

    // Get next earnings date
    const nextEarnings = calendarEvents.earnings;
    let earningsDate: string | undefined;

    if (nextEarnings?.earningsDate) {
      // Yahoo returns array of earnings dates
      if (Array.isArray(nextEarnings.earningsDate) && nextEarnings.earningsDate.length > 0) {
        const firstDate = nextEarnings.earningsDate[0];
        earningsDate = firstDate.fmt || firstDate.raw;
        console.log(`📆 Next earnings date: ${earningsDate}`);
      }
    }

    // Calculate beat rates from history (last 8 quarters)
    const recentHistory = earningsHistory.slice(0, 8);
    let epsBeats = 0;
    let epsCount = 0;

    recentHistory.forEach((quarter: any) => {
      const estimate = quarter.epsEstimate?.raw;
      const actual = quarter.epsActual?.raw;

      if (estimate !== undefined && actual !== undefined) {
        epsCount++;
        if (actual >= estimate) {
          epsBeats++;
        }
      }
    });

    const epsBeatRate = epsCount > 0 ? (epsBeats / epsCount) * 100 : undefined;

    console.log(`✅ Beat rate: ${epsBeatRate}% (${epsBeats}/${epsCount})`);

    const earningsData = {
      ticker,
      earnings: {
        nextEarningsDate: earningsDate,
        earningsHistory: earningsHistory,
        epsBeatRate: epsBeatRate,
      },
    };

    console.log(`✅ Returning earnings data for ${ticker}`);

    return new Response(JSON.stringify(earningsData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error(`❌ Error in fetch-earnings-data:`, error.message);
    console.error(`❌ Stack:`, error.stack);

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
