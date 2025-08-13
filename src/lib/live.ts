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
    .select('ticker, country, data_source, polygon_supported, twelve_symbol, finnhub_symbol, eodhd_symbol')
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
      // Use EODHD specifically for Canadian ETFs
      eodhTickers.push(etf.ticker);
    } else if (etf.country === 'US') {
      // US tickers that aren't Polygon-supported go to fallback (polygon-quotes with region=US)
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
  
  if (eodhTickers.length > 0) {
    try {
      // Use EODHD quotes function for Canadian ETFs only
      const { data, error } = await supabase.functions.invoke("quotes", {
        body: { tickers: eodhTickers },
      });
      if (error) throw error;
      const eodhData = (data?.prices as Record<string, number>) || {};
      
      // Convert to LivePrice format
      Object.entries(eodhData).forEach(([ticker, price]) => {
        results[ticker] = { price };
      });
    } catch (error) {
      console.warn('EODHD fetch failed for Canadian tickers:', eodhTickers, error);
    }
  }

  return results;
}
