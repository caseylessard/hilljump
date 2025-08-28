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
  expense_ratio?: number;
  volatility_1y?: number;
  max_drawdown_1y?: number;
  data_source: string;
  last_updated: string;
}

// Premium EODHD data fetching with comprehensive data
async function fetchComprehensiveEODHDData(ticker: string, apiKey: string): Promise<Partial<ETFUpdateData>> {
  try {
    console.log(`🎯 [EODHD Premium] Processing ${ticker}`);
    
    // 1. Real-time price data
    const priceUrl = `https://eodhd.com/api/real-time/${ticker}?api_token=${apiKey}&fmt=json`;
    const priceResponse = await fetch(priceUrl);
    
    if (!priceResponse.ok) {
      console.warn(`❌ Price fetch failed for ${ticker}: ${priceResponse.status}`);
      return {};
    }
    
    const priceData = await priceResponse.json();
    const currentPrice = priceData.close || priceData.price;
    
    if (!currentPrice || currentPrice <= 0) {
      console.warn(`❌ Invalid price for ${ticker}: ${currentPrice}`);
      return {};
    }

    // 2. Comprehensive fundamentals data
    const fundUrl = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiKey}&fmt=json`;
    const fundResponse = await fetch(fundUrl);
    
    let fundamentalData: any = {};
    if (fundResponse.ok) {
      fundamentalData = await fundResponse.json();
    }

    // 3. Historical data for performance calculations (1 year)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const histUrl = `https://eodhd.com/api/eod/${ticker}?api_token=${apiKey}&period=d&from=${startDate}&to=${endDate}`;
    const histResponse = await fetch(histUrl);
    
    let performanceMetrics: any = {};
    if (histResponse.ok) {
      const histData = await histResponse.json();
      
      if (Array.isArray(histData) && histData.length >= 2) {
        performanceMetrics = calculatePerformanceMetrics(histData, currentPrice);
      }
    }

    // Extract comprehensive data
    const extractedData: Partial<ETFUpdateData> = {
      ticker,
      current_price: currentPrice,
      data_source: 'eodhd_premium',
      last_updated: new Date().toISOString(),
      
      // Yield data
      yield_ttm: fundamentalData?.AnalystRatings?.DividendYield || 
                fundamentalData?.Highlights?.DividendYield ||
                fundamentalData?.SplitsDividends?.ForwardAnnualDividendYield,
      
      // Volume data
      avg_volume: fundamentalData?.Highlights?.SharesOutstanding || 
                 priceData.volume || 
                 fundamentalData?.General?.SharesOutstanding,
      
      // Assets Under Management
      aum: fundamentalData?.General?.TotalAssets || 
           fundamentalData?.Highlights?.TotalAssets,
      
      // Risk metrics
      expense_ratio: fundamentalData?.General?.ExpenseRatio ||
                    fundamentalData?.Highlights?.ExpenseRatio,
      
      // Performance metrics from historical analysis
      ...performanceMetrics
    };

    console.log(`✅ [EODHD Premium] ${ticker}: $${currentPrice}, yield: ${extractedData.yield_ttm?.toFixed(2)}%, 1Y return: ${extractedData.total_return_1y?.toFixed(2)}%`);
    
    return extractedData;
    
  } catch (error) {
    console.error(`❌ [EODHD Premium] Error for ${ticker}:`, error);
    return {};
  }
}

