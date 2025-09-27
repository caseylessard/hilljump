import { useMemo, useState, useEffect } from 'react';
import { ScoredETF } from '@/lib/scoring';

interface FrozenRankingConfig {
  etfs: ScoredETF[];
  dripData: Record<string, any>;
  storedScores: Record<string, any>;
  isDripDataComplete: boolean;
}

/**
 * Hook that manages frozen/stable rankings to prevent position jumping
 * when data loads incrementally. Uses DRIP sums when complete, falls back
 * to stored composite scores to maintain consistent ordering.
 */
export const useFrozenRankings = ({ etfs, dripData, storedScores, isDripDataComplete }: FrozenRankingConfig) => {
  // Map to store frozen rank positions: ticker -> rank number
  const [frozenRankings, setFrozenRankings] = useState<Map<string, number>>(new Map());
  
  // Helper to calculate DRIP sum for a ticker
  const getDripSum = (ticker: string): number => {
    const tickerData = dripData[ticker];
    if (!tickerData) return 0;
    
    const drip4w = tickerData.drip4wPercent || 0;
    const drip13w = tickerData.drip13wPercent || 0;
    const drip26w = tickerData.drip26wPercent || 0;
    const drip52w = tickerData.drip52wPercent || 0;
    
    return drip4w + drip13w + drip26w + drip52w;
  };
  
  // Create ranking based on best available data
  const currentRanking = useMemo(() => {
    if (!etfs.length) return [];
    
    // Sort ETFs by best available score
    const sortedETFs = [...etfs].sort((a, b) => {
      if (isDripDataComplete) {
        // Use DRIP sum when complete data is available
        const sumA = getDripSum(a.ticker);
        const sumB = getDripSum(b.ticker);
        
        if (sumA !== sumB) {
          return sumB - sumA; // Descending by DRIP sum
        }
      }
      
      // Fall back to stored composite scores
      const scoreA = storedScores[a.ticker]?.composite_score || 0;
      const scoreB = storedScores[b.ticker]?.composite_score || 0;
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Descending by composite score
      }
      
      // Final tiebreaker: alphabetical
      return a.ticker.localeCompare(b.ticker);
    });
    
    return sortedETFs;
  }, [etfs, dripData, storedScores, isDripDataComplete]);
  
  // Update frozen rankings when we have stable data
  useEffect(() => {
    if (currentRanking.length === 0) return;
    
    // Only update frozen rankings if we have meaningful data
    const hasValidData = isDripDataComplete || Object.keys(storedScores).length > 0;
    
    if (hasValidData) {
      const newFrozenRankings = new Map<string, number>();
      currentRanking.forEach((etf, index) => {
        newFrozenRankings.set(etf.ticker, index + 1);
      });
      
      // Only update if significantly different (avoid minor fluctuations)
      const hasSignificantChanges = currentRanking.some((etf, index) => {
        const currentRank = frozenRankings.get(etf.ticker);
        const newRank = index + 1;
        return !currentRank || Math.abs(currentRank - newRank) > 2;
      });
      
      if (hasSignificantChanges || frozenRankings.size === 0) {
        setFrozenRankings(newFrozenRankings);
        console.log(`🔒 Updated frozen rankings with ${newFrozenRankings.size} positions using ${isDripDataComplete ? 'DRIP' : 'stored'} scores`);
      }
    }
  }, [currentRanking, isDripDataComplete, storedScores]);
  
  // Function to get rank for a specific ticker
  const getRankForTicker = (ticker: string): number | null => {
    return frozenRankings.get(ticker) || null;
  };
  
  // Function to sort any array by frozen rankings
  const sortByFrozenRank = <T extends { ticker: string }>(items: T[]): T[] => {
    return [...items].sort((a, b) => {
      const rankA = getRankForTicker(a.ticker);
      const rankB = getRankForTicker(b.ticker);
      
      // Handle null rankings (put at end)
      if (rankA === null && rankB === null) return 0;
      if (rankA === null) return 1;
      if (rankB === null) return -1;
      
      return rankA - rankB; // Ascending by rank (lower rank = better position)
    });
  };
  
  return {
    frozenRankings,
    currentRanking,
    getRankForTicker,
    sortByFrozenRank,
    isDripDataComplete
  };
};