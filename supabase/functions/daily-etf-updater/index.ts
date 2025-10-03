import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ETFUpdateData {
  ticker: string;
  avg_volume?: number;
  aum?: number;
  yield_ttm?: number;
  total_return_1y?: number;
}

// Fetch data from Polygon for US ETFs
async function fetchPolygonData(ticker: string): Promise<Partial<ETFUpdateData>> {
  const apiKey = Deno.env.get('POLYGON_API_KEY');
  if (!apiKey) return {};

  try {
    // Get basic quote data
    const quoteResponse = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?apikey=${apiKey}`
    );
    
    if (!quoteResponse.ok) return {};
    const quoteData = await quoteResponse.json();

    // Get ticker details for AUM and other fundamental data
    const detailsResponse = await fetch(
      `https://api.polygon.io/v3/reference/tickers/${ticker}?apikey=${apiKey}`
    );
    
    let aum, marketCap;
    if (detailsResponse.ok) {
      const detailsData = await detailsResponse.json();
      marketCap = detailsData.results?.market_cap;
      // For ETFs, market cap approximates AUM
      aum = marketCap;
    }

    // Get aggregated volume data
    const volumeResponse = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}/${new Date().toISOString().split('T')[0]}?apikey=${apiKey}`
    );
    
    let avgVolume;
    if (volumeResponse.ok) {
      const volumeData = await volumeResponse.json();
      if (volumeData.results?.length > 0) {
        const totalVolume = volumeData.results.reduce((sum: number, day: any) => sum + (day.v || 0), 0);
        avgVolume = Math.round(totalVolume / volumeData.results.length);
      }
    }

    return {
      ticker,
      avg_volume: avgVolume,
      aum: aum,
    };
  } catch (error) {
    console.error(`Error fetching Polygon data for ${ticker}:`, error);
    return {};
  }
}

// Fetch data from TwelveData API
async function fetchTwelveData(ticker: string): Promise<Partial<ETFUpdateData>> {
  const apiKey = Deno.env.get('TWELVEDATA_API_KEY');
  if (!apiKey) return {};

  try {
    // Get statistics including yield and performance
    const statsResponse = await fetch(
      `https://api.twelvedata.com/statistics?symbol=${ticker}&apikey=${apiKey}`
    );
    
    if (!statsResponse.ok) return {};
    const statsData = await statsResponse.json();

    // Get time series for performance calculation
    const timeSeriesResponse = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${ticker}&interval=1day&outputsize=252&apikey=${apiKey}`
    );
    
    let totalReturn1Y;
    if (timeSeriesResponse.ok) {
      const timeSeriesData = await timeSeriesResponse.json();
      if (timeSeriesData.values?.length >= 2) {
        const currentPrice = parseFloat(timeSeriesData.values[0].close);
        const yearAgoPrice = parseFloat(timeSeriesData.values[timeSeriesData.values.length - 1].close);
        if (currentPrice && yearAgoPrice) {
          totalReturn1Y = ((currentPrice - yearAgoPrice) / yearAgoPrice) * 100;
        }
      }
    }

    return {
      ticker,
      yield_ttm: statsData.statistics?.dividend_yield,
      total_return_1y: totalReturn1Y,
    };
  } catch (error) {
    console.error(`Error fetching TwelveData for ${ticker}:`, error);
    return {};
  }
}

// Fetch data from EODHD for Canadian ETFs
async function fetchEODHDData(ticker: string): Promise<Partial<ETFUpdateData>> {
  const apiKey = Deno.env.get('EODHD_API_KEY');
  if (!apiKey) return {};

  try {
    // Format ticker for EODHD (handle NEO Exchange)
    let eodhSymbol = ticker;
    if (ticker.endsWith('.NE')) {
      eodhSymbol = ticker.replace('.NE', '.NEO'); // NEO Exchange uses .NEO format
    } else if (ticker.endsWith('.VN')) {
      eodhSymbol = ticker.replace('.VN', '.V'); // TSX Venture uses .V format
    }
    
    // Get fundamentals data
    const fundamentalsResponse = await fetch(
      `https://eodhd.com/api/fundamentals/${eodhSymbol}?api_token=${apiKey}`
    );
    
    if (!fundamentalsResponse.ok) return {};
    const fundamentalsData = await fundamentalsResponse.json();

    // Get historical data for volume and performance
    const historicalResponse = await fetch(
      `https://eodhd.com/api/eod/${eodhSymbol}?api_token=${apiKey}&period=d&from=${new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`
    );
    
    let avgVolume, totalReturn1Y;
    if (historicalResponse.ok) {
      const historicalData = await historicalResponse.json();
      if (Array.isArray(historicalData) && historicalData.length >= 2) {
        // Calculate average volume over last 30 days
        const recent30Days = historicalData.slice(-30);
        const totalVolume = recent30Days.reduce((sum, day) => sum + (day.volume || 0), 0);
        avgVolume = Math.round(totalVolume / recent30Days.length);

        // Calculate 1-year return
        const currentPrice = historicalData[historicalData.length - 1].close;
        const yearAgoPrice = historicalData[0].close;
        if (currentPrice && yearAgoPrice) {
          totalReturn1Y = ((currentPrice - yearAgoPrice) / yearAgoPrice) * 100;
        }
      }
    }

    return {
      ticker,
      avg_volume: avgVolume,
      aum: fundamentalsData.General?.MarketCapitalization,
      yield_ttm: fundamentalsData.Highlights?.DividendYield,
      total_return_1y: totalReturn1Y,
    };
  } catch (error) {
    console.error(`Error fetching EODHD data for ${ticker}:`, error);
    return {};
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting daily ETF data update...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all ETFs that need updating
    const { data: etfs, error: fetchError } = await supabase
      .from('etfs')
      .select('ticker, country, data_source')
      .or('avg_volume.eq.1000000,aum.eq.100000000,yield_ttm.is.null,total_return_1y.is.null');

    if (fetchError) {
      throw new Error(`Failed to fetch ETFs: ${fetchError.message}`);
    }

    console.log(`Found ${etfs?.length || 0} ETFs to update`);

    const updates: ETFUpdateData[] = [];
    const batchSize = 10;

    // Process ETFs in batches to avoid rate limits
    for (let i = 0; i < (etfs?.length || 0); i += batchSize) {
      const batch = etfs!.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (etf) => {
        let updateData: Partial<ETFUpdateData> = { ticker: etf.ticker };

        // Choose data source based on country and availability
        if (etf.country === 'US') {
          // Try Polygon first for US ETFs
          const polygonData = await fetchPolygonData(etf.ticker);
          updateData = { ...updateData, ...polygonData };

          // Supplement with TwelveData for yield and performance
          const twelveData = await fetchTwelveData(etf.ticker);
          updateData = { ...updateData, ...twelveData };
        } else if (etf.country === 'CA') {
          // Use EODHD for Canadian ETFs
          const eodhData = await fetchEODHDData(etf.ticker);
          updateData = { ...updateData, ...eodhData };
        }

        // Only include if we have some real data
        if (Object.keys(updateData).length > 1) {
          return updateData as ETFUpdateData;
        }
        return null;
      });

      const batchResults = await Promise.allSettled(batchPromises);
      const validUpdates = batchResults
        .filter((result): result is PromiseFulfilledResult<ETFUpdateData> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);

      updates.push(...validUpdates);

      // Add delay between batches to respect rate limits
      if (i + batchSize < (etfs?.length || 0)) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`Collected data for ${updates.length} ETFs`);

    // Update database with new data
    let updateCount = 0;
    for (const update of updates) {
      // Only update fields that have valid data
      const updateFields: any = {};
      
      if (update.avg_volume && update.avg_volume > 0) {
        updateFields.avg_volume = update.avg_volume;
      }
      if (update.aum && update.aum > 0) {
        updateFields.aum = update.aum;
      }
      if (update.yield_ttm !== undefined && update.yield_ttm !== null) {
        updateFields.yield_ttm = update.yield_ttm;
      }
      if (update.total_return_1y !== undefined && update.total_return_1y !== null) {
        updateFields.total_return_1y = update.total_return_1y;
      }

      if (Object.keys(updateFields).length > 0) {
        updateFields.updated_at = new Date().toISOString();
        
        const { error: updateError } = await supabase
          .from('etfs')
          .update(updateFields)
          .eq('ticker', update.ticker);

        if (updateError) {
          console.error(`Failed to update ${update.ticker}:`, updateError);
        } else {
          updateCount++;
          console.log(`Updated ${update.ticker} with:`, Object.keys(updateFields));
        }
      }
    }

    const result = {
      success: true,
      message: `Daily ETF update completed successfully`,
      stats: {
        totalETFs: etfs?.length || 0,
        dataCollected: updates.length,
        databaseUpdates: updateCount,
        timestamp: new Date().toISOString()
      }
    };

    console.log('Daily update result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Daily ETF update failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});