import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ETFUpdateData {
  ticker?: string;
  current_price?: number;
  yield_ttm?: number;
  avg_volume?: number;
  total_return_1y?: number;
  expense_ratio?: number;
  aum?: number;
  data_source?: string;
  price_updated_at?: string;
}

// Fetch comprehensive data from EODHD (replaces Yahoo Finance)
async function fetchEODHDData(ticker: string, apiKey: string): Promise<Partial<ETFUpdateData>> {
  try {
    console.log(`📊 Fetching EODHD data for ${ticker}`);

    // Format ticker for EODHD
    const eodhTicker = ticker.includes('.TO') 
      ? ticker.replace('.TO', '.TSE') 
      : ticker.includes('.') 
        ? ticker 
        : `${ticker}.US`;

    const result: Partial<ETFUpdateData> = {
      ticker,
      data_source: 'EODHD',
      price_updated_at: new Date().toISOString()
    };

    // Fetch real-time quote
    const quoteUrl = `https://eodhd.com/api/real-time/${eodhTicker}?api_token=${apiKey}&fmt=json`;
    const quoteResponse = await fetch(quoteUrl);
    
    if (quoteResponse.ok) {
      const quoteData = await quoteResponse.json();
      if (quoteData.close) {
        result.current_price = parseFloat(quoteData.close);
      }
    }

    // Fetch fundamentals for yield, AUM, expense ratio
    const fundUrl = `https://eodhd.com/api/fundamentals/${eodhTicker}?api_token=${apiKey}&filter=Highlights,Valuation,Technicals`;
    const fundResponse = await fetch(fundUrl);
    
    if (fundResponse.ok) {
      const fundData = await fundResponse.json();
      const highlights = fundData?.Highlights;
      
      if (highlights?.DividendYield && highlights.DividendYield > 0) {
        result.yield_ttm = highlights.DividendYield;
      }
      
      if (highlights?.SharesOutstanding && result.current_price) {
        // Estimate AUM as shares * price (approximation)
        result.aum = Math.round(highlights.SharesOutstanding * result.current_price);
      }
    }

    // Fetch historical data for 1-year return and volume
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const histUrl = `https://eodhd.com/api/eod/${eodhTicker}?api_token=${apiKey}&from=${startDate}&to=${endDate}&fmt=json`;
    const histResponse = await fetch(histUrl);
    
    if (histResponse.ok) {
      const histData = await histResponse.json();
      
      if (Array.isArray(histData) && histData.length > 250) { // Ensure we have enough data
        const oldestPrice = parseFloat(histData[0].close);
        const newestPrice = parseFloat(histData[histData.length - 1].close);
        
        if (oldestPrice && newestPrice) {
          result.total_return_1y = ((newestPrice - oldestPrice) / oldestPrice) * 100;
        }

        // Calculate average volume
        const volumes = histData.map(d => parseInt(d.volume)).filter(v => v > 0);
        if (volumes.length > 0) {
          result.avg_volume = Math.round(volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length);
        }
      }
    }

    console.log(`✅ EODHD data for ${ticker}:`, {
      price: result.current_price,
      yield: result.yield_ttm,
      return_1y: result.total_return_1y,
      volume: result.avg_volume,
      aum: result.aum
    });

    return result;

  } catch (error) {
    console.error(`Error fetching EODHD data for ${ticker}:`, error);
    return { ticker, data_source: 'EODHD_ERROR' };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting EODHD-based ETF data update');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const eodhApiKey = Deno.env.get('EODHD_API_KEY')!;

    if (!eodhApiKey) {
      throw new Error('EODHD API key not found');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log update start
    const { data: logEntry } = await supabase
      .from('daily_update_logs')
      .insert({
        status: 'running',
        total_etfs: 0,
        updated_etfs: 0
      })
      .select()
      .single();

    // Fetch active ETFs
    const { data: etfs, error: etfsError } = await supabase
      .from('etfs')
      .select('ticker, name')
      .eq('active', true)
      .order('aum', { ascending: false, nullsLast: true });

    if (etfsError) {
      throw new Error(`Failed to fetch ETFs: ${etfsError.message}`);
    }

    if (!etfs || etfs.length === 0) {
      throw new Error('No active ETFs found');
    }

    console.log(`📊 Found ${etfs.length} active ETFs to update`);

    let updatedCount = 0;
    const batchSize = 10; // EODHD allows higher rate limits
    
    // Process ETFs in batches
    for (let i = 0; i < etfs.length; i += batchSize) {
      const batch = etfs.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(etfs.length/batchSize)}: ${batch.map(e => e.ticker).join(', ')}`);

      // Process batch in parallel
      const batchPromises = batch.map(async (etf) => {
        try {
          const updateData = await fetchEODHDData(etf.ticker, eodhApiKey);
          
          if (updateData.current_price || updateData.yield_ttm || updateData.total_return_1y) {
            // Update price cache
            await supabase
              .from('price_cache')
              .upsert({
                ticker: etf.ticker,
                price: updateData.current_price || 0,
                source: 'EODHD',
                updated_at: new Date().toISOString()
              }, { onConflict: 'ticker' });

            // Update ETF record
            const updateFields: any = {
              updated_at: new Date().toISOString(),
              data_source: 'EODHD'
            };

            if (updateData.current_price) {
              updateFields.current_price = updateData.current_price;
              updateFields.price_updated_at = new Date().toISOString();
            }
            if (updateData.yield_ttm) updateFields.yield_ttm = updateData.yield_ttm;
            if (updateData.total_return_1y) updateFields.total_return_1y = updateData.total_return_1y;
            if (updateData.avg_volume) updateFields.avg_volume = updateData.avg_volume;
            if (updateData.aum) updateFields.aum = updateData.aum;

            await supabase
              .from('etfs')
              .update(updateFields)
              .eq('ticker', etf.ticker);

            console.log(`✅ Updated ${etf.ticker}`);
            return true;
          } else {
            console.log(`⚠️ No useful data found for ${etf.ticker}`);
            return false;
          }
        } catch (error) {
          console.error(`❌ Failed to update ${etf.ticker}:`, error);
          return false;
        }
      });

      const results = await Promise.all(batchPromises);
      updatedCount += results.filter(Boolean).length;

      // Rate limiting between batches
      if (i + batchSize < etfs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Update log entry
    if (logEntry) {
      await supabase
        .from('daily_update_logs')
        .update({
          status: 'completed',
          end_time: new Date().toISOString(),
          total_etfs: etfs.length,
          updated_etfs: updatedCount
        })
        .eq('id', logEntry.id);
    }

    console.log(`🎉 Update completed: ${updatedCount}/${etfs.length} ETFs updated`);

    return new Response(JSON.stringify({
      success: true,
      message: 'EODHD ETF data update completed',
      totalEtfs: etfs.length,
      updatedEtfs: updatedCount,
      updateDate: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in EODHD ETF updater:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});