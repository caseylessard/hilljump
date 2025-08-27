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
    console.log(`📊 Calculating RSI for ${tickers?.length || 0} tickers via Yahoo Finance`);

    if (!tickers || !Array.isArray(tickers)) {
      throw new Error('Tickers array is required');
    }

    const signals: Record<string, RSISignal> = {};
    const batchSize = 5; // Small batches to be respectful

    // Process tickers in batches
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      console.log(`📈 Processing batch ${Math.floor(i/batchSize) + 1}: ${batch.join(', ')}`);

      // Process each ticker in the batch
      const batchPromises = batch.map(async (ticker: string) => {
        try {
          console.log(`🔍 Fetching historical data for ${ticker}`);
          
          // Get 30 days of historical data (enough for 14-period RSI)
          const endDate = Math.floor(Date.now() / 1000);
          const startDate = endDate - (30 * 24 * 60 * 60); // 30 days ago
          
          const url = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d&events=history`;
          
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'text/csv',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1'
            }
          });
          
          if (!response.ok) {
            console.error(`❌ Failed to fetch data for ${ticker}: ${response.status}`);
            return null;
          }

          const csvText = await response.text();
          const lines = csvText.trim().split('\n');
          
          if (lines.length < 16) { // Need at least 15 days for 14-period RSI
            console.error(`❌ Not enough data for ${ticker}: ${lines.length - 1} days`);
            return null;
          }

          // Parse CSV and extract closing prices
          const prices: number[] = [];
          for (let j = 1; j < lines.length; j++) { // Skip header
            const columns = lines[j].split(',');
            const closePrice = parseFloat(columns[4]); // Close price is column 4
            
            if (!isNaN(closePrice)) {
              prices.push(closePrice);
            }
          }

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

      // Add delay between batches to be respectful
      if (i + batchSize < tickers.length) {
        console.log('⏸️ Pausing between batches...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`🎯 Successfully calculated RSI for ${Object.keys(signals).length}/${tickers.length} tickers`);

    return new Response(JSON.stringify({ signals }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in yfinance-rsi function:', error);
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