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

    // Yahoo Finance API endpoint (free, no key needed!)
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=calendarEvents,earningsHistory`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.quoteSummary?.result?.[0]) {
      throw new Error("No data returned from Yahoo Finance");
    }

    const result = data.quoteSummary.result[0];

    // Extract earnings data
    const calendarEvents = result.calendarEvents || {};
    const earningsHistory = result.earningsHistory?.history || [];

    // Get next earnings date
    const nextEarnings = calendarEvents.earnings;
    let earningsDate: string | undefined;
    let earningsTime: string | undefined;

    if (nextEarnings?.earningsDate?.[0]?.fmt) {
      earningsDate = nextEarnings.earningsDate[0].fmt;
    }

    // Calculate beat rates from history (last 8 quarters)
    const recentHistory = earningsHistory.slice(0, 8);
    let epsBeats = 0;
    let epsCount = 0;

    recentHistory.forEach((quarter: any) => {
      if (quarter.epsEstimate?.raw !== undefined && quarter.epsActual?.raw !== undefined) {
        epsCount++;
        if (quarter.epsActual.raw >= quarter.epsEstimate.raw) {
          epsBeats++;
        }
      }
    });

    const epsBeatRate = epsCount > 0 ? (epsBeats / epsCount) * 100 : undefined;

    console.log(`✅ Earnings data fetched for ${ticker}`);

    return new Response(
      JSON.stringify({
        ticker,
        earnings: {
          nextEarningsDate: earningsDate,
          earningsHistory: earningsHistory,
          epsBeatRate: epsBeatRate,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("❌ Error:", error.message);

    return new Response(
      JSON.stringify({
        error: error.message,
        ticker: null,
        earnings: null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // Return 200 even on error so enrichment doesn't fail
      },
    );
  }
});
