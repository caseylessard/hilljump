import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type RankingChange = {
  ticker: string;
  currentRank: number;
  previousRank?: number;
  change: number; // positive = improved (moved up), negative = worsened (moved down)
  isNew?: boolean; // true if ticker wasn't ranked last week
}

export const useRankingHistory = (tickers: string[]) => {
  return useQuery({
    queryKey: ['ranking-history', tickers.sort().join(',')],
    queryFn: async (): Promise<Record<string, RankingChange>> => {
      if (tickers.length === 0) return {};

      // Get current week date (Monday of current week)
      const now = new Date();
      const currentWeekDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1);
      const currentWeekStr = currentWeekDate.toISOString().split('T')[0];

      // Get previous week date
      const previousWeekDate = new Date(currentWeekDate);
      previousWeekDate.setDate(previousWeekDate.getDate() - 7);
      const previousWeekStr = previousWeekDate.toISOString().split('T')[0];

      // Fetch rankings for both weeks in a single query for better performance
      const { data: allRankings, error } = await supabase
        .from('etf_rankings')
        .select('ticker, rank_position, week_date')
        .in('week_date', [currentWeekStr, previousWeekStr])
        .in('ticker', tickers);

      if (error) throw error;

      // Group rankings by week
      const currentRankings = allRankings?.filter(r => r.week_date === currentWeekStr) || [];
      const previousRankings = allRankings?.filter(r => r.week_date === previousWeekStr) || [];

      // Create lookup maps
      const currentMap = new Map(currentRankings?.map(r => [r.ticker, r.rank_position]) ?? []);
      const previousMap = new Map(previousRankings?.map(r => [r.ticker, r.rank_position]) ?? []);

      // Calculate changes
      const changes: Record<string, RankingChange> = {};
      
      tickers.forEach(ticker => {
        const currentRank = currentMap.get(ticker);
        const previousRank = previousMap.get(ticker);
        
        if (currentRank !== undefined) {
          changes[ticker] = {
            ticker,
            currentRank,
            previousRank,
            change: previousRank ? previousRank - currentRank : 0, // positive = moved up
            isNew: !previousRank
          };
        }
      });

      return changes;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: tickers.length > 0,
  });
};

export const saveCurrentRankings = async (rankings: any[]) => {
  try {
    const { data, error } = await supabase.functions.invoke('save-rankings', {
      body: { rankings }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to save rankings:', error);
    throw error;
  }
};