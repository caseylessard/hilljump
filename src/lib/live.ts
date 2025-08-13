import { supabase } from "@/integrations/supabase/client";

export type LivePrice = {
  price: number;
  prevClose?: number;
  change?: number;
  changePercent?: number;
  // 4W/12W/52W DRIP enrichment (optional)
  price4wStart?: number;
  dividends4w?: number;
  drip4wDollar?: number;
  drip4wPercent?: number;
  price12wStart?: number;
  dividends12w?: number;
  drip12wDollar?: number;
  drip12wPercent?: number;
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
  return (data?.prices as Record<string, LivePrice>) || {};
}

export async function fetchLivePricesWithDataSources(tickers: string[]): Promise<Record<string, LivePrice>> {
  // Get ETF data source information for smarter price fetching
  const { data: etfData, error: etfError } = await supabase
    .from('etfs')
    .select('ticker, country, data_source, polygon_supported, twelve_symbol, finnhub_symbol, eodhd_symbol, yield_ttm, aum, avg_volume, total_return_1y')
    .in('ticker', tickers);
  
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
  
  // For EODHD tickers, use the database data that's updated by WebSocket
  if (eodhTickers.length > 0) {
    try {
      console.log('Using database data for EODHD tickers:', eodhTickers);
      
      // Get the latest data from database (updated by WebSocket)
      const { data: dbData, error: dbError } = await supabase
        .from('etfs')
        .select('ticker, yield_ttm, aum, avg_volume, total_return_1y')
        .in('ticker', eodhTickers);
      
      if (dbError) throw dbError;
      
      // Convert database data to LivePrice format
      dbData?.forEach((etf: any) => {
        // Create a synthetic price from yield and return data for display
        // This is placeholder logic - you might want to store actual prices in DB
        const estimatedPrice = etf.yield_ttm ? (100 / Math.max(etf.yield_ttm, 1)) : 50;
        
        results[etf.ticker] = {
          price: estimatedPrice,
          // Add any other data we have from the database
          ...(etf.yield_ttm && { yieldTTM: etf.yield_ttm }),
          ...(etf.aum && { aum: etf.aum }),
          ...(etf.avg_volume && { volume: etf.avg_volume }),
          ...(etf.total_return_1y && { totalReturn1Y: etf.total_return_1y })
        };
      });
      
      console.log(`Retrieved database data for ${Object.keys(results).length} EODHD tickers`);
    } catch (error) {
      console.warn('Database fetch failed for EODHD tickers:', eodhTickers, error);
      
      // Fallback: try the quotes function anyway
      try {
        const { data, error } = await supabase.functions.invoke("quotes", {
          body: { tickers: eodhTickers },
        });
        if (error) throw error;
        const eodhData = (data?.prices as Record<string, number>) || {};
        
        // Convert to LivePrice format
        Object.entries(eodhData).forEach(([ticker, price]) => {
          results[ticker] = { price };
        });
      } catch (fallbackError) {
        console.warn('EODHD quotes fallback also failed:', fallbackError);
      }
    }
  }

  return results;
}