// Calculate comprehensive performance metrics from historical data
function calculatePerformanceMetrics(histData: any[], currentPrice: number) {
  if (!histData || histData.length < 2) return {};
  
  const prices = histData.map(d => d.close);
  const oldestPrice = prices[0];
  const newestPrice = prices[prices.length - 1] || currentPrice;
  
  // 1-Year Total Return
  const totalReturn1Y = oldestPrice > 0 ? ((newestPrice - oldestPrice) / oldestPrice) * 100 : null;
  
  // Volatility calculation (standard deviation of daily returns)
  const dailyReturns = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i-1] > 0) {
      dailyReturns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
  }
  
  let volatility1Y = null;
  if (dailyReturns.length > 0) {
    const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
    volatility1Y = Math.sqrt(variance * 252) * 100; // Annualized volatility
  }
  
  // Maximum Drawdown calculation
  let maxDrawdown1Y = null;
  if (prices.length > 0) {
    let peak = prices[0];
    let maxDd = 0;
    
    for (const price of prices) {
      if (price > peak) {
        peak = price;
      }
      const drawdown = (peak - price) / peak;
      if (drawdown > maxDd) {
        maxDd = drawdown;
      }
    }
    maxDrawdown1Y = maxDd * 100;
  }
  
  return {
    total_return_1y: totalReturn1Y,
    volatility_1y: volatility1Y,
    max_drawdown_1y: maxDrawdown1Y
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting Premium EODHD ETF Data Updater');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const eodhApiKey = Deno.env.get('EODHD_API_KEY');

    if (!supabaseUrl || !supabaseKey || !eodhApiKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create log entry
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
    console.log('📊 Fetching all active ETFs for comprehensive update');
    const { data: etfs, error: etfError } = await supabase
      .from('etfs')
      .select('id, ticker, country, exchange')
      .eq('active', true)
      .order('ticker');

    if (etfError) {
      throw new Error(`Failed to fetch ETFs: ${etfError.message}`);
    }

    console.log(`📈 Processing ${etfs?.length || 0} ETFs with premium EODHD data`);

    let totalUpdated = 0;
    const errorMessages = [];
    const batchSize = 10; // Can be more aggressive with paid plan

    // Process ETFs in batches
    for (let i = 0; i < (etfs?.length || 0); i += batchSize) {
      const batch = etfs!.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(etfs!.length / batchSize)}`);

      const updatePromises = batch.map(async (etf) => {
        try {
          const updateData = await fetchComprehensiveEODHDData(etf.ticker, eodhApiKey);
          
          if (updateData.current_price && updateData.current_price > 0) {
            // Update price cache
            await supabase
              .from('price_cache')
              .upsert({
                ticker: etf.ticker,
                price: updateData.current_price,
                source: updateData.data_source,
                updated_at: new Date().toISOString()
              });

            // Update ETF record with comprehensive data
            const { error: updateError } = await supabase
              .from('etfs')
              .update({
                current_price: updateData.current_price,
                yield_ttm: updateData.yield_ttm,
                avg_volume: updateData.avg_volume,
                total_return_1y: updateData.total_return_1y,
                aum: updateData.aum,
                expense_ratio: updateData.expense_ratio,
                volatility_1y: updateData.volatility_1y,
                max_drawdown_1y: updateData.max_drawdown_1y,
                data_source: updateData.data_source,
                price_updated_at: new Date().toISOString()
              })
              .eq('id', etf.id);

            if (updateError) {
              console.error(`❌ Failed to update ${etf.ticker}:`, updateError);
              errorMessages.push(`Update failed for ${etf.ticker}: ${updateError.message}`);
              return false;
            }

            console.log(`✅ Updated ${etf.ticker}: $${updateData.current_price}`);
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

      // Respectful rate limiting (can be faster with paid plan)
      if (i + batchSize < etfs!.length) {
        console.log('⏸️ Brief pause between batches...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Update log entry
    if (logId) {
      await supabase
        .from('daily_update_logs')
        .update({
          status: 'completed',
          end_time: new Date().toISOString(),
          total_etfs: etfs?.length || 0,
          updated_etfs: totalUpdated,
          error_message: errorMessages.length > 0 ? errorMessages.slice(0, 10).join('; ') : null
        })
        .eq('id', logId);
    }

    const result = {
      success: true,
      message: 'Premium EODHD comprehensive update completed',
      timestamp: new Date().toISOString(),
      summary: {
        totalETFs: etfs?.length || 0,
        updatedETFs: totalUpdated,
        successRate: `${((totalUpdated / (etfs?.length || 1)) * 100).toFixed(1)}%`,
        dataQuality: 'Premium real-time with comprehensive fundamentals',
        apiCallsUsed: totalUpdated * 3, // Approximate
        dailyLimitUsed: `${((totalUpdated * 3) / 100000 * 100).toFixed(2)}%`
      },
      errors: errorMessages.slice(0, 5) // Show first 5 errors
    };

    console.log('🎉 Premium EODHD update completed successfully!');
    console.log(`📊 Updated: ${totalUpdated}/${etfs?.length || 0} ETFs with comprehensive data`);
    console.log(`📈 API Usage: ~${totalUpdated * 3} calls (~${((totalUpdated * 3) / 100000 * 100).toFixed(2)}% of daily limit)`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in Premium EODHD Updater:', error);
    
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