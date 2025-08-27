import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MomentumSignal {
  ticker: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  momentum_1m: number;
  momentum_3m: number;
  trend_strength: number;
  updated_at: string;
}

// Calculate momentum-based signals using price trends
function calculateMomentumSignal(
  currentPrice: number, 
  price1m: number, 
  price3m: number
): { signal: 'BUY' | 'SELL' | 'HOLD', momentum_1m: number, momentum_3m: number, trend_strength: number } {
  
  // Calculate momentum percentages
  const momentum1m = ((currentPrice - price1m) / price1m) * 100;
  const momentum3m = ((currentPrice - price3m) / price3m) * 100;
  
  // Calculate trend strength (0-100 scale)
  const trendStrength = Math.min(100, Math.abs(momentum1m) + Math.abs(momentum3m));
  
  // Signal logic:
  // BUY: Strong upward momentum in both 1m and 3m
  // SELL: Strong downward momentum in both 1m and 3m  
  // HOLD: Mixed or weak signals
  
  let signal: 'BUY' | 'SELL' | 'HOLD';
  
  if (momentum1m > 5 && momentum3m > 2 && trendStrength > 15) {
    signal = 'BUY'; // Strong upward trend
  } else if (momentum1m < -5 && momentum3m < -2 && trendStrength > 15) {
    signal = 'SELL'; // Strong downward trend
  } else if (momentum1m > 2 && momentum3m > 1) {
    signal = 'BUY'; // Moderate upward trend
  } else if (momentum1m < -3 && momentum3m < -1.5) {
    signal = 'SELL'; // Moderate downward trend
  } else {
    signal = 'HOLD'; // Sideways or unclear trend
  }
  
  return {
    signal,
    momentum_1m: Math.round(momentum1m * 10) / 10,
    momentum_3m: Math.round(momentum3m * 10) / 10,
    trend_strength: Math.round(trendStrength * 10) / 10
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tickers } = await req.json();
    console.log(`📊 Calculating momentum signals for ${tickers?.length || 0} tickers`);

    if (!tickers || !Array.isArray(tickers)) {
      throw new Error('Tickers array is required');
    }

    const signals: Record<string, MomentumSignal> = {};
    const batchSize = 5;

    // Process tickers in batches
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      console.log(`📈 Processing batch ${Math.floor(i/batchSize) + 1}: ${batch.join(', ')}`);

      // Process each ticker in the batch
      const batchPromises = batch.map(async (ticker: string) => {
        try {
          console.log(`🔍 Fetching price data for ${ticker}`);
          
          // Get current date and calculate date ranges
          const endDate = Math.floor(Date.now() / 1000);
          const startDate1m = endDate - (35 * 24 * 60 * 60); // 35 days ago (to get ~1 month of trading days)
          const startDate3m = endDate - (100 * 24 * 60 * 60); // 100 days ago (to get ~3 months of trading days)
          
          // Fetch 3 months of historical data
          const url = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${startDate3m}&period2=${endDate}&interval=1d&events=history`;
          
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (!response.ok) {
            console.error(`❌ Failed to fetch data for ${ticker}: ${response.status}`);
            return null;
          }

          const csvText = await response.text();
          const lines = csvText.trim().split('\n');
          
          if (lines.length < 22) { // Need at least ~3 weeks of data
            console.error(`❌ Not enough data for ${ticker}: ${lines.length - 1} days`);
            return null;
          }

          // Parse CSV and extract closing prices with dates
          const prices: { date: Date, price: number }[] = [];
          for (let j = 1; j < lines.length; j++) { // Skip header
            const columns = lines[j].split(',');
            const dateStr = columns[0];
            const closePrice = parseFloat(columns[4]);
            
            if (!isNaN(closePrice) && dateStr) {
              prices.push({
                date: new Date(dateStr),
                price: closePrice
              });
            }
          }

          if (prices.length < 22) {
            console.error(`❌ Not enough valid prices for ${ticker}: ${prices.length}`);
            return null;
          }

          // Sort by date (oldest first)
          prices.sort((a, b) => a.date.getTime() - b.date.getTime());

          // Get current price (most recent)
          const currentPrice = prices[prices.length - 1].price;
          
          // Get price from ~1 month ago (look for closest to 22 trading days back)
          const price1mIndex = Math.max(0, prices.length - 23);
          const price1m = prices[price1mIndex].price;
          
          // Get price from ~3 months ago (look for closest to 65 trading days back)
          const price3mIndex = Math.max(0, prices.length - 66);
          const price3m = prices[price3mIndex].price;

          // Calculate momentum signal
          const result = calculateMomentumSignal(currentPrice, price1m, price3m);

          console.log(`✅ ${ticker}: ${result.signal} (1M: ${result.momentum_1m}%, 3M: ${result.momentum_3m}%, Strength: ${result.trend_strength})`);

          return {
            ticker,
            signal: result.signal,
            momentum_1m: result.momentum_1m,
            momentum_3m: result.momentum_3m,
            trend_strength: result.trend_strength,
            updated_at: new Date().toISOString()
          };

        } catch (error) {
          console.error(`❌ Error processing ${ticker}:`, error);
          return null;
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Add successful results to signals object
      batchResults.forEach(result => {
        if (result) {
          signals[result.ticker] = result;
        }
      });

      // Add delay between batches
      if (i + batchSize < tickers.length) {
        console.log('⏸️ Pausing between batches...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`🎯 Successfully calculated momentum signals for ${Object.keys(signals).length}/${tickers.length} tickers`);

    return new Response(JSON.stringify({ signals }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in momentum-signals function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        signals: {} 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});