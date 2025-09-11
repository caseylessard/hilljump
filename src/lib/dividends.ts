// Minimal stub for dividend utilities
export interface Distribution {
  ticker: string;
  amount: number;
  date: string; // Change exDate to date to match expected interface
  currency?: string;
}

export const fetchLatestDistributions = async (tickers: string[]) => {
  console.log('Fetching latest distributions (stub)');
  return {};
};

export const predictNextDistribution = (ticker: string, distributions: any[]) => {
  return null;
};