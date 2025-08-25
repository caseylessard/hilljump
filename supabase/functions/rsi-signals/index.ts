import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const TWELVE_DATA_API_KEY = Deno.env.get('TWELVEDATA_API_KEY');

interface RSISignal {
  ticker: string;
  rsi: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  updated_at: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tickers } = await req.json();
    console.log(`Fetching RSI signals for ${tickers?.length || 0} tickers`);

    if (!tickers || !Array.isArray(tickers)) {
      throw new Error('Tickers array is required');
    }

    if (!TWELVE_DATA_API_KEY) {
      throw new Error('TWELVEDATA_API_KEY not configured');
    }

    const signals: Record<string, RSISignal> = {};
    const batchSize = 10; // Process in small batches to respect rate limits

    // Process tickers in batches
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}: ${batch.join(', ')}`);

      // Process each ticker in the batch
      const batchPromises = batch.map(async (ticker: string) => {
        try {
          // Clean ticker for API call (remove .TO suffix for Canadian tickers)
          const cleanTicker = ticker.replace('.TO', '');
          
          // Fetch RSI data from Twelve Data
          const rsiUrl = `https://api.twelvedata.com/rsi?symbol=${cleanTicker}&interval=1day&apikey=${TWELVE_DATA_API_KEY}&outputsize=1`;
          
          console.log(`Fetching RSI for ${ticker} (${cleanTicker})`);
          const response = await fetch(rsiUrl);
          
          if (!response.ok) {
            console.error(`Failed to fetch RSI for ${ticker}: ${response.status}`);
            return null;
          }

          const data = await response.json();
          
          if (data.status === 'error' || !data.values || data.values.length === 0) {
            console.error(`No RSI data for ${ticker}:`, data.message || 'No values returned');
            return null;
          }

          const rsiValue = parseFloat(data.values[0].rsi);
          
          if (isNaN(rsiValue)) {
            console.error(`Invalid RSI value for ${ticker}:`, data.values[0].rsi);
            return null;
          }

          // Determine signal based on RSI
          let signal: 'BUY' | 'SELL' | 'HOLD';
          if (rsiValue < 30) {
            signal = 'BUY';  // Oversold
          } else if (rsiValue > 70) {
            signal = 'SELL'; // Overbought
          } else {
            signal = 'HOLD'; // Neutral
          }

          console.log(`${ticker}: RSI=${rsiValue.toFixed(1)}, Signal=${signal}`);

          return {
            ticker,
            rsi: rsiValue,
            signal,
            updated_at: new Date().toISOString()
          };

        } catch (error) {
          console.error(`Error fetching RSI for ${ticker}:`, error);
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

      // Add delay between batches to respect rate limits (60 calls/minute = 1 per second)
      if (i + batchSize < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    console.log(`Successfully fetched RSI signals for ${Object.keys(signals).length} tickers`);

    return new Response(JSON.stringify({ signals }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in rsi-signals function:', error);
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