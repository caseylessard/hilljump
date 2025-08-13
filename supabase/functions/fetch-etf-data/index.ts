// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function log(level: string, message: string, data?: any) {
  console.log(`[ETF-DATA-FETCH] ${message}`, data ? JSON.stringify(data) : '');
}

// Alpha Vantage API for fundamental data
async function fetchAlphaVantageData(symbol: string, country: string, apiKey: string) {
  try {
    // Format symbol for Alpha Vantage based on country
    let apiSymbol = symbol;
    if (country === 'CA') {
      // Canadian symbols need .TO suffix for Alpha Vantage
      apiSymbol = symbol.endsWith('.TO') ? symbol : `${symbol}.TO`;
    }
    
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${apiSymbol}&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    // Log raw data for specific Canadian tickers
    if (symbol === 'QQCL' || symbol === 'HTAE' || symbol.includes('QQCL') || symbol.includes('HTAE')) {
      log('INFO', `Alpha Vantage RAW data for ${apiSymbol}:`, data);
    }
    
    if (data.Symbol && !data.Note && !data.Information) {
      const result = {
        symbol: data.Symbol,
        dividendYield: parseFloat(data.DividendYield) || null,
        marketCap: parseFloat(data.MarketCapitalization) || null,
        beta: parseFloat(data.Beta) || null,
        peRatio: parseFloat(data.PERatio) || null,
      };
      if (symbol === 'QQCL' || symbol === 'HTAE' || symbol.includes('QQCL') || symbol.includes('HTAE')) {
        log('INFO', `Alpha Vantage PARSED data for ${apiSymbol}:`, result);
      }
      return result;
    }
    return null;
  } catch (error) {
    log('ERROR', `Alpha Vantage fetch failed for ${symbol}:`, error);
    return null;
  }
}

// Yahoo Finance API (alternative source)
async function fetchYahooFinanceData(symbol: string, country: string) {
  try {
    // Format symbol for Yahoo Finance based on country
    let apiSymbol = symbol;
    if (country === 'CA') {
      // Canadian symbols need .TO suffix for Yahoo Finance
      apiSymbol = symbol.endsWith('.TO') ? symbol : `${symbol}.TO`;
    }
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${apiSymbol}`;
    const response = await fetch(url);
    const data = await response.json();
    
    // Log raw data for specific Canadian tickers
    if (symbol === 'QQCL' || symbol === 'HTAE' || symbol.includes('QQCL') || symbol.includes('HTAE')) {
      log('INFO', `Yahoo Finance RAW data for ${apiSymbol}:`, data);
    }
    
    if (data?.chart?.result?.[0]) {
      const result = data.chart.result[0];
      const meta = result.meta;
      const parsedResult = {
        symbol: meta.symbol,
        currentPrice: meta.regularMarketPrice || null,
        dividendYield: meta.dividendYield ? meta.dividendYield * 100 : null, // Convert to percentage
        trailingPE: meta.trailingPE || null,
        marketCap: meta.marketCap || null,
      };
      if (symbol === 'QQCL' || symbol === 'HTAE' || symbol.includes('QQCL') || symbol.includes('HTAE')) {
        log('INFO', `Yahoo Finance PARSED data for ${apiSymbol}:`, parsedResult);
      }
      return parsedResult;
    }
    return null;
  } catch (error) {
    log('ERROR', `Yahoo Finance fetch failed for ${symbol}:`, error);
    return null;
  }
}

// Financial Modeling Prep API (free tier available)
async function fetchFMPData(symbol: string) {
  try {
    // Using demo API key - users should replace with their own
    const url = `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=demo`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && data.length > 0) {
      const quote = data[0];
      return {
        symbol: quote.symbol,
        currentPrice: quote.price || null,
        marketCap: quote.marketCap || null,
        volume: quote.volume || null,
        change: quote.change || null,
        changesPercentage: quote.changesPercentage || null,
      };
    }
    return null;
  } catch (error) {
    log('ERROR', `FMP fetch failed for ${symbol}:`, error);
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log('INFO', 'ETF data fetch started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const alphaVantageKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get ETFs that need data updates (those with NULL yield or old data)
    const { data: etfs, error: fetchError } = await supabase
      .from('etfs')
      .select('ticker, country, yield_ttm, total_return_1y, updated_at')
      .or('yield_ttm.is.null,total_return_1y.is.null')
      .order('ticker')
      .limit(10); // Process in batches to avoid rate limits

    if (fetchError) {
      throw new Error(`Failed to fetch ETFs: ${fetchError.message}`);
    }

    if (!etfs || etfs.length === 0) {
      log('INFO', 'No ETFs need data updates');
      return new Response(JSON.stringify({ message: 'No ETFs need updates', updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log('INFO', `Fetching data for ${etfs.length} ETFs`);
    
    let updated = 0;
    const updates = [];

    for (const etf of etfs) {
      const ticker = etf.ticker;
      const country = etf.country || 'US';
      log('INFO', `Processing ${ticker} (${country})`);

      let etfData: any = null;

      // Try multiple data sources in order of preference
      if (alphaVantageKey && !etfData) {
        etfData = await fetchAlphaVantageData(ticker, country, alphaVantageKey);
        if (etfData) log('INFO', `Alpha Vantage data found for ${ticker}`);
      }

      if (!etfData) {
        etfData = await fetchYahooFinanceData(ticker, country);
        if (etfData) log('INFO', `Yahoo Finance data found for ${ticker}`);
      }

      if (!etfData) {
        // Try the .TO version for Canadian funds if original didn't work
        const fallbackTicker = country === 'CA' && !ticker.endsWith('.TO') ? `${ticker}.TO` : ticker;
        etfData = await fetchFMPData(fallbackTicker);
        if (etfData) log('INFO', `FMP data found for ${fallbackTicker}`);
      }

      if (etfData) {
        const updateData: any = { updated_at: new Date().toISOString() };
        
        // Map the fetched data to our database fields
        if (etfData.dividendYield && etfData.dividendYield > 0) {
          updateData.yield_ttm = etfData.dividendYield;
        }
        
        if (etfData.marketCap) {
          updateData.aum = etfData.marketCap;
        }
        
        if (etfData.volume) {
          updateData.avg_volume = etfData.volume;
        }

        // Calculate a rough 1Y return estimate if we have price data
        if (etfData.changesPercentage) {
          // This is a very rough estimate - in reality you'd need historical data
          updateData.total_return_1y = etfData.changesPercentage * 4; // Rough quarterly extrapolation
        }

        updates.push({ ticker, updateData });
        updated++;

        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        log('WARN', `No data found for ${ticker}`);
      }
    }

    // Batch update the database
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('etfs')
        .update(update.updateData)
        .eq('ticker', update.ticker);

      if (updateError) {
        log('ERROR', `Failed to update ${update.ticker}:`, updateError);
      } else {
        log('INFO', `Updated ${update.ticker} successfully`);
      }
    }

    log('INFO', `ETF data fetch completed. Updated ${updated} ETFs`);

    return new Response(JSON.stringify({ 
      message: 'ETF data fetch completed', 
      processed: etfs.length,
      updated: updated,
      updates: updates.map(u => ({ ticker: u.ticker, fields: Object.keys(u.updateData) }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log('ERROR', `ETF data fetch failed: ${message}`);
    
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});