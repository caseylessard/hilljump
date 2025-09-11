// Minimal stub for cache functions - functionality moved to globalCache.ts
export const getCachedData = async () => {
  return {};
};

export const getCachedETFPrices = async (tickers: string[]) => {
  return {};
};

export const getCachedETFScoring = async (preferences: any, country?: string) => {
  return [];
};

export const getCachedDividendData = async (tickers: string[]) => {
  return {};
};

export const cache = {
  clear: () => console.log('Cache cleared (stub)'),
  get: (key: string) => null,
  set: (key: string, value: any) => {}
};