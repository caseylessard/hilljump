import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { ticker } = await req.json();
    
    if (!ticker) {
      throw new Error('Ticker is required');
    }

    const apiKey = Deno.env.get('FMP_API_KEY');
    
    if (!apiKey) {
      throw new Error('FMP_API_KEY not configured');
    }

    console.log(`📊 Fetching earnings for ${ticker} from FMP (new stable API)...`);
    
    // Calculate date range (past 30 days + next 60 days = 90 days total)
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(fromDate.getDate() - 30); // 30 days ago
    
    const toDate = new Date(today);
    toDate.setDate(toDate.getDate() + 60); // 60 days forward
    
    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];
    
    console.log(`📅 Date range: ${fromStr} to ${toStr}`);
    
    // NEW stable endpoint
    const url = `https://financialmodelingprep.com/stable/earnings-calendar?from=${fromStr}&to=${toStr}&apikey=${apiKey}`;
    
    const response = await fetch(url);
    
    console.log(`📡 Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ FMP error: ${errorText}`);
      throw new Error(`FMP API error: ${response.status}`);
    }
    
    const allEarnings = await response.json();
    
    console.log(`📦 Total earnings records: ${allEarnings.length}`);
    
    // Filter for this specific ticker
    const tickerEarnings = allEarnings.filter((e: any) => 
      e.symbol === ticker || e.symbol === `${ticker}.US`
    );
    
    console.log(`🎯 ${ticker} earnings records: ${tickerEarnings.length}`);
    
    if (tickerEarnings.length === 0) {
      console.warn(`⚠️ No earnings data found for ${ticker}`);
      return new Response(
        JSON.stringify({ 
          ticker,
          earnings: null
        }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    
    // Find next earnings date (future dates only)
    const now = new Date();
    const futureEarnings = tickerEarnings
      .filter((e: any) => new Date(e.date) > now)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let earningsDate: string | undefined;
    if (futureEarnings.length > 0) {
      earningsDate = futureEarnings[0].date;
      console.log(`📆 Next earnings: ${earningsDate}`);
    }
    
    // Calculate beat rate from last 8 quarters
    const pastEarnings = tickerEarnings
      .filter((e: any) => new Date(e.date) <= now)
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
    
    console.log(`✅ Beat rate: ${epsBeatRate}% (${epsBeats}/${epsCount})`);
    
    return new Response(
      JSON.stringify({ 
        ticker,
        earnings: {
          nextEarningsDate: earningsDate,
          earningsHistory: pastEarnings,
          epsBeatRate: epsBeatRate,
        }
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error(`❌ Error:`, error.message);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        ticker: null,
        earnings: null
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
```

---

## Test It:

1. **Make sure** `FMP_API_KEY` is set in Supabase secrets
2. **Wait 30 seconds** for function to redeploy
3. **Run a 🧪 Test scan**
4. **Check console** for:
```
   📊 Fetching earnings for AMD from FMP (new stable API)...
   ✅ Beat rate: 75% (6/8)