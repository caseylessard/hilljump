import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EODHDPriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close?: number;
  volume: number;
}

// Fetch latest price for a single ticker with fallback strategies
async function fetchLatestPrice(
  ticker: string,
  eodhd_api_key: string,
  debug = false
): Promise<EODHDPriceData | null> {
  const attempts: string[] = [];
  
  // Start with the original ticker
  attempts.push(ticker);
  
  // Handle NEO exchange stocks - try both .NE and .NEO formats
  if (ticker.endsWith('.NE')) {
    attempts.push(ticker.replace('.NE', '.NEO'));
    attempts.push(ticker.split('.')[0]); // Base ticker without exchange
  } else if (ticker.endsWith('.NEO')) {
    attempts.push(ticker.replace('.NEO', '.NE'));
    attempts.push(ticker.split('.')[0]); // Base ticker without exchange
  } else if (ticker.includes('.TO')) {
    // Toronto stocks - keep .TO format
    attempts.push(ticker);
  } else if (!ticker.includes('.')) {
    // US stocks - add .US suffix
    attempts.push(`${ticker}.US`);
  }

  for (const symbol of attempts) {
    try {
      // Get just the latest price (last 2 days to ensure we get the most recent trading day)
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const baseUrl = `https://eodhd.com/api/eod/${symbol}`;
      const params = new URLSearchParams({
        api_token: eodhd_api_key,
        fmt: 'json',
        from: startDate,
        to: endDate
      });

      if (debug) {
        console.log(`🔍 Trying symbol: ${symbol} for ticker: ${ticker}`);
      }

      const response = await fetch(`${baseUrl}?${params.toString()}`);
      
      if (!response.ok) {
        if (debug) {
          console.log(`❌ Failed for ${symbol}: ${response.status}`);
        }
        continue;
      }

      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        // Return the most recent price (last item in array)
        const latestPrice = data[data.length - 1];
        if (debug) {
          console.log(`✅ Success for ${symbol}: ${latestPrice.date} - $${latestPrice.close}`);
        }
        return latestPrice;
      } else if (debug) {
        console.log(`⚠️ Empty data for ${symbol}`);
      }
    } catch (error) {
      if (debug) {
        console.log(`💥 Error for ${symbol}: ${error.message}`);
      }
    }
  }

  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const eodhd_api_key = Deno.env.get('EODHD_API_KEY');
    if (!eodhd_api_key) {
      throw new Error('EODHD_API_KEY not configured');
    }

    console.log(`📊 Starting daily price update...`);

    // Get all active ETFs
    const { data: etfs, error: etfError } = await supabase
      .from('etfs')
      .select('ticker')
      .eq('active', true)
      .order('ticker');

    if (etfError) {
      throw new Error(`Failed to fetch ETFs: ${etfError.message}`);
    }

    const tickers = (etfs || []).map(etf => etf.ticker.toUpperCase());
    console.log(`📋 Found ${tickers.length} active ETFs to update`);

    if (tickers.length === 0) {
      return Response.json(
        { message: 'No active ETFs found', success: true },
        { headers: corsHeaders }
      );
    }

    const results = {
      total_tickers: tickers.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
      updated_tickers: [] as string[],
      failed_tickers: [] as string[]
    };

    // Process each ticker
    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      
      try {
        console.log(`[${i + 1}/${tickers.length}] 📊 Updating ${ticker}...`);

        const priceData = await fetchLatestPrice(ticker, eodhd_api_key, true);

        if (!priceData) {
          console.log(`⚠️ No price data found for ${ticker}`);
          results.failed++;
          results.failed_tickers.push(ticker);
          results.errors.push(`${ticker}: No price data available`);
          continue;
        }

        // Insert/update the latest price
        const insertData = {
          ticker: ticker.toUpperCase(),
          date: priceData.date,
          open_price: priceData.open || null,
          high_price: priceData.high || null,
          low_price: priceData.low || null,
          close_price: priceData.close,
          volume: priceData.volume || null,
          adjusted_close: priceData.adjusted_close || priceData.close
        };

        const { error: insertError } = await supabase
          .from('historical_prices')
          .upsert([insertData], { onConflict: 'ticker,date' });

        if (insertError) {
          console.error(`❌ Database error for ${ticker}:`, insertError.message);
          results.failed++;
          results.failed_tickers.push(ticker);
          results.errors.push(`${ticker}: Database error - ${insertError.message}`);
        } else {
          console.log(`✅ ${ticker}: Updated price $${priceData.close} for ${priceData.date}`);
          results.successful++;
          results.updated_tickers.push(ticker);
          
          // Also update the current_price in the etfs table
          await supabase
            .from('etfs')
            .update({ 
              current_price: priceData.close,
              price_updated_at: new Date().toISOString()
            })
            .eq('ticker', ticker);
        }

        // Brief pause between requests
        if (i < tickers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (error) {
        console.error(`💥 Error processing ${ticker}:`, error.message);
        results.failed++;
        results.failed_tickers.push(ticker);
        results.errors.push(`${ticker}: ${error.message}`);
      }
    }

    console.log(`\n📊 Daily Update Complete:`);
    console.log(`   ✅ Successful: ${results.successful}/${results.total_tickers}`);
    console.log(`   ❌ Failed: ${results.failed}/${results.total_tickers}`);

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        success_rate: `${Math.round((results.successful / results.total_tickers) * 100)}%`,
        total_updated: results.successful,
        total_failed: results.failed
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('💥 Fatal error in update-historical-prices-daily:', error);
    return Response.json(
      { 
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
      },
      { status: 500, headers: corsHeaders }
    );
  }
});