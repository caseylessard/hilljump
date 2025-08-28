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

// EODHD - Primary data source (most reliable)
async function fetchEODHDData(ticker: string, apiKey: string): Promise<Partial<ETFUpdateData>> {
  try {
    console.log(`🎯 [EODHD] Fetching data for ${ticker}`);
    
    // Get real-time price
    const priceUrl = `https://eodhd.com/api/real-time/${ticker}?api_token=${apiKey}&fmt=json`;
    const priceResponse = await fetch(priceUrl);
    
    if (!priceResponse.ok) {
      console.warn(`❌ [EODHD] Price fetch failed for ${ticker}: ${priceResponse.status}`);
      return {};
    }
    
    const priceData = await priceResponse.json();
    const currentPrice = priceData.close || priceData.price;
    
    if (!currentPrice || currentPrice <= 0) {
      console.warn(`❌ [EODHD] Invalid price for ${ticker}: ${currentPrice}`);
      return {};
    }

    // Get fundamentals for additional data
    const fundUrl = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiKey}&fmt=json`;
    const fundResponse = await fetch(fundUrl);
    
    let yieldTtm, aum, avgVolume;
    
    if (fundResponse.ok) {
      const fundData = await fundResponse.json();
      
      // Extract yield and AUM from fundamentals
      yieldTtm = fundData?.AnalystRatings?.DividendYield || 
                 fundData?.Highlights?.DividendYield || 
                 fundData?.SplitsDividends?.ForwardAnnualDividendYield;
      
      aum = fundData?.General?.TotalAssets || fundData?.Highlights?.TotalAssets;
      
      // Get volume from fundamentals or price data
      avgVolume = fundData?.Highlights?.SharesOutstanding || priceData.volume;
    }

    // Get historical data for 1-year return
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const histUrl = `https://eodhd.com/api/eod/${ticker}?api_token=${apiKey}&period=d&from=${startDate}&to=${endDate}`;
    const histResponse = await fetch(histUrl);
    
    let totalReturn1Y;
    if (histResponse.ok) {
      const histData = await histResponse.json();
      
      if (Array.isArray(histData) && histData.length >= 2) {
        const oldestPrice = histData[0]?.close;
        const newestPrice = histData[histData.length - 1]?.close || currentPrice;
        
        if (oldestPrice && newestPrice && oldestPrice > 0) {
          totalReturn1Y = ((newestPrice - oldestPrice) / oldestPrice) * 100;
        }
      }
    }
    
    console.log(`✅ [EODHD] Success for ${ticker}: $${currentPrice}, yield: ${yieldTtm}%, return: ${totalReturn1Y?.toFixed(2)}%`);
    
    return {
      ticker,
      current_price: currentPrice,
      yield_ttm: yieldTtm,
      aum: aum,
      avg_volume: avgVolume,
      total_return_1y: totalReturn1Y,
      data_source: 'eodhd',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ [EODHD] Error for ${ticker}:`, error);
    return {};
  }
}

// Yahoo Finance - Fallback source
async function fetchYahooFinanceData(ticker: string): Promise<Partial<ETFUpdateData>> {
  try {
    console.log(`📊 [YAHOO] Fallback fetch for ${ticker}`);
    
    const quoteUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail,price,defaultKeyStatistics`;
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
      console.warn(`❌ [YAHOO] Failed for ${ticker}: ${quoteResponse.status}`);
      return {};
    }
    
    const quoteData = await quoteResponse.json();
    const result = quoteData?.quoteSummary?.result?.[0];
    
    if (!result) return {};
    
    const summaryDetail = result.summaryDetail;
    const price = result.price;
    
    console.log(`✅ [YAHOO] Success for ${ticker}: $${price?.regularMarketPrice?.raw}`);
    
    return {
      ticker,
      current_price: price?.regularMarketPrice?.raw,
      yield_ttm: summaryDetail?.dividendYield?.raw ? summaryDetail.dividendYield.raw * 100 : undefined,
      avg_volume: summaryDetail?.averageVolume?.raw,
      data_source: 'yahoo_finance',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ [YAHOO] Error for ${ticker}:`, error);
    return {};
  }
}

// Smart data fetcher - tries EODHD first, falls back to Yahoo
async function fetchSmartETFData(ticker: string, eodhApiKey: string): Promise<Partial<ETFUpdateData>> {
  // Try EODHD first (most reliable)
  const eodhData = await fetchEODHDData(ticker, eodhApiKey);
  
  if (eodhData.current_price && eodhData.current_price > 0) {
    return eodhData;
  }
  
  // Fallback to Yahoo Finance
  console.log(`🔄 [SMART] EODHD failed for ${ticker}, trying Yahoo Finance`);
  const yahooData = await fetchYahooFinanceData(ticker);
  
  return yahooData;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting Smart ETF Price Updater (EODHD + Yahoo fallback)');
    
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
    let eodhCount = 0;
    let yahooCount = 0;
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
            if (updateData.data_source === 'eodhd') {
              eodhCount++;
            } else {
              yahooCount++;
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
      message: 'Smart ETF price update completed',
      timestamp: new Date().toISOString(),
      summary: {
        totalETFs: etfs?.length || 0,
        updatedETFs: totalUpdated,
        skippedETFs: (etfs?.length || 0) - totalUpdated,
        sourceBreakdown: {
          eodhd: eodhCount,
          yahoo_finance: yahooCount
        }
      },
      errors: errorMessages
    };

    console.log('🎉 Smart price update completed');
    console.log(`📊 Updated: ${totalUpdated}/${etfs?.length || 0} ETFs`);
    console.log(`📈 EODHD: ${eodhCount}, Yahoo: ${yahooCount}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in Smart Price Updater:', error);
    
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