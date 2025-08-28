import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ETFUpdateData {
  ticker: string;
  current_price?: number;
  yield_ttm?: number;
  avg_volume?: number;
  total_return_1y?: number;
  aum?: number;
  data_source: string;
  timestamp: string;
}

// EODHD - Primary data source for REAL-TIME PRICES ONLY (fundamentals not included in basic plan)
async function fetchEODHDData(ticker: string, apiKey: string): Promise<Partial<ETFUpdateData>> {
  try {
    console.log(`🎯 [EODHD] Fetching real-time price for ${ticker}`);
    
    // Format symbol for EODHD
    let eodhSymbol = ticker;
    if (ticker.endsWith('.TO')) {
      eodhSymbol = ticker; // EODHD uses .TO format directly
    } else if (ticker.endsWith('.NE')) {
      eodhSymbol = ticker.replace('.NE', '.TO'); // NEO Exchange - try .TO format
    } else if (ticker.endsWith('.VN')) {
      eodhSymbol = ticker.replace('.VN', '.V'); // TSX Venture - try .V format
    } else if (!ticker.includes('.')) {
      eodhSymbol = `${ticker}.US`; // US tickers - add .US suffix
    }
    
    // Get real-time price ONLY (fundamentals not included in basic plan)
    const priceUrl = `https://eodhd.com/api/real-time/${eodhSymbol}?api_token=${apiKey}&fmt=json`;
    const priceResponse = await fetch(priceUrl);
    
    if (!priceResponse.ok) {
      console.warn(`❌ [EODHD] Price fetch failed for ${eodhSymbol}: ${priceResponse.status}, falling back to Yahoo`);
      return {};
    }
    
    const priceData = await priceResponse.json();
    const currentPrice = priceData.close || priceData.price || priceData.regularMarketPrice;
    
    if (!currentPrice || currentPrice <= 0) {
      console.warn(`❌ [EODHD] Invalid price for ${eodhSymbol}: ${currentPrice}, falling back to Yahoo`);
      return {};
    }

    // Get volume from real-time data if available
    const volume = priceData.volume;
    
    console.log(`✅ [EODHD] Success for ${ticker}: $${currentPrice}${volume ? `, vol: ${volume}` : ''}`);
    
    return {
      ticker,
      current_price: currentPrice,
      avg_volume: volume,
      data_source: 'eodhd_realtime',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ [EODHD] Error for ${ticker}:`, error);
    return {};
  }
}

// Enhanced Yahoo Finance - Now handles fundamentals and historical data (since EODHD basic plan doesn't include these)
async function fetchYahooFinanceData(ticker: string): Promise<Partial<ETFUpdateData>> {
  try {
    console.log(`📊 [YAHOO] Comprehensive fetch for ${ticker} (fundamentals + price + historical)`);
    
    // Get quote and fundamentals
    const quoteUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail,price,defaultKeyStatistics,fundProfile`;
    const quoteResponse = await fetch(quoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0'
      }
    });
    
    if (!quoteResponse.ok) {
      console.warn(`❌ [YAHOO] Quote failed for ${ticker}: ${quoteResponse.status}`);
      return {};
    }
    
    const quoteData = await quoteResponse.json();
    const result = quoteData?.quoteSummary?.result?.[0];
    
    if (!result) {
      console.warn(`❌ [YAHOO] No quote data for ${ticker}`);
      return {};
    }
    
    const summaryDetail = result.summaryDetail;
    const price = result.price;
    const keyStatistics = result.defaultKeyStatistics;
    const fundProfile = result.fundProfile;
    
    // Get historical data for 1-year return
    const endTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000);
    
    const histUrl = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d&events=history`;
    
    let totalReturn1Y;
    try {
      const histResponse = await fetch(histUrl);
      if (histResponse.ok) {
        const histText = await histResponse.text();
        const lines = histText.trim().split('\n');
        
        if (lines.length > 2) { // Header + at least 2 data lines
          const firstDataLine = lines[1].split(',');
          const lastDataLine = lines[lines.length - 1].split(',');
          
          const oldPrice = parseFloat(firstDataLine[4]); // Close price
          const newPrice = parseFloat(lastDataLine[4]); // Close price
          
          if (oldPrice > 0 && newPrice > 0) {
            totalReturn1Y = ((newPrice - oldPrice) / oldPrice) * 100;
          }
        }
      }
    } catch (histError) {
      console.warn(`⚠️ [YAHOO] Historical data failed for ${ticker}:`, histError);
    }
    
    const currentPrice = price?.regularMarketPrice?.raw;
    const yieldTtm = summaryDetail?.dividendYield?.raw ? summaryDetail.dividendYield.raw * 100 : undefined;
    const avgVolume = summaryDetail?.averageVolume?.raw;
    const aum = keyStatistics?.totalAssets?.raw || fundProfile?.totalNetAssets?.raw;
    
    console.log(`✅ [YAHOO] Success for ${ticker}: $${currentPrice}, yield: ${yieldTtm?.toFixed(2)}%, return: ${totalReturn1Y?.toFixed(2)}%, AUM: ${aum ? `$${(aum/1e9).toFixed(1)}B` : 'N/A'}`);
    
    return {
      ticker,
      current_price: currentPrice,
      yield_ttm: yieldTtm,
      avg_volume: avgVolume,
      total_return_1y: totalReturn1Y,
      aum: aum,
      data_source: 'yahoo_comprehensive',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ [YAHOO] Error for ${ticker}:`, error);
    return {};
  }
}

