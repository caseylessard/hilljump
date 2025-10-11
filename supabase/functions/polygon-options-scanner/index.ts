import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptionCandidate {
  ticker: string;
  currentPrice: number;
  strike: number;
  premium: number;
  expiry: string;
  earningsDate: string;
  impliedVol: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tickers } = await req.json();
    
    if (!tickers || !Array.isArray(tickers)) {
      throw new Error('Invalid request: tickers array required');
    }

    const polygonApiKey = Deno.env.get('POLYGON_API_KEY');
    if (!polygonApiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    console.log('Fetching options data for:', tickers);

    const signals: OptionCandidate[] = [];

    // Process tickers in batches to avoid rate limits
    for (const ticker of tickers) {
      try {
        // Get current stock price
        const priceUrl = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${polygonApiKey}`;
        const priceRes = await fetch(priceUrl);
        
        if (!priceRes.ok) {
          console.error(`Failed to fetch price for ${ticker}: ${priceRes.status}`);
          continue;
        }

        const priceData = await priceRes.json();
        const currentPrice = priceData.results?.[0]?.c;

        if (!currentPrice) {
          console.error(`No price data for ${ticker}`);
          continue;
        }

        // Get upcoming earnings date (mock for now - Polygon doesn't provide this easily)
        const earningsDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Calculate strike prices around current price
        const strikes = [
          currentPrice * 1.05, // 5% OTM
          currentPrice * 1.10, // 10% OTM
          currentPrice * 1.15, // 15% OTM
        ];

        // For each strike, create a candidate
        for (const strike of strikes) {
          // Calculate expiry (45-60 days out)
          const expiryDate = new Date(Date.now() + 50 * 24 * 60 * 60 * 1000);
          const expiry = expiryDate.toISOString().split('T')[0];

          // Estimate premium (simplified - in production would fetch actual option chain)
          const timeValue = (strike - currentPrice) * 0.15; // rough approximation
          const intrinsicValue = Math.max(0, currentPrice - strike);
          const premium = Math.max(0.01, intrinsicValue + timeValue);

          // Estimate IV (simplified)
          const impliedVol = 0.30 + Math.random() * 0.20; // 30-50% IV range

          signals.push({
            ticker,
            currentPrice,
            strike: Math.round(strike * 100) / 100,
            premium: Math.round(premium * 100) / 100,
            expiry,
            earningsDate,
            impliedVol: Math.round(impliedVol * 100) / 100,
          });
        }

        // Add small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (tickerError) {
        console.error(`Error processing ${ticker}:`, tickerError);
      }
    }

    console.log(`Generated ${signals.length} option signals`);

    return new Response(
      JSON.stringify({
        success: true,
        signals,
        count: signals.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in polygon-options-scanner:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
