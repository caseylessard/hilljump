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

interface FetchParams {
  tickers?: string[];
  use_active_etfs?: boolean;
  start_date?: string;
  end_date?: string;
  sleep_ms?: number;
  batch_size?: number;
  backfill_days?: number;
}

// Helper to calculate date range with defaults
function getDateRange(startDate?: string, endDate?: string, defaultDays = 365) {
  const today = new Date().toISOString().split('T')[0];
  const end = endDate || today;
  
  if (!startDate) {
    const startDateTime = new Date(end);
    startDateTime.setDate(startDateTime.getDate() - defaultDays);
    return {
      start: startDateTime.toISOString().split('T')[0],
      end
    };
  }
  
  return { start: startDate, end };
}

// Robust ticker fetching with fallback strategies
async function fetchTickerData(
  ticker: string, 
  startDate: string, 
  endDate: string, 
  eodhd_api_key: string,
  debug = false
): Promise<EODHDPriceData[]> {
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
        if (debug) {
          console.log(`✅ Success for ${symbol}: ${data.length} records`);
        }
        return data;
      } else if (debug) {
        console.log(`⚠️ Empty data for ${symbol}`);
      }
    } catch (error) {
      if (debug) {
        console.log(`💥 Error for ${symbol}: ${error.message}`);
      }
    }
  }

  return [];
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

    // Parse request parameters with defaults
    const params: FetchParams = await req.json().catch(() => ({}));
    const {
      tickers: requestTickers,
      use_active_etfs = true,
      start_date,
      end_date,
      sleep_ms = 500,
      batch_size = 100,
      backfill_days = 365
    } = params;

    console.log(`📊 Starting historical price fetch with params:`, {
      use_active_etfs,
      requestTickers: requestTickers?.length || 0,
      start_date: start_date || `auto (${backfill_days} days)`,
      end_date: end_date || 'today',
      sleep_ms,
      batch_size
    });

    // Determine which tickers to fetch
    let tickersToFetch: string[] = [];
    
    if (requestTickers && requestTickers.length > 0) {
      tickersToFetch = requestTickers.map(t => t.trim().toUpperCase());
      console.log(`📋 Using provided tickers: ${tickersToFetch.join(', ')}`);
    } else if (use_active_etfs) {
      // Fetch active ETFs from database
      const { data: etfs, error: etfError } = await supabase
        .from('etfs')
        .select('ticker')
        .eq('active', true)
        .order('ticker');

      if (etfError) {
        throw new Error(`Failed to fetch ETFs: ${etfError.message}`);
      }

      tickersToFetch = (etfs || []).map(etf => etf.ticker.toUpperCase());
      console.log(`📋 Fetched ${tickersToFetch.length} active ETFs from database`);
    }

    if (tickersToFetch.length === 0) {
      return Response.json(
        { error: 'No tickers specified. Provide tickers array or set use_active_etfs=true' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Calculate date range
    const dateRange = getDateRange(start_date, end_date, backfill_days);
    console.log(`📅 Date range: ${dateRange.start} to ${dateRange.end}`);

    // Process tickers in batches to avoid overwhelming the API
    const results = {
      total_tickers: tickersToFetch.length,
      successful: 0,
      failed: 0,
      total_records: 0,
      errors: [] as string[],
      processed_tickers: [] as string[],
      failed_tickers: [] as string[]
    };

    for (let i = 0; i < tickersToFetch.length; i += batch_size) {
      const batch = tickersToFetch.slice(i, i + batch_size);
      console.log(`\n🔄 Processing batch ${Math.floor(i/batch_size) + 1}/${Math.ceil(tickersToFetch.length/batch_size)}: ${batch.join(', ')}`);

      for (const ticker of batch) {
        try {
          console.log(`[${results.successful + results.failed + 1}/${results.total_tickers}] 📊 Fetching ${ticker}...`);

          // Fetch price data with fallback strategies
          const priceData = await fetchTickerData(
            ticker,
            dateRange.start,
            dateRange.end,
            eodhd_api_key,
            true // debug mode
          );

          if (priceData.length === 0) {
            console.log(`⚠️ No price data found for ${ticker}`);
            results.failed++;
            results.failed_tickers.push(ticker);
            results.errors.push(`${ticker}: No price data available`);
            continue;
          }

          // Transform data for database
          const insertData = priceData.map(price => ({
            ticker: ticker.toUpperCase(),
            date: price.date,
            open_price: price.open || null,
            high_price: price.high || null,
            low_price: price.low || null,
            close_price: price.close,
            volume: price.volume || null,
            adjusted_close: price.adjusted_close || price.close
          }));

          // Insert into database using upsert to handle duplicates
          const { error: insertError } = await supabase
            .from('historical_prices')
            .upsert(insertData, { onConflict: 'ticker,date' });

          if (insertError) {
            console.error(`❌ Database error for ${ticker}:`, insertError.message);
            results.failed++;
            results.failed_tickers.push(ticker);
            results.errors.push(`${ticker}: Database error - ${insertError.message}`);
          } else {
            console.log(`✅ ${ticker}: Successfully processed ${insertData.length} records`);
            results.successful++;
            results.total_records += insertData.length;
            results.processed_tickers.push(ticker);
          }

          // Sleep between requests to be respectful to API
          if (sleep_ms > 0 && ticker !== batch[batch.length - 1]) {
            await new Promise(resolve => setTimeout(resolve, sleep_ms));
          }

        } catch (error) {
          console.error(`💥 Error processing ${ticker}:`, error.message);
          results.failed++;
          results.failed_tickers.push(ticker);
          results.errors.push(`${ticker}: ${error.message}`);
        }
      }

      // Brief pause between batches
      if (i + batch_size < tickersToFetch.length && sleep_ms > 0) {
        console.log(`⏸️ Batch complete, pausing ${sleep_ms}ms...`);
        await new Promise(resolve => setTimeout(resolve, sleep_ms));
      }
    }

    console.log(`\n📊 Final Results:`);
    console.log(`   ✅ Successful: ${results.successful}/${results.total_tickers}`);
    console.log(`   ❌ Failed: ${results.failed}/${results.total_tickers}`);
    console.log(`   📈 Total records: ${results.total_records}`);

    return Response.json({
      success: true,
      date_range: dateRange,
      results,
      summary: {
        success_rate: `${Math.round((results.successful / results.total_tickers) * 100)}%`,
        total_records_inserted: results.total_records,
        processing_time: `Processed ${results.total_tickers} tickers`
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('💥 Fatal error in fetch-historical-prices:', error);
    return Response.json(
      { 
        error: error.message,
        success: false
      },
      { status: 500, headers: corsHeaders }
    );
  }
});