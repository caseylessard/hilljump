import { supabase } from "@/integrations/supabase/client";

export type LivePrice = {
  price: number;
  prevClose?: number;
  change?: number;
  changePercent?: number;
  priceUpdatedAt?: string;
  // 4W/12W/52W DRIP enrichment (optional)
  price4wStart?: number;
  dividends4w?: number;
  drip4wDollar?: number;
  drip4wPercent?: number;
  price13wStart?: number;
  dividends13w?: number;
  drip13wDollar?: number;
  drip13wPercent?: number;
  price26wStart?: number;
  dividends26w?: number;
  drip26wDollar?: number;
  drip26wPercent?: number;
  price52wStart?: number;
  dividends52w?: number;
  drip52wDollar?: number;
  drip52wPercent?: number;
  // Legacy 28d enrichment (optional)
  price28dStart?: number;
  change28dPercent?: number;
  dividends28d?: number;
  dividends28dReturnPercent?: number;
  totalReturn28dPercent?: number;
};

export async function fetchLivePrices(tickers: string[], region: 'US' | 'CA' = 'CA'): Promise<Record<string, LivePrice>> {
  const { data, error } = await supabase.functions.invoke("polygon-quotes", {
    body: { tickers, include28d: true, includeDRIP: true, region },
  });
  if (error) throw error;
  
  const prices = (data?.prices as Record<string, LivePrice>) || {};
  
  // Update database with fetched prices and yield data
  if (Object.keys(prices).length > 0) {
    try {
      const updates = Object.entries(prices).map(([ticker, priceData]) => ({
        ticker,
        current_price: priceData.price,
        price_updated_at: new Date().toISOString(),
        // Update yield if available from API response
        ...(data?.yields?.[ticker] && { yield_ttm: data.yields[ticker] })
      }));

      // Batch update the database
      for (const update of updates) {
        await supabase
          .from('etfs')
          .update({
            current_price: update.current_price,
            price_updated_at: update.price_updated_at,
            ...(update.yield_ttm && { yield_ttm: update.yield_ttm })
          })
          .eq('ticker', update.ticker);
      }
      
      console.log(`Updated database with ${updates.length} live prices`);
    } catch (updateError) {
      console.warn('Failed to update database with live prices:', updateError);
    }
  }
  
  return prices;
}

export async function fetchLivePricesWithDataSources(tickers: string[]): Promise<Record<string, LivePrice>> {
  // Get ETF data source information for smarter price fetching
  // Also try variations with common Canadian suffixes for tickers not found
  const tickerVariations = [...tickers];
  tickers.forEach(ticker => {
    if (!ticker.includes('.')) {
      tickerVariations.push(`${ticker}.TO`, `${ticker}.NE`);
    }
  });
  
  const { data: etfData, error: etfError } = await supabase
    .from('etfs')
    .select('ticker, country, data_source, polygon_supported, twelve_symbol, eodhd_symbol, yield_ttm, aum, avg_volume, total_return_1y, current_price, price_updated_at')
    .in('ticker', tickerVariations);
  
  if (etfError) {
    console.warn('Could not fetch ETF data sources, falling back to region-based fetching');
    return fetchLivePrices(tickers, 'CA');
  }

  // Group tickers by their optimal data source
  const polygonTickers: string[] = [];
  const eodhTickers: string[] = [];
  const fallbackTickers: string[] = [];
  
  etfData?.forEach((etf: any) => {
    if (etf.polygon_supported && etf.country === 'US') {
      polygonTickers.push(etf.ticker);
    } else if (etf.data_source === 'eodhd' || etf.country === 'CA' || etf.ticker.endsWith('.TO')) {
      // EODHD tickers - we'll use database data that's updated by WebSocket
      eodhTickers.push(etf.ticker);
    } else if (etf.country === 'US') {
      // US tickers that aren't Polygon-supported go to fallback
      fallbackTickers.push(etf.ticker);
    } else {
      // Everything else goes to fallback
      fallbackTickers.push(etf.ticker);
    }
  });

  // Add any tickers not found in database to appropriate group
  const dbTickers = new Set(etfData?.map((etf: any) => etf.ticker) || []);
  tickers.forEach(ticker => {
    if (!dbTickers.has(ticker)) {
      if (ticker.endsWith('.TO')) {
        // Canadian ticker
        eodhTickers.push(ticker);
      } else {
        // Default: assume US ticker
        fallbackTickers.push(ticker);
      }
    }
  });

  // Fetch prices from appropriate sources
  const results: Record<string, LivePrice> = {};
  
  if (polygonTickers.length > 0) {
    try {
      const usData = await fetchLivePrices(polygonTickers, 'US');
      Object.assign(results, usData);
    } catch (error) {
      console.warn('Polygon fetch failed for US tickers:', polygonTickers, error);
    }
  }
  
  if (fallbackTickers.length > 0) {
    try {
      // Use polygon-quotes for US tickers that aren't polygon supported
      const usData = await fetchLivePrices(fallbackTickers, 'US');
      Object.assign(results, usData);
    } catch (error) {
      console.warn('US fallback fetch failed:', fallbackTickers, error);
    }
  }
  
  // For EODHD tickers, try database first, then fallback to live quotes
  if (eodhTickers.length > 0) {
    try {
      console.log('🎯 Fetching EODHD prices directly for fresh data:', eodhTickers);
      
      // Use the quotes function which now prioritizes EODHD
      const { data, error } = await supabase.functions.invoke("quotes", {
        body: { tickers: eodhTickers },
      });
      
      if (!error && data?.prices) {
        const eodhData = data.prices as Record<string, number>;
        
        // Convert to LivePrice format and add to results
        Object.entries(eodhData).forEach(([ticker, price]) => {
          if (price > 0) {
            results[ticker] = { price };
          }
        });
        
        console.log(`✅ Retrieved ${Object.keys(eodhData).length} EODHD prices`);
      } else {
        console.warn('EODHD quotes failed, trying database fallback:', error);
        
        // Fallback to database data
        const { data: dbData, error: dbError } = await supabase
          .from('etfs')
          .select('ticker, current_price, price_updated_at')
          .in('ticker', eodhTickers);
        
        dbData?.forEach((etf: any) => {
          if (etf.current_price && etf.current_price > 0) {
            results[etf.ticker] = {
              price: etf.current_price,
              priceUpdatedAt: etf.price_updated_at
            };
          }
        });
      }
      
    } catch (error) {
      console.warn('EODHD fetch completely failed:', eodhTickers, error);
    }
  }

  // Map results back to original ticker names (without suffixes)
  const mappedResults: Record<string, LivePrice> = {};
  
  // First, add all exact matches
  Object.entries(results).forEach(([ticker, price]) => {
    mappedResults[ticker] = price;
  });
  
  // Then, for tickers that weren't found exactly, try to map from suffixed versions
  tickers.forEach(originalTicker => {
    if (!mappedResults[originalTicker]) {
      // Check if we have a suffixed version of this ticker
      const suffixedTicker = Object.keys(results).find(ticker => 
        ticker === `${originalTicker}.TO` || ticker === `${originalTicker}.NE`
      );
      
      if (suffixedTicker && results[suffixedTicker]) {
        mappedResults[originalTicker] = results[suffixedTicker];
      }
    }
  });

  return mappedResults;
}
