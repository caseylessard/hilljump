import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Yahoo Finance - Free and no API limits (web scraping)
async function fetchYahooFinanceData(ticker: string): Promise<any> {
  try {
    console.log(`📊 [YAHOO] Fetching ${ticker}`);
    
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
      return null;
    }
    
    const quoteData = await quoteResponse.json();
    const result = quoteData?.quoteSummary?.result?.[0];
    
    if (!result) return null;
    
    const summaryDetail = result.summaryDetail;
    const price = result.price;
    const keyStats = result.defaultKeyStatistics;
    
    return {
      ticker,
      current_price: price?.regularMarketPrice?.raw,
      yield_ttm: summaryDetail?.dividendYield?.raw ? summaryDetail.dividendYield.raw * 100 : null,
      avg_volume: summaryDetail?.averageVolume?.raw,
      total_return_1y: keyStats?.['52WeekChange']?.raw ? keyStats['52WeekChange'].raw * 100 : null,
      data_source: 'yahoo_finance'
    };
    
  } catch (error) {
    console.error(`❌ [YAHOO] Error for ${ticker}:`, error);
    return null;
  }
}

// Stooq - Free backup for Canadian/international tickers
async function fetchStooqData(ticker: string): Promise<any> {
  try {
    console.log(`🇨🇦 [STOOQ] Fetching ${ticker}`);
    
    // Convert ticker format for Stooq
    const stooqTicker = ticker.includes('.TO') ? ticker.replace('.TO', '') : ticker;
    const url = `https://stooq.com/q/l/?s=${stooqTicker}&f=sd2t2ohlcvn&h&e=csv`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return null;
    
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    
    if (lines.length < 2) return null;
    
    const data = lines[1].split(',');
    const price = parseFloat(data[4]); // Close price
    
    if (isNaN(price) || price <= 0) return null;
    
    return {
      ticker,
      current_price: price,
      data_source: 'stooq'
    };
    
  } catch (error) {
    console.error(`❌ [STOOQ] Error for ${ticker}:`, error);
    return null;
  }
}

// EODHD - Only for premium ETFs (use 20 daily calls wisely)
async function fetchEODHDForPremium(tickers: string[], apiKey: string): Promise<any[]> {
  try {
    console.log(`🎯 [EODHD] Using precious free calls for top ${tickers.length} ETFs`);
    
    const results = [];
    
    // Use batch endpoint to maximize efficiency
    for (const ticker of tickers.slice(0, 15)) { // Save 5 calls for emergencies
      const priceUrl = `https://eodhd.com/api/real-time/${ticker}?api_token=${apiKey}&fmt=json`;
      const priceResponse = await fetch(priceUrl);
      
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        const currentPrice = priceData.close || priceData.price;
        
        if (currentPrice && currentPrice > 0) {
          results.push({
            ticker,
            current_price: currentPrice,
            data_source: 'eodhd'
          });
        }
      }
      
      // Rate limiting - don't overwhelm the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ [EODHD] Error:', error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting Free-Tier Optimized Price Updater');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const eodhApiKey = Deno.env.get('EODHD_API_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create log entry
    const { data: logEntry } = await supabase
      .from('daily_update_logs')
      .insert({ status: 'running', start_time: new Date().toISOString() })
      .select('id')
      .single();

    // Get ETFs with priority ranking
    console.log('📊 Fetching ETFs with smart prioritization');
    const { data: etfs, error: etfError } = await supabase
      .from('etfs')
      .select('id, ticker, country, aum, avg_volume')
      .eq('active', true)
      .order('aum', { ascending: false, nullsLast: true })
      .order('avg_volume', { ascending: false, nullsLast: true });

    if (etfError) {
      throw new Error(`Failed to fetch ETFs: ${etfError.message}`);
    }

    console.log(`📈 Processing ${etfs?.length || 0} ETFs with smart allocation`);

    let totalUpdated = 0;
    let eodhCount = 0;
    let yahooCount = 0;
    let stooqCount = 0;

    // Tier 1: Top 15 ETFs get EODHD (premium free calls)
    const topTiers = etfs!.slice(0, 15);
    if (eodhApiKey && topTiers.length > 0) {
      console.log(`🎯 Tier 1: Using EODHD for top ${topTiers.length} ETFs`);
      const eodhResults = await fetchEODHDForPremium(topTiers.map(e => e.ticker), eodhApiKey);
      
      for (const result of eodhResults) {
        const etf = topTiers.find(e => e.ticker === result.ticker);
        if (etf) {
          await supabase.from('price_cache').upsert({
            ticker: result.ticker,
            price: result.current_price,
            source: result.data_source,
            updated_at: new Date().toISOString()
          });

          await supabase.from('etfs').update({
            current_price: result.current_price,
            data_source: result.data_source,
            price_updated_at: new Date().toISOString()
          }).eq('id', etf.id);

          eodhCount++;
          totalUpdated++;
          console.log(`✅ EODHD: ${result.ticker} = $${result.current_price}`);
        }
      }
    }

    // Tier 2: Remaining ETFs use free Yahoo Finance (no limits)
    const remainingETFs = etfs!.slice(15);
    console.log(`📊 Tier 2: Using Yahoo Finance for remaining ${remainingETFs.length} ETFs`);
    
    const batchSize = 5;
    for (let i = 0; i < remainingETFs.length; i += batchSize) {
      const batch = remainingETFs.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (etf) => {
        // Try Yahoo first
        let result = await fetchYahooFinanceData(etf.ticker);
        
        // For Canadian tickers, try Stooq if Yahoo fails
        if (!result && etf.ticker.includes('.TO')) {
          result = await fetchStooqData(etf.ticker);
          if (result) stooqCount++;
        } else if (result) {
          yahooCount++;
        }
        
        if (result && result.current_price) {
          await supabase.from('price_cache').upsert({
            ticker: result.ticker,
            price: result.current_price,
            source: result.data_source,
            updated_at: new Date().toISOString()
          });

          await supabase.from('etfs').update({
            current_price: result.current_price,
            yield_ttm: result.yield_ttm,
            avg_volume: result.avg_volume,
            total_return_1y: result.total_return_1y,
            data_source: result.data_source,
            price_updated_at: new Date().toISOString()
          }).eq('id', etf.id);

          totalUpdated++;
          console.log(`✅ ${result.data_source.toUpperCase()}: ${result.ticker} = $${result.current_price}`);
          return true;
        }
        return false;
      });

      await Promise.all(batchPromises);

      // Respectful rate limiting for free services
      if (i + batchSize < remainingETFs.length) {
        console.log('⏸️ Pausing between batches...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Update log
    if (logEntry?.id) {
      await supabase
        .from('daily_update_logs')
        .update({
          status: 'completed',
          end_time: new Date().toISOString(),
          total_etfs: etfs?.length || 0,
          updated_etfs: totalUpdated
        })
        .eq('id', logEntry.id);
    }

    const result = {
      success: true,
      message: 'Free-Tier Optimized Update Completed',
      timestamp: new Date().toISOString(),
      summary: {
        totalETFs: etfs?.length || 0,
        updatedETFs: totalUpdated,
        sourceBreakdown: {
          eodhd: eodhCount,
          yahoo_finance: yahooCount,
          stooq: stooqCount
        }
      }
    };

    console.log('🎉 Free-tier update completed successfully!');
    console.log(`📊 Sources: EODHD(${eodhCount}) + Yahoo(${yahooCount}) + Stooq(${stooqCount}) = ${totalUpdated} total`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in Free-Tier Updater:', error);
    
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