// Hybrid data fetcher - EODHD for real-time prices, Yahoo for comprehensive data
async function fetchSmartETFData(ticker: string, eodhApiKey: string): Promise<Partial<ETFUpdateData>> {
  console.log(`🧠 [HYBRID] Smart fetch for ${ticker} - EODHD price + Yahoo fundamentals`);
  
  // Step 1: Try EODHD for real-time price (what we're paying for)
  const eodhData = await fetchEODHDData(ticker, eodhApiKey);
  
  // Step 2: Get comprehensive data from Yahoo (fundamentals, yield, AUM, historical)
  const yahooData = await fetchYahooFinanceData(ticker);
  
  // Step 3: Merge data - prioritize EODHD price, Yahoo fundamentals
  const mergedData: Partial<ETFUpdateData> = {
    ticker,
    // Use EODHD price if available (real-time, professional grade)
    current_price: eodhData.current_price || yahooData.current_price,
    // Use Yahoo for fundamentals (not included in basic EODHD plan)
    yield_ttm: yahooData.yield_ttm,
    aum: yahooData.aum,
    total_return_1y: yahooData.total_return_1y,
    // Use best available volume data
    avg_volume: eodhData.avg_volume || yahooData.avg_volume,
    // Track data source combination
    data_source: eodhData.current_price ? 
      (yahooData.yield_ttm ? 'eodhd_price+yahoo_fundamentals' : 'eodhd_price_only') : 
      'yahoo_comprehensive',
    timestamp: new Date().toISOString()
  };
  
  console.log(`✅ [HYBRID] Merged data for ${ticker}: $${mergedData.current_price} (${mergedData.data_source})`);
  return mergedData;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting Hybrid ETF Updater (EODHD prices + Yahoo fundamentals)');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const eodhApiKey = Deno.env.get('EODHD_API_KEY');

    if (!supabaseUrl || !supabaseKey || !eodhApiKey) {
      throw new Error('Missing required environment variables');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create a log entry for this update run
    const { data: logEntry } = await supabase
      .from('daily_update_logs')
      .insert({ 
        status: 'running',
        start_time: new Date().toISOString()
      })
      .select('id')
      .single();

    const logId = logEntry?.id;

    // Get all active ETFs
    console.log('📊 Fetching active ETFs from database');
    const { data: etfs, error: etfError } = await supabase
      .from('etfs')
      .select('id, ticker, country, data_source')
      .eq('active', true);

    if (etfError) {
      throw new Error(`Failed to fetch ETFs: ${etfError.message}`);
    }

    console.log(`📈 Found ${etfs?.length || 0} active ETFs to process`);

    let totalUpdated = 0;
    let eodhPriceCount = 0;
    let yahooFundamentalsCount = 0;
    let yahooOnlyCount = 0;
    const errorMessages = [];
    const batchSize = 3; // Conservative batch size

    // Process ETFs in batches
    for (let i = 0; i < (etfs?.length || 0); i += batchSize) {
      const batch = etfs!.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(etfs!.length / batchSize)}`);

      const updatePromises = batch.map(async (etf) => {
        try {
          const updateData = await fetchSmartETFData(etf.ticker, eodhApiKey);
          
          if (updateData.current_price && updateData.current_price > 0) {
            // Update price cache first
            await supabase
              .from('price_cache')
              .upsert({
                ticker: etf.ticker,
                price: updateData.current_price,
                source: updateData.data_source,
                updated_at: new Date().toISOString()
              });

            // Update ETF record
            const { error: updateError } = await supabase
              .from('etfs')
              .update({
                current_price: updateData.current_price,
                yield_ttm: updateData.yield_ttm,
                avg_volume: updateData.avg_volume,
                total_return_1y: updateData.total_return_1y,
                aum: updateData.aum,
                data_source: updateData.data_source,
                price_updated_at: new Date().toISOString()
              })
              .eq('id', etf.id);

            if (updateError) {
              console.error(`❌ Failed to update ${etf.ticker}:`, updateError);
              errorMessages.push(`Update failed for ${etf.ticker}: ${updateError.message}`);
              return false;
            }

            // Track source statistics
            if (updateData.data_source?.includes('eodhd_price')) {
              eodhPriceCount++;
              if (updateData.data_source.includes('yahoo_fundamentals')) {
                yahooFundamentalsCount++;
              }
            } else if (updateData.data_source === 'yahoo_comprehensive') {
              yahooOnlyCount++;
            }

            console.log(`✅ Updated ${etf.ticker} via ${updateData.data_source}: $${updateData.current_price}`);
            return true;
          }
          
          errorMessages.push(`No valid price data for ${etf.ticker}`);
          return false;
        } catch (error) {
          console.error(`❌ Error processing ${etf.ticker}:`, error);
          errorMessages.push(`Error processing ${etf.ticker}: ${error.message}`);
          return false;
        }
      });

      const batchResults = await Promise.all(updatePromises);
      totalUpdated += batchResults.filter(Boolean).length;

      // Rate limiting delay between batches
      if (i + batchSize < etfs!.length) {
        console.log('⏸️ Pausing between batches...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Update log entry with completion status
    if (logId) {
      await supabase
        .from('daily_update_logs')
        .update({
          status: 'completed',
          end_time: new Date().toISOString(),
          total_etfs: etfs?.length || 0,
          updated_etfs: totalUpdated,
          error_message: errorMessages.length > 0 ? errorMessages.join('; ') : null
        })
        .eq('id', logId);
    }

    const result = {
      success: true,
      message: 'Hybrid ETF update completed (EODHD prices + Yahoo fundamentals)',
      timestamp: new Date().toISOString(),
      summary: {
        totalETFs: etfs?.length || 0,
        updatedETFs: totalUpdated,
        skippedETFs: (etfs?.length || 0) - totalUpdated,
        sourceBreakdown: {
          eodhd_prices: eodhPriceCount,
          yahoo_fundamentals: yahooFundamentalsCount,  
          yahoo_only: yahooOnlyCount
        }
      },
      errors: errorMessages
    };

    console.log('🎉 Hybrid update completed');
    console.log(`📊 Updated: ${totalUpdated}/${etfs?.length || 0} ETFs`);
    console.log(`📈 EODHD Prices: ${eodhPriceCount}, Yahoo Fundamentals: ${yahooFundamentalsCount}, Yahoo Only: ${yahooOnlyCount}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in Hybrid ETF Updater:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});