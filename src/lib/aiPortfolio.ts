// AI Portfolio builder stub
import { scoreETFsWithPrefs } from './scoring';
import { presets } from './rankingPresets';

export interface AIPortfolioETF {
  ticker: string;
  name: string;
  weight: number;
  shares: number;
  lastPrice: number;
  trendScore: number;
  ret1yScore: number;
  allocRounded?: number;
  allocationDollar?: number;
  badge?: string;
  badgeLabel?: string;
  badgeColor?: string;
  isEstimated?: boolean;
  category?: string;
  exchange?: string;
}

export type WeightingMethod = 'equal' | 'return' | 'risk_parity';
export type ScoreSource = 'trend' | 'ret1y' | 'blend';

export const buildAIPortfolio = async (
  etfs: any[], 
  prices: Record<string, any>,
  options: {
    topK: number;
    minTradingDays: number;
    scoreSource: ScoreSource;
    weighting: WeightingMethod;
    maxWeight: number;
    capital: number;
    roundShares: boolean;
  },
  dripData?: Record<string, any>
): Promise<AIPortfolioETF[]> => {
  console.log(`🎯 Building AI portfolio with ${etfs.length} ETFs, source: ${options.scoreSource}, weighting: ${options.weighting}`);

  if (etfs.length === 0) {
    console.warn('No ETFs provided to buildAIPortfolio');
    return [];
  }

  // Use the real Ladder-Delta Trend scoring system
  const scoredETFs = scoreETFsWithPrefs(
    etfs,
    presets.total_return, // Use total return preset for AI portfolio
    prices, // live prices
    dripData // DRIP data
  );

  console.log(`📊 Scored ${scoredETFs.length} ETFs using Ladder-Delta system`);

  if (scoredETFs.length === 0) {
    console.warn('No valid scored ETFs after Ladder-Delta scoring');
    return [];
  }

  // Sort by composite score and take top K
  const topETFs = scoredETFs
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, options.topK);

  console.log(`📊 Selected top ${topETFs.length} ETFs from ${scoredETFs.length} candidates`);

  // Calculate weights based on weighting method
  const weightedETFs = calculateWeights(topETFs, options.weighting, options.maxWeight);

  // Calculate allocations and shares
  const portfolioETFs: AIPortfolioETF[] = weightedETFs.map(etf => {
    const currentPrice = prices[etf.ticker]?.price || etf.current_price || 0;
    const allocationDollar = etf.weight * options.capital;
    const shares = options.roundShares 
      ? Math.floor(allocationDollar / currentPrice)
      : allocationDollar / currentPrice;
    
    const allocRounded = shares * currentPrice;

    // Convert scoring system scores to 0-100 scale for display
    const trendScore = Math.round((etf.dripScore || 0) * 100); // DRIP score represents trend
    const ret1yScore = Math.round((etf.returnScore || 0) * 100); // Return score

    // Determine badge based on composite score
    const { badge, badgeLabel, badgeColor } = determineBadge(etf);

    return {
      ticker: etf.ticker,
      name: etf.name || etf.ticker,
      weight: etf.weight,
      shares: Math.round(shares * 100) / 100, // Round to 2 decimals
      lastPrice: currentPrice,
      trendScore,
      ret1yScore,
      allocRounded,
      allocationDollar,
      badge,
      badgeLabel,
      badgeColor,
      isEstimated: !etf.total_return_1y && !dripData?.[etf.ticker]?.drip52wPercent, // Mark as estimated if missing key data
      category: etf.category || etf.strategy_label || 'Other',
      exchange: etf.exchange || 'N/A'
    };
  });

  const totalWeight = portfolioETFs.reduce((sum, etf) => sum + etf.weight, 0);
  console.log(`✅ Portfolio built: ${portfolioETFs.length} positions, total weight: ${(totalWeight * 100).toFixed(1)}%`);

  return portfolioETFs;
};

// Helper function to calculate trend score (0-100) - now uses real DRIP data
function calculateTrendScore(etf: any, priceData: any, dripData?: Record<string, any>): number {
  // First priority: Use cached DRIP data if available
  const cachedDrip = dripData?.[etf.ticker];
  if (cachedDrip) {
    const drip52w = cachedDrip.drip52wPercent || 0;
    const drip13w = cachedDrip.drip13wPercent || 0;
    const drip4w = cachedDrip.drip4wPercent || 0;
    
    if (drip52w !== 0 || drip13w !== 0 || drip4w !== 0) {
      // Weight recent performance more heavily (matches main scoring system)
      const dripScore = (drip52w * 0.2) + (drip13w * 0.3) + (drip4w * 0.5);
      return Math.max(0, Math.min(100, 50 + dripScore)); // Center around 50, bounded 0-100
    }
  }
  
  // Second priority: Use DRIP data from ETF object if available
  const drip52w = etf.drip_52w || 0;
  const drip13w = etf.drip_13w || 0;
  const totalReturn1Y = etf.total_return_1y || etf.totalReturn1Y || 0;

  // If we have DRIP data, use it (already in percentage form)
  if (drip52w !== 0 || drip13w !== 0) {
    const dripScore = (drip52w * 0.3) + (drip13w * 0.7); // Weight recent performance more
    return Math.max(0, Math.min(100, 50 + dripScore)); // Center around 50, bounded 0-100
  }

  // Otherwise use total return (convert from decimal to percentage, then normalize)
  if (totalReturn1Y !== 0) {
    const returnPct = totalReturn1Y * 100; // Convert to percentage
    return Math.max(0, Math.min(100, 50 + returnPct / 2)); // Normalize around 50
  }

  return 10; // Low score for missing data - don't reward lack of performance data
}

