import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from './useAdmin';

// Bulk hook to fetch multiple ETF-related data types in a single query
export const useBulkETFData = (tickers: string[]) => {
  const { isAdmin } = useAdmin();
  
  return useQuery({
    queryKey: ["bulk-etf-data", tickers.sort().join(',')],
    queryFn: async () => {
      if (tickers.length === 0) return {};
      
      console.log('🔄 Fetching bulk ETF data for', tickers.length, 'tickers...');
      
      try {
        // Single query to get all ETF data including metadata we commonly need
        const { data: etfData, error } = await supabase
          .from('etfs')
          .select(`
            ticker, 
            name, 
            currency, 
            country, 
            current_price, 
            price_updated_at, 
            yield_ttm, 
            expense_ratio, 
            aum, 
            avg_volume,
            total_return_1y,
            volatility_1y,
            max_drawdown_1y,
            manager,
            category,
            strategy_label,
            logo_key,
            data_source,
            polygon_supported,
            twelve_symbol,
            eodhd_symbol
          `)
          .in('ticker', tickers);

        if (error) {
          console.error('❌ Bulk ETF data fetch error:', error);
          return {};
        }

        // Transform into a convenient lookup object
        const bulkData: Record<string, any> = {};
        etfData?.forEach(etf => {
          bulkData[etf.ticker] = etf;
        });

        console.log(`✅ Loaded bulk data for ${Object.keys(bulkData).length} ETFs`);
        return bulkData;
        
      } catch (error) {
        console.error('❌ useBulkETFData failed:', error);
        return {};
      }
    },
    enabled: tickers.length > 0,
    staleTime: isAdmin ? 0 : 5 * 60 * 1000, // 5 minutes cache for users
    refetchOnMount: isAdmin,
    refetchOnWindowFocus: isAdmin,
  });
};

// Bulk hook for dividend predictions - gets multiple predictions in one call
export const useBulkDividendPredictions = (tickers: string[]) => {
  return useQuery({
    queryKey: ["bulk-dividend-predictions", tickers.sort().join(',')],
    queryFn: async () => {
      if (tickers.length === 0) return {};
      
      console.log('🔄 Fetching bulk dividend predictions for', tickers.length, 'tickers...');
      
      try {
        // Get recent dividends for all tickers in bulk
        const { data: dividendData, error } = await supabase
          .from('dividends')
          .select('ticker, amount, ex_date')
          .in('ticker', tickers)
          .order('ex_date', { ascending: false });

        if (error) {
          console.error('❌ Bulk dividend fetch error:', error);
          return {};
        }

        const predictions: Record<string, any> = {};

        // Process predictions for each ticker
        tickers.forEach(ticker => {
          const tickerDividends = dividendData?.filter(d => d.ticker === ticker) || [];
          
          if (tickerDividends.length >= 2) {
            // Calculate average amount from recent distributions
            const amounts = tickerDividends.map(d => Number(d.amount)).filter(a => a > 0);
            const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;

            // Calculate average days between distributions
            const dates = tickerDividends.map(d => new Date(d.ex_date)).sort((a, b) => b.getTime() - a.getTime());
            
            if (dates.length >= 2) {
              const intervals = [];
              for (let i = 0; i < Math.min(dates.length - 1, 10); i++) {
                const daysDiff = Math.floor((dates[i].getTime() - dates[i + 1].getTime()) / (1000 * 60 * 60 * 24));
                if (daysDiff > 0 && daysDiff < 400) intervals.push(daysDiff);
              }

              if (intervals.length > 0) {
                const avgInterval = intervals.reduce((sum, int) => sum + int, 0) / intervals.length;
                const lastDate = dates[0];
                const nextDate = new Date(lastDate.getTime() + avgInterval * 24 * 60 * 60 * 1000);
                
                // Only include if it's in the future
                if (nextDate > new Date()) {
                  predictions[ticker] = {
                    amount: avgAmount,
                    date: nextDate.toISOString().split('T')[0]
                  };
                }
              }
            }
          }
        });

        console.log(`✅ Generated ${Object.keys(predictions).length} dividend predictions`);
        return predictions;
        
      } catch (error) {
        console.error('❌ Bulk dividend predictions failed:', error);
        return {};
      }
    },
    enabled: tickers.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours cache
  });
};

// Bulk hook for RSI signals - gets multiple signals in one call
export const useBulkRSISignals = (tickers: string[]) => {
  return useQuery({
    queryKey: ["bulk-rsi-signals", tickers.sort().join(',')],
    queryFn: async () => {
      if (tickers.length === 0) return {};
      
      console.log('🔄 Fetching bulk RSI signals for', tickers.length, 'tickers...');
      
      try {
        const { data, error } = await supabase.functions.invoke('yfinance-rsi', {
          body: { tickers }
        });

        if (error) {
          console.error('❌ Bulk RSI fetch error:', error);
          return {};
        }

        console.log(`✅ Fetched RSI signals for ${Object.keys(data?.signals || {}).length} tickers`);
        return data?.signals || {};
        
      } catch (error) {
        console.error('❌ Bulk RSI signals failed:', error);
        return {};
      }
    },
    enabled: tickers.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hour cache
  });
};

// Enhanced bulk rankings hook that fetches multiple weeks of data efficiently
export const useBulkRankingHistory = (tickers: string[], weeksToFetch: number = 4) => {
  return useQuery({
    queryKey: ['bulk-ranking-history', tickers.sort().join(','), weeksToFetch],
    queryFn: async () => {
      if (tickers.length === 0) return {};

      // Generate week dates
      const weekDates: string[] = [];
      for (let i = 0; i < weeksToFetch; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (date.getDay() - 1) - (i * 7)); // Monday of each week
        weekDates.push(date.toISOString().split('T')[0]);
      }

      // Fetch all rankings data in one query
      const { data: allRankings, error } = await supabase
        .from('etf_rankings')
        .select('ticker, rank_position, week_date')
        .in('week_date', weekDates)
        .in('ticker', tickers);

      if (error) throw error;

      // Group by ticker for easy lookup
      const rankingHistory: Record<string, any[]> = {};
      tickers.forEach(ticker => {
        rankingHistory[ticker] = weekDates.map(weekDate => {
          const ranking = allRankings?.find(r => r.ticker === ticker && r.week_date === weekDate);
          return {
            weekDate,
            rank: ranking?.rank_position || null
          };
        });
      });

      console.log(`✅ Loaded ${weeksToFetch} weeks of ranking history for ${Object.keys(rankingHistory).length} ETFs`);
      return rankingHistory;
    },
    enabled: tickers.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};