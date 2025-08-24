import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings } from 'lucide-react';
import { ETFTable } from '@/components/dashboard/ETFTable';
import { ScoringControls } from '@/components/dashboard/ScoringControls';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { ScoredETF, scoreETFs } from '@/lib/scoring';
import { Distribution } from '@/lib/dividends';
import { getETFs } from '@/lib/db';
import { UserBadge } from '@/components/UserBadge';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import { useCachedFirstThenLive, useProgressiveDataLoad } from '@/hooks/useCachedFirstThenLive';
import Navigation from '@/components/Navigation';

type FilterType = 'all' | 'canada' | 'usa' | 'high-yield';

// Load cached state from localStorage
const loadCachedState = () => {
  try {
    const cached = localStorage.getItem('ranking-state');
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        weights: parsed.weights || { return: 0.6, yield: 0.2, risk: 0.2 },
        filter: parsed.filter || "All ETFs",
        cachedRanking: parsed.cachedRanking || null,
        lastRankingUpdate: parsed.lastRankingUpdate || null
      };
    }
  } catch (e) {
    console.warn('Failed to load cached ranking state:', e);
  }
  return {
    weights: { return: 0.6, yield: 0.2, risk: 0.2 },
    filter: "All ETFs",
    cachedRanking: null,
    lastRankingUpdate: null
  };
};

const cachedState = loadCachedState();

const Ranking = () => {
  const [weights, setWeights] = useState(cachedState.weights);
  const [showDialog, setShowDialog] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cachedRanking, setCachedRanking] = useState<ScoredETF[] | null>(null);
  
  const { toast } = useToast();
  const { profile } = useUserProfile();

  // Fetch ETFs from database
  const { data: etfs = [], isLoading, error } = useQuery({
    queryKey: ['etfs'],
    queryFn: getETFs,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Memoize tickers to prevent unnecessary refetches
  const tickers = useMemo(() => etfs.map(etf => etf.ticker), [etfs]);
  
  // Use progressive data loading with specific order
  const progressiveData = useProgressiveDataLoad(tickers, weights);

  // Use progressive data for ranking
  const ranked: ScoredETF[] = useMemo(() => {
    return progressiveData.etfs;
  }, [progressiveData.etfs]);

  // Filter ETFs based on selected category
  const filtered: ScoredETF[] = useMemo(() => {
    return ranked.filter(etf => {
      // Remove ETFs with null/undefined critical data
      if (!etf.ticker || etf.totalReturn1Y == null || etf.compositeScore == null) {
        return false;
      }

      switch (filter) {
        case 'canada':
          return (etf.country || "").toUpperCase() === 'CA' || 
                 /TSX|NEO|TSXV/i.test(etf.exchange) || 
                 etf.ticker.endsWith('.TO');
        case 'usa':
          return (etf.country || "").toUpperCase() === 'US' || 
                 /NYSE|NASDAQ|BATS/i.test(etf.exchange) || 
                 (!etf.ticker.endsWith('.TO') && !etf.ticker.includes('.'));
        case 'high-yield':
          return (etf.yieldTTM || 0) >= 4; // 4%+ yield
        case 'all':
        default:
          return true;
      }
    }); // Show all ranked ETFs
  }, [ranked, filter]);

  // Show loading status based on progressive loading stage  
  useEffect(() => {
    const stage = progressiveData.loadingStage;
    if (stage !== 'complete') {
      const stageMessages = {
        tickers: 'Loading tickers and cached prices...',
        distributions: 'Loading distribution data...',
        'next-dist': 'Calculating next distributions...',
        yields: 'Loading yield data...',
        live: 'Updating with live prices...'
      };
      
      toast({
        title: "Loading data",
        description: stageMessages[stage as keyof typeof stageMessages] || 'Loading...',
      });
    }
  }, [progressiveData.loadingStage, toast]);

  // Cache ranking periodically
  useEffect(() => {
    if (ranked.length > 0) {
      const stateToCache = {
        weights,
        filter,
        cachedRanking: ranked,
        lastRankingUpdate: Date.now()
      };
      localStorage.setItem('ranking-state', JSON.stringify(stateToCache));
    }
  }, [ranked, weights, filter]);

  // Set document title
  useEffect(() => {
    document.title = 'ETF Ranking - HillJump';
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement || 
      (() => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
        return m as HTMLMetaElement;
      })();
    meta.setAttribute('content', 'HillJump quick reference: All high-yield dividend ETFs ranked by risk-aware total return.');
  }, []);

  // Check subscription status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [{ data: subscription }, { data: userRole }] = await Promise.all([
          supabase
            .from('subscribers')
            .select('subscribed, subscription_end')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .maybeSingle()
        ]);

        const isCurrentlySubscribed = subscription?.subscribed && 
          (!subscription.subscription_end || new Date(subscription.subscription_end) > new Date());
        
        setIsSubscribed(isCurrentlySubscribed);
        setIsAdmin(!!userRole);
      } catch (error) {
        console.error('Failed to check subscription status:', error);
      }
    };

    checkStatus();
  }, []);

  const filterOptions = [
    { value: 'all', label: 'All ETFs' },
    { value: 'canada', label: 'Canadian ETFs' },
    { value: 'usa', label: 'US ETFs' },
    { value: 'high-yield', label: 'High Yield (4%+)' }
  ];

  if (error) {
    return (
      <div className="container py-8">
        <Navigation />
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-destructive">Error Loading ETFs</h1>
          <p className="text-muted-foreground mt-2">
            {error instanceof Error ? error.message : 'Failed to load ETF data'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">ETF Ranking</h1>
            <p className="text-muted-foreground">
              {isLoading 
                ? 'Loading ETF data...' 
                : `${filtered.length} ETFs ranked by composite score`}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Select value={filter} onValueChange={(value: FilterType) => setFilter(value)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowDialog(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Scoring
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">Loading ETF data...</p>
          </div>
        ) : (
          <ETFTable 
            items={filtered} 
            live={progressiveData.livePrices} 
            distributions={progressiveData.lastDistributions} 
          />
        )}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Scoring Configuration</DialogTitle>
            </DialogHeader>
            
            <div className="py-4">
              <ScoringControls 
                onChange={setWeights}
              />
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Ranking;