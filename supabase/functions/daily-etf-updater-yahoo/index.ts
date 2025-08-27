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
  current_price?: number;
}

// Fetch data from Yahoo Finance (replaces Polygon, TwelveData, EODHD)
async function fetchYahooFinanceData(ticker: string): Promise<Partial<ETFUpdateData>> {
  try {
    console.log(`📊 Fetching Yahoo Finance data for ${ticker}`);
    
    // Get quote data including price and basic metrics
    const quoteUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail,price,defaultKeyStatistics,fundProfile`;
    const quoteResponse = await fetch(quoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!quoteResponse.ok) {
      console.warn(`Yahoo Finance quote failed for ${ticker}: ${quoteResponse.status}`);
      return {};
    }
    
    const quoteData = await quoteResponse.json();
    const result = quoteData?.quoteSummary?.result?.[0];
    
    if (!result) return {};
    
    // Extract data from different modules
    const summaryDetail = result.summaryDetail;
    const price = result.price;
    const keyStats = result.defaultKeyStatistics;
    const fundProfile = result.fundProfile;
    
    // Get historical data for 1-year return calculation
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (365 * 24 * 60 * 60); // 1 year ago
    
    const histUrl = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d&events=history`;
    const histResponse = await fetch(histUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    let totalReturn1Y;
    let avgVolume;
    
    if (histResponse.ok) {
      const csvText = await histResponse.text();
      const lines = csvText.trim().split('\n');
      
      if (lines.length > 1) {
        // Parse CSV for volume and return calculation
        const volumes = [];
        let currentPrice, yearAgoPrice;
        
        for (let i = 1; i < lines.length; i++) {
          const columns = lines[i].split(',');
          if (columns.length >= 6) {
            const volume = parseFloat(columns[6]);
            const closePrice = parseFloat(columns[4]);
            
            if (!isNaN(volume)) volumes.push(volume);
            if (i === 1) currentPrice = closePrice; // Most recent
            if (i === lines.length - 1) yearAgoPrice = closePrice; // Oldest
          }
        }
        
        // Calculate average volume
        if (volumes.length > 0) {
          avgVolume = Math.round(volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length);
        }
        
        // Calculate 1-year return
        if (currentPrice && yearAgoPrice && yearAgoPrice > 0) {
          totalReturn1Y = ((currentPrice - yearAgoPrice) / yearAgoPrice) * 100;
        }
      }
    }
    
    console.log(`✅ Yahoo Finance data for ${ticker}:`, {
      price: price?.regularMarketPrice?.raw,
      yield: summaryDetail?.dividendYield?.raw ? summaryDetail.dividendYield.raw * 100 : null,
      volume: avgVolume,
      return1Y: totalReturn1Y
    });
    
    return {
      ticker,
      current_price: price?.regularMarketPrice?.raw,
      yield_ttm: summaryDetail?.dividendYield?.raw ? summaryDetail.dividendYield.raw * 100 : undefined,
      avg_volume: avgVolume,
      total_return_1y: totalReturn1Y,
      // AUM is harder to get from Yahoo Finance for ETFs, skip for now
    };
    
  } catch (error) {
    console.error(`Error fetching Yahoo Finance data for ${ticker}:`, error);
    return {};
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting Yahoo Finance-based ETF data update');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
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
      .select('id, ticker, country')
      .eq('active', true);

    if (etfError) {
      throw new Error(`Failed to fetch ETFs: ${etfError.message}`);
    }

    console.log(`📈 Found ${etfs?.length || 0} active ETFs to process`);

    let totalUpdated = 0;
    const batchSize = 5; // Small batches to respect rate limits

    // Process ETFs in batches
    for (let i = 0; i < (etfs?.length || 0); i += batchSize) {
      const batch = etfs!.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(etfs!.length / batchSize)}`);

      const updatePromises = batch.map(async (etf) => {
        try {
          const updateData = await fetchYahooFinanceData(etf.ticker);
          
          if (Object.keys(updateData).length > 1) { // More than just ticker
            const { error: updateError } = await supabase
              .from('etfs')
              .update({
                current_price: updateData.current_price,
                yield_ttm: updateData.yield_ttm,
                avg_volume: updateData.avg_volume,
                total_return_1y: updateData.total_return_1y,
                price_updated_at: new Date().toISOString()
              })
              .eq('id', etf.id);

            if (updateError) {
              console.error(`❌ Failed to update ${etf.ticker}:`, updateError);
              return false;
            }

            console.log(`✅ Updated ${etf.ticker}`);
            return true;
          }
          return false;
        } catch (error) {
          console.error(`❌ Error processing ${etf.ticker}:`, error);
          return false;
        }
      });

      const batchResults = await Promise.all(updatePromises);
      totalUpdated += batchResults.filter(Boolean).length;

      // Rate limiting delay between batches
      if (i + batchSize < etfs!.length) {
        console.log('⏸️ Pausing between batches...');
        await new Promise(resolve => setTimeout(resolve, 2000));
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
          updated_etfs: totalUpdated
        })
        .eq('id', logId);
    }

    const result = {
      success: true,
      message: 'Yahoo Finance ETF data update completed',
      timestamp: new Date().toISOString(),
      summary: {
        totalETFs: etfs?.length || 0,
        updatedETFs: totalUpdated,
        skippedETFs: (etfs?.length || 0) - totalUpdated
      }
    };

    console.log('🎉 ETF data update process completed');
    console.log(`📊 Updated: ${totalUpdated}/${etfs?.length || 0} ETFs`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in Yahoo Finance ETF updater:', error);
    
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