export interface EODHDPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close: number;
  volume: number;
}

export interface EODHDData {
  ticker: string;
  historicalPrices: EODHDPrice[];
}

export interface StockMetrics {
  ticker: string;
  currentPrice: number;
  
  // Price arrays for z-score
  prices20d: number[];
  prices50d: number[];
  prices100d?: number[];
  
  // Technical indicators
  rsi: number;
  momentumScore: number;
  priceChangePercent: number;
  
  // Volume analysis
  volumeRatio: number;
  volumeTrend: 'increasing' | 'decreasing' | 'neutral';
  
  // Volatility
  atr: number;
  
  // 52-week stats
  high52Week: number;
  low52Week: number;
  
  // Relative strength
  relativeStrength: number;
}

export type SignalStrategy = 'Z_SCORE_REVERSION' | 'MOMENTUM_REGIME' | 'RELATIVE_STRENGTH';

export interface TradingSignal {
  ticker: string;
  company: string;
  direction: 'CALL' | 'PUT';
  strategy: SignalStrategy;
  conviction: number;
  entry: number;
  target: number;
  stop: number;
  rr: number;
  strike: number;
  exitDate: Date;
  days: number;
  position: number;
  rsi: number;
  momentum: number;
  vol: number;
  zScore: string;
  zScore20: string;
  relStrength: number;
  atr: string;
  regime: 'CHOPPY' | 'TRENDING' | 'NEUTRAL';
  qualifier: string;
  reasoning: string;
  estimatedOptionReturn: number;
  estimatedDelta: number;
  extremeZScore: boolean;
  atrPercent: number;
  riskTier: 'Conservative' | 'Moderate' | 'Aggressive';
  daysToExpiration: number;
}

export interface ScannerConfig {
  minConviction: number;
  maxSignals: number;
  cacheDuration: number;
}

export interface ScanProgress {
  current: number;
  total: number;
  ticker: string;
}

export interface ScanResult {
  signals: TradingSignal[];
  totalAnalyzed: number;
  qualifiedSignals: number;
  avgConviction: number;
  avgRR: number;
}

export interface CachedSignal {
  signal: TradingSignal;
  expiry: number;
}
