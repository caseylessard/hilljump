import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RSISignal {
  ticker: string;
  rsi: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  updated_at: string;
}

// Calculate RSI using standard 14-period formula
function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50; // Return neutral if not enough data
  
  const gains: number[] = [];
  const losses: number[] = [];
  
  // Calculate daily price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  // Calculate initial average gain and loss
  let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
  
  // Calculate smoothed averages for remaining periods
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  
  // Calculate RSI
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return Math.round(rsi * 10) / 10; // Round to 1 decimal place
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tickers } = await req.json();
    const apiKey = Deno.env.get('EODHD_API_KEY');
    
    if (!apiKey) {
      throw new Error('EODHD API key not found');
    }

    console.log(`📊 Calculating RSI for ${tickers?.length || 0} tickers via EODHD`);

    if (!tickers || !Array.isArray(tickers)) {
      throw new Error('Tickers array is required');
    }

    const signals: Record<string, RSISignal> = {};
    const batchSize = 10; // EODHD allows higher rate limits

    // Process tickers in batches
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      console.log(`📈 Processing batch ${Math.floor(i/batchSize) + 1}: ${batch.join(', ')}`);

      // Process each ticker in the batch
      const batchPromises = batch.map(async (ticker: string) => {
        try {
          console.log(`🔍 Fetching historical data for ${ticker}`);
          
          // Format ticker for EODHD (handle Canadian tickers)
          const eodhTicker = ticker.includes('.TO') 
            ? ticker.replace('.TO', '.TSE') 
            : ticker.includes('.') 
              ? ticker 
              : `${ticker}.US`;
          
          // Get 30 days of historical data
          const endDate = new Date().toISOString().split('T')[0];
          const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          
          const url = `https://eodhd.com/api/eod/${eodhTicker}?api_token=${apiKey}&from=${startDate}&to=${endDate}&fmt=json`;
          
          const response = await fetch(url);
          
          if (!response.ok) {
            console.error(`❌ Failed to fetch data for ${ticker}: ${response.status}`);
            return null;
          }

          const data = await response.json();
          
          if (!Array.isArray(data) || data.length < 15) {
            console.error(`❌ Not enough data for ${ticker}: ${data?.length || 0} days`);
            return null;
          }

          // Extract closing prices
          const prices = data.map(d => parseFloat(d.close)).filter(price => !isNaN(price));

          if (prices.length < 15) {
            console.error(`❌ Not enough valid prices for ${ticker}: ${prices.length}`);
            return null;
          }

          // Calculate RSI
          const rsiValue = calculateRSI(prices);
          
          // Determine signal based on RSI
          let signal: 'BUY' | 'SELL' | 'HOLD';
          if (rsiValue < 30) {
            signal = 'BUY';  // Oversold
          } else if (rsiValue > 70) {
            signal = 'SELL'; // Overbought
          } else {
            signal = 'HOLD'; // Neutral
          }

          console.log(`✅ ${ticker}: RSI=${rsiValue}, Signal=${signal} (${prices.length} days of data)`);

          return {
            ticker,
            rsi: rsiValue,
            signal,
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
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`🎯 Successfully calculated RSI for ${Object.keys(signals).length}/${tickers.length} tickers`);

    return new Response(JSON.stringify({ signals }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in EODHD RSI function:', error);
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