export type ETF = {
  ticker: string;
  name: string;
  exchange: string; // primary listing exchange
  totalReturn1Y: number; // percentage
  yieldTTM: number; // percentage
  avgVolume: number; // shares/day
  expenseRatio: number; // percentage
  volatility1Y: number; // percentage
  maxDrawdown1Y: number; // negative percentage
  aum: number; // Assets Under Management (USD)
  category?: string;
  summary?: string; // plain language description of the ETF
  // Persisted metadata (optional)
  country?: string; // e.g., 'US' | 'CA'
  manager?: string; // e.g., 'YieldMax'
  strategyLabel?: string; // e.g., 'CC ETF - NVDA'
  logoKey?: string; // maps to a local asset key
  // Data source information for improved price fetching
  dataSource?: string; // e.g., 'polygon', 'twelvedata'
  polygonSupported?: boolean; // whether ticker is supported by Polygon
  twelveSymbol?: string; // symbol format for TwelveData API
  finnhubSymbol?: string; // symbol format for Finnhub API
  eodhSymbol?: string; // symbol format for EOD Historical Data API
};

export const SAMPLE_ETFS: ETF[] = [
  { ticker: "TSLY", name: "YieldMax TSLA Option Income ETF", exchange: "NYSE Arca", totalReturn1Y: 42.5, yieldTTM: 54.0, avgVolume: 3200000, expenseRatio: 0.99, volatility1Y: 38.0, maxDrawdown1Y: -24.0, aum: 2100000000, category: "YieldMax" },
  { ticker: "NVDY", name: "YieldMax NVDA Option Income ETF", exchange: "NYSE Arca", totalReturn1Y: 39.1, yieldTTM: 45.0, avgVolume: 2100000, expenseRatio: 0.99, volatility1Y: 35.0, maxDrawdown1Y: -20.0, aum: 1800000000, category: "YieldMax" },
  { ticker: "APLY", name: "YieldMax AAPL Option Income ETF", exchange: "NYSE Arca", totalReturn1Y: 22.8, yieldTTM: 36.0, avgVolume: 850000, expenseRatio: 0.99, volatility1Y: 28.0, maxDrawdown1Y: -18.0, aum: 600000000, category: "YieldMax" },
  { ticker: "AMDY", name: "YieldMax AMD Option Income ETF", exchange: "NYSE Arca", totalReturn1Y: 31.4, yieldTTM: 40.0, avgVolume: 600000, expenseRatio: 0.99, volatility1Y: 33.0, maxDrawdown1Y: -22.0, aum: 450000000, category: "YieldMax" },
  { ticker: "QYLD", name: "Global X NASDAQ 100 Covered Call", exchange: "NASDAQ", totalReturn1Y: 14.2, yieldTTM: 12.0, avgVolume: 2200000, expenseRatio: 0.60, volatility1Y: 20.0, maxDrawdown1Y: -12.0, aum: 7000000000, category: "Covered Call" },
  { ticker: "JEPI", name: "JPMorgan Equity Premium Income", exchange: "NYSE Arca", totalReturn1Y: 18.7, yieldTTM: 7.8, avgVolume: 5300000, expenseRatio: 0.35, volatility1Y: 14.0, maxDrawdown1Y: -9.0, aum: 33000000000, category: "Income" },
  { ticker: "JEPQ", name: "JPMorgan Nasdaq Equity Premium Income", exchange: "NASDAQ", totalReturn1Y: 21.3, yieldTTM: 10.3, avgVolume: 4800000, expenseRatio: 0.35, volatility1Y: 17.0, maxDrawdown1Y: -10.0, aum: 13000000000, category: "Income" },
  { ticker: "XYLD", name: "Global X S&P 500 Covered Call", exchange: "NYSE Arca", totalReturn1Y: 12.1, yieldTTM: 10.8, avgVolume: 900000, expenseRatio: 0.60, volatility1Y: 16.0, maxDrawdown1Y: -11.0, aum: 2500000000, category: "Covered Call" },
  { ticker: "RYLD", name: "Global X Russell 2000 Covered Call", exchange: "NYSE Arca", totalReturn1Y: 8.6, yieldTTM: 12.2, avgVolume: 650000, expenseRatio: 0.60, volatility1Y: 22.0, maxDrawdown1Y: -15.0, aum: 1500000000, category: "Covered Call" },
  { ticker: "DIVO", name: "Amplify CWP Enhanced Dividend Income", exchange: "NYSE Arca", totalReturn1Y: 11.9, yieldTTM: 4.9, avgVolume: 350000, expenseRatio: 0.55, volatility1Y: 12.0, maxDrawdown1Y: -8.0, aum: 3500000000, category: "Dividend" },
];
