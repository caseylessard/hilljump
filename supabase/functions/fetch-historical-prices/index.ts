import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close: number;
  volume: number;
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

    // Get request parameters
    const { ticker, from_date, to_date } = await req.json().catch(() => ({}));
    
    if (!ticker) {
      return Response.json(
        { error: 'Ticker is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`📊 Fetching historical data for ${ticker} from ${from_date || 'default'} to ${to_date || 'today'}`);

    // Build EODHD API URL
    const baseUrl = `https://eodhd.com/api/eod/${ticker}`;
    const params = new URLSearchParams({
      api_token: eodhd_api_key,
      fmt: 'json',
    });
    
    if (from_date) params.append('from', from_date);
    if (to_date) params.append('to', to_date);

    const apiUrl = `${baseUrl}?${params.toString()}`;
    
    console.log(`🔍 Calling EODHD API: ${baseUrl}?api_token=***&fmt=json${from_date ? `&from=${from_date}` : ''}${to_date ? `&to=${to_date}` : ''}`);

    // Fetch data from EODHD
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status} ${response.statusText}`);
    }

    const priceData: PriceData[] = await response.json();
    
    if (!Array.isArray(priceData) || priceData.length === 0) {
      console.log(`⚠️ No price data returned for ${ticker}`);
      return Response.json(
        { message: `No price data found for ${ticker}`, count: 0 },
        { headers: corsHeaders }
      );
    }

    console.log(`📈 Received ${priceData.length} price records for ${ticker}`);

    // Transform and insert data
    const insertData = priceData.map(price => ({
      ticker: ticker.toUpperCase(),
      date: price.date,
      open_price: price.open,
      high_price: price.high,
      low_price: price.low,
      close_price: price.close,
      volume: price.volume,
      adjusted_close: price.adjusted_close || price.close
    }));

    // Insert into database using upsert to handle duplicates
    const { data, error } = await supabase
      .from('historical_prices')
      .upsert(insertData, { onConflict: 'ticker,date' });

    if (error) {
      console.error('❌ Database insert error:', error);
      throw error;
    }

    console.log(`✅ Successfully inserted/updated ${insertData.length} price records for ${ticker}`);

    return Response.json({
      success: true,
      ticker,
      records_processed: insertData.length,
      date_range: {
        from: priceData[0]?.date,
        to: priceData[priceData.length - 1]?.date
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('💥 Error in fetch-historical-prices:', error);
    return Response.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
});