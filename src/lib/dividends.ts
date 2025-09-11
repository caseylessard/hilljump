// Minimal stub for dividend utilities
export interface Distribution {
  ticker: string;
  amount: number;
  date: string; // Change exDate to date to match expected interface
  currency?: string;
}

export const fetchLatestDistributions = async (tickers: string[]) => {
  console.log('📦 Fetching latest distributions for', tickers.length, 'tickers...');
  
  if (tickers.length === 0) return {};
  
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    
    // Get the latest distribution for each ticker
    const { data, error } = await supabase
      .from('dividends')
      .select('ticker, amount, ex_date, cash_currency')
      .in('ticker', tickers)
      .order('ex_date', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching distributions:', error);
      return {};
    }
    
    // Group by ticker and keep only the latest for each
    const distributions: Record<string, Distribution> = {};
    data?.forEach(row => {
      if (!distributions[row.ticker]) {
        distributions[row.ticker] = {
          ticker: row.ticker,
          amount: row.amount,
          date: row.ex_date, // Use ex_date as the main date
          currency: row.cash_currency
        };
      }
    });
    
    console.log('✅ Fetched', Object.keys(distributions).length, 'latest distributions');
    return distributions;
  } catch (error) {
    console.error('❌ Failed to fetch distributions:', error);
    return {};
  }
};

export const predictNextDistribution = (ticker: string, distributions: any[]) => {
  return null;
};