// Helper function to calculate return score (0-100)
function calculateReturnScore(etf: any, dripData?: Record<string, any>): number {
  // Try multiple possible field names and formats
  let totalReturn1Y = etf.total_return_1y || etf.totalReturn1Y || etf.totalReturn || 0;
  
  // Debug log for problematic ETFs
  if (etf.ticker === 'AVGY.TO') {
    console.log(`🔍 AVGY.TO return data:`, {
      total_return_1y: etf.total_return_1y,
      totalReturn1Y: etf.totalReturn1Y,
      totalReturn: etf.totalReturn,
      raw_etf: etf
    });
  }
  
  if (totalReturn1Y === 0 || totalReturn1Y === null || totalReturn1Y === undefined) {
    // If no total return data, use DRIP 52w as proxy for annual performance
    const cachedDrip = dripData?.[etf.ticker];
    if (cachedDrip && cachedDrip.drip52wPercent) {
      const dripReturn = cachedDrip.drip52wPercent;
      console.log(`📊 Using DRIP 52w for ${etf.ticker}: ${dripReturn}%`);
      
      // Normalize DRIP return: 0% = 50, +20% = 100, -20% = 0
      return Math.max(0, Math.min(100, 50 + (dripReturn * 2.5)));
    }
    
    // Also try ETF object DRIP data
    const etfDrip52w = etf.drip_52w || 0;
    if (etfDrip52w !== 0) {
      console.log(`📊 Using ETF DRIP 52w for ${etf.ticker}: ${etfDrip52w}%`);
      return Math.max(0, Math.min(100, 50 + (etfDrip52w * 2.5)));
    }
    
    return 10; // Low score for missing data - don't reward lack of performance data
  }
  
  // Handle both decimal (0.25 = 25%) and percentage (25) formats
  let returnPct = totalReturn1Y;
  if (Math.abs(totalReturn1Y) <= 5) {
    // Likely decimal format, convert to percentage
    returnPct = totalReturn1Y * 100;
  }
  // If already in percentage format, use as-is
  
  // Normalize: 0% return = 50, +20% = 100, -20% = 0
  const score = Math.max(0, Math.min(100, 50 + (returnPct * 2.5)));
  
  // Debug log for problematic ETFs
  if (etf.ticker === 'AVGY.TO') {
    console.log(`📊 AVGY.TO return score: ${score} (from ${returnPct}% return)`);
  }
  
  return score;
}

// Helper function to calculate weights
function calculateWeights(etfs: any[], method: WeightingMethod, maxWeight: number): any[] {
  const n = etfs.length;
  
  switch (method) {
    case 'equal':
      const equalWeight = Math.min(1 / n, maxWeight);
      return etfs.map(etf => ({ ...etf, weight: equalWeight }));
      
    case 'return':
      // Weight by composite score (performance-based)
      const totalScore = etfs.reduce((sum, etf) => sum + Math.max(0.1, etf.compositeScore), 0);
      return etfs.map(etf => ({
        ...etf,
        weight: Math.min(Math.max(0.1, etf.compositeScore) / totalScore, maxWeight)
      }));
      
    case 'risk_parity':
      // Weight inversely to volatility
      const invVolatilities = etfs.map(etf => 1 / Math.max(5, etf.volatility)); // Min 5% volatility
      const totalInvVol = invVolatilities.reduce((sum, iv) => sum + iv, 0);
      return etfs.map((etf, i) => ({
        ...etf,
        weight: Math.min(invVolatilities[i] / totalInvVol, maxWeight)
      }));
      
    default:
      return calculateWeights(etfs, 'equal', maxWeight);
  }
}

// Helper function to determine badge
function determineBadge(etf: any): { badge: string; badgeLabel: string; badgeColor: string } {
  const score = etf.compositeScore;
  
  if (score >= 80) {
    return { badge: '⭐', badgeLabel: 'Top Performer', badgeColor: 'green' };
  } else if (score >= 70) {
    return { badge: '📈', badgeLabel: 'Strong Buy', badgeColor: 'green' };
  } else if (score >= 60) {
    return { badge: '➡️', badgeLabel: 'Buy', badgeColor: 'blue' };
  } else if (score >= 40) {
    return { badge: '⚖️', badgeLabel: 'Hold', badgeColor: 'yellow' };
  } else {
    return { badge: '⚠️', badgeLabel: 'Caution', badgeColor: 'red' };
  }
}