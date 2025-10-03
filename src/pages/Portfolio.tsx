import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useBulkETFData, useBulkRSISignals } from "@/hooks/useBulkETFData";
import { useCachedPrices, useCachedDRIP, useCachedStoredScores } from "@/hooks/useCachedETFData";
import { useUserProfile } from "@/hooks/useUserProfile";
import { scoreETFsWithPrefs } from "@/lib/scoring";
import { buildAIPortfolio, type AIPortfolioETF, type WeightingMethod, type ScoreSource } from "@/lib/aiPortfolio";
import Navigation from "@/components/Navigation";
import { RefreshButton } from "@/components/RefreshButton";
import { TrendingUp, DollarSign, Globe, Building2, Zap, PieChart, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { PortfolioPositionCard } from "@/components/portfolio/PortfolioPositionCard";
import { PortfolioPositionCardCompact } from "@/components/portfolio/PortfolioPositionCardCompact";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useFrozenRankings } from "@/hooks/useFrozenRankings";
import { AIPortfolioAdvisor, type AIPortfolioAdvice, type PortfolioPosition } from "@/lib/portfolioAdvisor";
import Footer from "@/components/Footer";

const Portfolio = () => {
  const isMobile = useIsMobile();
  // Tablet detection: 768px - 900px (narrower range for better desktop table view)
  const isTablet = !isMobile && typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 900;
  // Get user profile for country-specific data
  const { profile } = useUserProfile();
  
  // AI Portfolio preferences
  const [preferences, setPreferences] = useState({
    topK: 10,                          // Number of ETFs to select
    scoreSource: "blend" as ScoreSource,   // trend, ret1y, or blend
    weighting: "return" as WeightingMethod, // equal, return, or risk_parity
    maxWeight: 0.25,                   // Maximum weight per ETF (25%)
    minWeight: 0.01,                   // Minimum weight per ETF (1%)
    minTradingDays: 60                // Minimum trading history required (reduced for better coverage)
  });

  const [portfolioSize, setPortfolioSize] = useState(10000); // $10k default
  const [selectedETFs, setSelectedETFs] = useState<AIPortfolioETF[]>([]);

  // Current portfolio management (for My Portfolio tab)
  const [currentPortfolio, setCurrentPortfolio] = useState<{ticker: string; shares: number; id?: string; dripScore?: number; dripRawScore?: number; rankingPosition?: number | null}[]>([]);
  const [newPosition, setNewPosition] = useState({ ticker: '', shares: '' });
  const [rebalanceRecommendations, setRebalanceRecommendations] = useState<any[]>([]);
  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const [editShares, setEditShares] = useState<number>(0);
  const [aiAdvice, setAiAdvice] = useState<AIPortfolioAdvice | null>(null);
  const [aiAdviceLoading, setAiAdviceLoading] = useState(false);
  const { toast } = useToast();

  // Load user's current portfolio positions
  const { data: portfolioPositions } = useQuery({
    queryKey: ['portfolioPositions', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('portfolio_positions')
        .select('*')
        .eq('user_id', profile.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id
  });

  // First get all available ETF tickers
  const { data: allTickersData = [] } = useQuery({
    queryKey: ["all-etf-tickers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etfs')
        .select('ticker')
        .eq('active', true);
      
      if (error) throw error;
      return data?.map(row => row.ticker) || [];
    },
    staleTime: 60 * 60 * 1000, // 1 hour cache
  });

  // Fetch bulk ETF data using same source as optimized table
  const { data: etfData = {}, isLoading: etfsLoading } = useBulkETFData(allTickersData);
  
  // Get cached prices and DRIP data (same as Rankings page)
  const { data: cachedPrices = {}, isLoading: pricesLoading } = useCachedPrices(allTickersData);
  const { data: cachedDripData = {}, isLoading: dripLoading } = useCachedDRIP(allTickersData);
  
  // Get stored scores using same system as Rankings page
  const { data: storedScores = {} } = useCachedStoredScores(
    allTickersData, 
    { return: 15, yield: 25, risk: 20 }, // Default weights
    profile?.country || 'CA'
  );
  
  // Get RSI signals for trend calculations (same as Rankings page)  
  const { data: rsiSignals = {} } = useBulkRSISignals(allTickersData.slice(0, 50)); // Limit to prevent timeout
  
  // Convert to ETF format compatible with AI portfolio - using real ranking scores
  const etfs = useMemo(() => {
    return Object.values(etfData).filter((etf: any) => {
      // Filter out ETFs with bad or test data
      if (!etf.ticker || ['TEST', 'DEMO', 'SAMPLE'].some(test => etf.ticker.includes(test))) {
        return false;
      }
      
      // Filter out ETFs with unrealistic yields (likely bad data) - max 150% annual yield
      // Note: Some covered call and high-yield strategies can legitimately have yields over 50%
      if (etf.yield_ttm && etf.yield_ttm > 150) {
        console.warn(`Filtering out ${etf.ticker} due to unrealistic yield: ${etf.yield_ttm}%`);
        return false;
      }
      
      // Filter out ETFs with missing essential data
      if (!etf.current_price || etf.current_price <= 0) {
        return false;
      }
      
      return true;
    }).map((etf: any) => {
      // Get the stored score for this ETF (same as Rankings page)
      const score = storedScores[etf.ticker];
      const rsiData = rsiSignals[etf.ticker];
      
      // Calculate trend score using same logic as Rankings page
      let combinedScore = 0;
      let dripPosition = 0;
      const tickerDripData = cachedDripData?.[etf.ticker];
      
      if (tickerDripData) {
        // Extract DRIP percentages (same logic as Rankings)
        const getDripPercent = (period: string) => {
          const percentKey = `drip${period}Percent`;
          if (typeof tickerDripData[percentKey] === 'number') {
            return tickerDripData[percentKey];
          }
          if (tickerDripData[period] && typeof tickerDripData[period].growthPercent === 'number') {
            return tickerDripData[period].growthPercent;
          }
          return 0;
        };
        
        const drip4w = getDripPercent('4w');
        const drip13w = getDripPercent('13w'); 
        const drip26w = getDripPercent('26w');
        const drip52w = getDripPercent('52w');
        
        // Convert to per-week returns for Ladder-Delta calculation
        const p4 = drip4w / 4;
        const p13 = drip13w / 13;
        const p26 = drip26w / 26;
        const p52 = drip52w / 52;
        
        // Calculate deltas (recent minus longer period)
        const d1 = p4 - p13;
        const d2 = p13 - p26;
        const d3 = p26 - p52;
        
        // Calculate Ladder-Delta Trend signal score
        const baseScore = 0.60 * p4 + 0.25 * p13 + 0.10 * p26 + 0.05 * p52;
        const positiveDeltaBonus = 1.00 * Math.max(0, d1) + 0.70 * Math.max(0, d2) + 0.50 * Math.max(0, d3);
        const negativeDeltaPenalty = 0.50 * (Math.max(0, -d1) + Math.max(0, -d2) + Math.max(0, -d3));
        
        const ladderDeltaSignalScore = baseScore + positiveDeltaBonus - negativeDeltaPenalty;
        
        // Buy/Sell conditions from scoring logic
        const condBuy = (ladderDeltaSignalScore > 0.005) && (d1 > 0) && (d2 > 0) && (d3 > 0);
        const condSell = (ladderDeltaSignalScore < 0) || (d1 <= 0);
        
        // Determine DRIP position: 1=Buy, 0=Hold, -1=Sell
        if (condBuy) {
          dripPosition = 1;
        } else if (condSell) {
          dripPosition = -1;
        } else {
          dripPosition = 0;
        }
      }
      
      // Calculate RSI position (30% weight)
      let rsiPosition = 0;
      if (rsiData) {
        const rsiValue = rsiData.rsi || 50;
        if (rsiValue < 30) {
          rsiPosition = 1; // Oversold = BUY
        } else if (rsiValue > 70) {
          rsiPosition = -1; // Overbought = SELL
        } else {
          rsiPosition = 0; // Neutral = HOLD
        }
      }
      
      // Calculate combined score: 70% DRIP + 30% RSI
      combinedScore = 0.7 * dripPosition + 0.3 * rsiPosition;
      
      // Calculate position based on combined score (same as Rankings page)
      let position: number;
      if (combinedScore >= 0.6) {
        position = 2; // Strong Buy
      } else if (combinedScore >= 0.2) {
        position = 1; // Buy
      } else if (combinedScore >= -0.2) {
        position = 0; // Hold
      } else if (combinedScore >= -0.6) {
        position = -1; // Sell
      } else {
        position = -2; // Strong Sell
      }
      
      return {
        ...etf,
        totalReturn1Y: etf.total_return_1y,
        yieldTTM: etf.yield_ttm,
        avgVolume: etf.avg_volume,
        expenseRatio: etf.expense_ratio,
        volatility1Y: etf.volatility_1y,
        maxDrawdown1Y: etf.max_drawdown_1y,
        current_price: etf.current_price,
        strategyLabel: etf.strategy_label,
        logoKey: etf.logo_key,
        dataSource: etf.data_source,
        polygonSupported: etf.polygon_supported,
        twelveSymbol: etf.twelve_symbol,
        eodhSymbol: etf.eodhd_symbol,
        // Add ranking score data - only composite_score is real, others are defaults
        compositeScore: score?.composite_score || 0,
        returnScore: score?.return_score || 0,
        yieldScore: score?.yield_score || 0,
        riskScore: score?.risk_score || 0,
        // Scale scores to 0-100 like AI Portfolio for consistency
        trendScore: Math.round(((position + 2) / 4) * 100), // Convert -2 to +2 range to 0-100
        ret1yScore: Math.round((score?.composite_score || 0)), // Use composite_score directly
        position: position // Real calculated position from DRIP+RSI (-2 to +2)
      };
    });
  }, [etfData, storedScores, cachedDripData, rsiSignals]);

  // Create ranked ETFs using frozen ranking system
  const isDripDataComplete = useMemo(() => {
    if (Object.keys(cachedDripData).length === 0) return false;
    
    // Check if we have data for at least 80% of items and all 4 periods
    const tickersWithCompleteData = etfs.filter(etf => {
      const tickerData = cachedDripData[etf.ticker];
      return tickerData && 
             tickerData.drip4wPercent !== undefined &&
             tickerData.drip13wPercent !== undefined &&
             tickerData.drip26wPercent !== undefined &&
             tickerData.drip52wPercent !== undefined;
    });
    
    return tickersWithCompleteData.length >= (etfs.length * 0.8);
  }, [cachedDripData, etfs]);
  
  // Use frozen rankings hook for stable position numbers
  const { frozenRankings, getRankForTicker, sortByFrozenRank } = useFrozenRankings({
    etfs,
    dripData: cachedDripData,
    storedScores,
    isDripDataComplete
  });

  // SEO setup
  useEffect(() => {
    document.title = "Portfolio Management — HillJump";
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement ||
      (() => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
        return m as HTMLMetaElement;
      })();
    meta.setAttribute('content', 'Manage your personal ETF portfolio and explore AI-driven recommendations for optimal diversification and performance.');
  }, []);

  // State to hold the resolved portfolio results
  const [resolvedPortfolio, setResolvedPortfolio] = useState<AIPortfolioETF[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // Effect to build portfolio - with stable dependencies to prevent loops
  useEffect(() => {
    let isCancelled = false;
    
    const buildPortfolio = async () => {
      if (etfs.length === 0 || !cachedPrices || Object.keys(cachedPrices).length === 0) return;
      
      setPortfolioLoading(true);
      try {
        // Filter out low-quality ETFs before building portfolio
        const qualityETFs = etfs.filter(etf => {
          // Exclude known poor performers and test tickers
          const lowQualityTickers = ['FIAT', 'TEST', 'DEMO'];
          if (lowQualityTickers.includes(etf.ticker)) return false;
          
          // Must have yield data
          if (!etf.yieldTTM || etf.yieldTTM <= 0) return false;
          
          // Must have current price
          if (!etf.current_price || etf.current_price <= 0) return false;
          
          // Must have reasonable yield (not extreme outliers)
          if (etf.yieldTTM > 100) return false; // Over 100% yield is suspicious
          
          return true;
        });
        
        console.log(`🔍 Filtered ${etfs.length} ETFs down to ${qualityETFs.length} quality ETFs`);
        
        // Pass DRIP data to the AI portfolio builder
        const result = await buildAIPortfolio(qualityETFs, cachedPrices || {}, {
          topK: preferences.topK,
          minTradingDays: preferences.minTradingDays,
          scoreSource: preferences.scoreSource,
          weighting: preferences.weighting,
          maxWeight: preferences.maxWeight,
          minWeight: preferences.minWeight,
          capital: portfolioSize,
          roundShares: true
        }, cachedDripData || {});
        
        if (!isCancelled) {
          setResolvedPortfolio(result);
        }
      } catch (error) {
        console.error('Error building AI portfolio:', error);
        if (!isCancelled) {
          setResolvedPortfolio([]);
        }
      } finally {
        if (!isCancelled) {
          setPortfolioLoading(false);
        }
      }
    };

    buildPortfolio();
    
    return () => {
      isCancelled = true;
    };
  }, [etfs, cachedPrices, cachedDripData, preferences.topK, preferences.scoreSource, preferences.weighting, preferences.maxWeight, preferences.minWeight, preferences.minTradingDays, portfolioSize]);

  // Get actual ranking positions for portfolio tickers using frozen rankings
  const getETFRankingPosition = (ticker: string): number | null => {
    return getRankForTicker(ticker);
  };
  const calculateDRIPScore = (ticker: string): { score: number; rawScore: number } => {
    const tickerDripData = cachedDripData?.[ticker];
    if (!tickerDripData) return { score: 0, rawScore: 0 };

    // Extract DRIP percentages (same logic as Rankings)
    const getDripPercent = (period: string) => {
      const percentKey = `drip${period}Percent`;
      if (typeof tickerDripData[percentKey] === 'number') {
        return tickerDripData[percentKey];
      }
      if (tickerDripData[period] && typeof tickerDripData[period].growthPercent === 'number') {
        return tickerDripData[period].growthPercent;
      }
      return 0;
    };
    
    const drip4w = getDripPercent('4w');
    const drip13w = getDripPercent('13w'); 
    const drip26w = getDripPercent('26w');
    const drip52w = getDripPercent('52w');
    
    // Convert to per-week returns for Ladder-Delta calculation
    const p4 = drip4w / 4;
    const p13 = drip13w / 13;
    const p26 = drip26w / 26;
    const p52 = drip52w / 52;
    
    // Calculate deltas (recent minus longer period)
    const d1 = p4 - p13;
    const d2 = p13 - p26;
    const d3 = p26 - p52;
    
    // Calculate Ladder-Delta Trend signal score
    const baseScore = 0.60 * p4 + 0.25 * p13 + 0.10 * p26 + 0.05 * p52;
    const positiveDeltaBonus = 1.00 * Math.max(0, d1) + 0.70 * Math.max(0, d2) + 0.50 * Math.max(0, d3);
    const negativeDeltaPenalty = 0.50 * (Math.max(0, -d1) + Math.max(0, -d2) + Math.max(0, -d3));
    
    const ladderDeltaSignalScore = baseScore + positiveDeltaBonus - negativeDeltaPenalty;
    
    // Buy/Sell conditions from scoring logic
    const condBuy = (ladderDeltaSignalScore > 0.005) && (d1 > 0) && (d2 > 0) && (d3 > 0);
    const condSell = (ladderDeltaSignalScore < 0) || (d1 <= 0);
    
    // Return DRIP position: 1=Buy, 0=Hold, -1=Sell and raw score
    if (condBuy) {
      return { score: 1, rawScore: ladderDeltaSignalScore };
    } else if (condSell) {
      return { score: -1, rawScore: ladderDeltaSignalScore };
    } else {
      return { score: 0, rawScore: ladderDeltaSignalScore };
    }
  };

  // Update current portfolio when data loads and add DRIP scores + ranking positions
  const portfolioWithDRIPScores = useMemo(() => {
    if (!portfolioPositions || !cachedDripData || frozenRankings.size === 0) return [];
    
    const positions = portfolioPositions.map(p => {
      const dripData = calculateDRIPScore(p.ticker);
      const rankingPosition = getETFRankingPosition(p.ticker);
      return {
        ticker: p.ticker,
        shares: Number(p.shares),
        id: p.id,
        dripScore: dripData.score,
        dripRawScore: dripData.rawScore,
        rankingPosition
      };
    });
    
    // Sort by frozen ranking position using the hook's helper
    return sortByFrozenRank(positions);
  }, [portfolioPositions, cachedDripData, frozenRankings, sortByFrozenRank]);

  // Update current portfolio when data loads
  useEffect(() => {
    setCurrentPortfolio(portfolioWithDRIPScores);
    
    // Generate AI advice when portfolio data is ready AND DRIP data is complete AND rankings are loaded
    if (portfolioWithDRIPScores.length > 0 && cachedPrices && Object.keys(cachedPrices).length > 0 && !aiAdviceLoading && isDripDataComplete && frozenRankings.size > 0) {
      generateAIAdvice(portfolioWithDRIPScores);
    }
  }, [portfolioWithDRIPScores.length, Object.keys(cachedPrices).length, aiAdviceLoading, isDripDataComplete]);

  // Portfolio management functions
  const addOrUpdatePosition = async () => {
    if (!profile?.id) {
      toast({ title: "HillJumpers Only", description: "Sign in to manage your portfolio" });
      return;
    }
    if (!newPosition.ticker || !newPosition.shares) return;
    
    const shares = Number(newPosition.shares);
    if (shares <= 0 || shares > 1000000 || !isFinite(shares)) {
      toast({ title: "Invalid shares", description: "Please enter a valid number of shares (0.01 - 1,000,000)" });
      return;
    }

    // Sanitize ticker input
    const sanitizedTicker = newPosition.ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '').substring(0, 10);
    if (!sanitizedTicker || sanitizedTicker.length < 1) {
      toast({ title: "Invalid ticker", description: "Please enter a valid ticker symbol" });
      return;
    }

    try {
      const { error } = await supabase
        .from('portfolio_positions')
        .upsert({
          user_id: profile.id,
          ticker: sanitizedTicker,
          shares
        }, { onConflict: "user_id,ticker" });

      if (error) throw error;
      
      setNewPosition({ ticker: '', shares: '' });
      
      // Refresh positions - they will be automatically sorted by DRIP score via the memo
      window.location.reload(); // Simple refresh to re-trigger data loading
      
      toast({ title: "Position updated successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update position" });
    }
  };

  const removePosition = async (position: {ticker: string; shares: number; id?: string}) => {
    if (!profile?.id || !position.id) return;

    try {
      const { error } = await supabase
        .from('portfolio_positions')
        .delete()
        .eq('id', position.id);
      if (error) throw error;

      setCurrentPortfolio(prev => prev.filter(p => p.id !== position.id));
      toast({ title: "Position removed", description: `Removed ${position.ticker}` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove position" });
    }
  };

  const startEdit = (position: {ticker: string; shares: number; id?: string}) => {
    if (!position.id) return;
    setEditingPosition(position.id);
    setEditShares(Number(position.shares));
  };

  const cancelEdit = () => {
    setEditingPosition(null);
    setEditShares(0);
  };

  const saveEdit = async (id: string, ticker: string) => {
    if (!profile?.id) return;
    
    if (editShares <= 0 || editShares > 1000000 || !isFinite(editShares)) {
      toast({ title: "Invalid shares", description: "Please enter a valid number of shares (0.01 - 1,000,000)" });
      return;
    }

    try {
      const { error } = await supabase
        .from('portfolio_positions')
        .update({ shares: editShares })
        .eq('id', id);
      
      if (error) throw error;
      
      // Refresh to maintain DRIP score sorting
      window.location.reload(); // Simple refresh to re-trigger data loading and sorting
      
      setEditingPosition(null);
      setEditShares(0);
      toast({ title: "Position updated successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update position" });
    }
  };

  // AI Portfolio Advisor
  const generateAIAdvice = async (positions: typeof portfolioWithDRIPScores) => {
    if (positions.length === 0 || aiAdviceLoading || frozenRankings.size === 0) return;
    
    console.log('🤖 Generating AI advice for', positions.length, 'positions with', frozenRankings.size, 'frozen rankings');
    setAiAdviceLoading(true);
    
    try {
      const aiAdvisor = new AIPortfolioAdvisor(etfData, cachedPrices, frozenRankings, getRankForTicker, etfs);
      
      // Convert portfolio positions to AI advisor format
      const portfolioPositions: PortfolioPosition[] = positions.map(p => {
        const price = cachedPrices?.[p.ticker]?.price || 0;
        const etfDetails = etfData[p.ticker];
        
        return {
          ticker: p.ticker,
          shares: p.shares,
          currentValue: p.shares * price,
          currentPrice: price,
          dripScore: p.dripScore || 0,
          dripRawScore: p.dripRawScore || 0,
          rankingPosition: p.rankingPosition,
          yieldTTM: etfDetails?.yield_ttm,
          strategy: etfDetails?.strategy_label,
          riskScore: etfDetails?.risk_score || 50
        };
      }).filter(p => p.currentPrice > 0); // Filter out positions without prices
      
      console.log('🔍 Analyzing', portfolioPositions.length, 'valid positions');
      
      if (portfolioPositions.length === 0) {
        console.warn('⚠️ No valid positions to analyze');
        setAiAdvice(null);
        return;
      }
      
      const advice = await aiAdvisor.analyzePortfolio(portfolioPositions);
      console.log('✅ AI advice generated:', advice);
      setAiAdvice(advice);
    } catch (error) {
      console.error('❌ Error generating AI advice:', error);
      setAiAdvice(null);
    } finally {
      setAiAdviceLoading(false);
    }
  };

  // Create combined portfolio with recommendations
  const getCombinedPortfolio = () => {
    if (!aiAdvice) return currentPortfolio.map(p => ({ ...p, isRecommendation: false }));

    // Convert new ETF recommendations to portfolio format
    const recommendedPositions = aiAdvice.newETFRecommendations.map(rec => {
      const etfDetails = etfData[rec.ticker];
      
      return {
        ticker: rec.ticker,
        name: etfDetails?.name || rec.ticker,
        shares: rec.targetShares,
        currentValue: rec.targetValue,
        currentPrice: cachedPrices?.[rec.ticker]?.price || 0,
        dripScore: 0, // Will be calculated when displayed
        dripRawScore: 0, // Will be calculated when displayed
        rankingPosition: rec.rankingPosition,
        yieldTTM: rec.yieldTTM,
        strategy: rec.strategy,
        isRecommendation: true
      };
    });

    // Add isRecommendation flag to existing positions
    const existingWithFlag = currentPortfolio.map(p => ({ ...p, isRecommendation: false }));

    // Combine existing and recommended positions
    const combined = [...existingWithFlag, ...recommendedPositions];
    
    // Sort by ranking position (nulls last)
    return combined.sort((a, b) => {
      const aRank = a.rankingPosition || 999;
      const bRank = b.rankingPosition || 999;
      return aRank - bRank;
    });
  };

  const combinedPortfolio = getCombinedPortfolio();
  const totalValueWithRecommendations = combinedPortfolio.reduce((sum, p) => {
    const price = cachedPrices?.[p.ticker]?.price || 0;
    if (p.isRecommendation) {
      return sum + (p as any).currentValue;
    } else {
      return sum + (p.shares * price);
    }
  }, 0);

  // Portfolio allocations are now calculated within the AI portfolio builder
  const totalAllocation = resolvedPortfolio.reduce((sum, item) => sum + (item.weight * 100), 0);
  const totalSpent = resolvedPortfolio.reduce((sum, item) => sum + (item.allocRounded || 0), 0);
  const cashLeft = portfolioSize - totalSpent;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <header className="container py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Portfolio</h1>
          </div>
          <RefreshButton />
        </div>
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
          Manage your personal ETF portfolio and explore AI-driven recommendations for optimal diversification.
        </p>
      </header>

      <main className="container pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8">
        <Tabs defaultValue="my-portfolio" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my-portfolio">My Portfolio</TabsTrigger>
            <TabsTrigger value="ai-portfolio">AI Portfolio</TabsTrigger>
          </TabsList>
          
          <TabsContent value="my-portfolio" className="mt-6">
            <div className="space-y-6">
              {/* Portfolio Management Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                    <div>
                      <label htmlFor="ticker" className="block text-sm font-medium mb-1">
                        Ticker (e.g., AAPL)
                      </label>
                      <Input
                        id="ticker"
                        placeholder={profile?.id ? "AAPL" : "***"}
                        value={profile?.id ? newPosition.ticker : ""}
                        onChange={(e) => setNewPosition(prev => ({ ...prev, ticker: e.target.value }))}
                        disabled={!profile?.id}
                      />
                    </div>
                    <div>
                      <label htmlFor="shares" className="block text-sm font-medium mb-1">
                        Shares
                      </label>
                      <Input
                        id="shares"
                        type="number"
                        placeholder={profile?.id ? "100" : "***"}
                        value={profile?.id ? newPosition.shares : ""}
                        onChange={(e) => setNewPosition(prev => ({ ...prev, shares: e.target.value }))}
                        disabled={!profile?.id}
                      />
                    </div>
                    <Button onClick={addOrUpdatePosition} disabled={!profile?.id}>
                      <Plus className="w-4 h-4 mr-2" />
                      {profile?.id ? "Add / Update" : "***"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Portfolio Positions Table */}
              {combinedPortfolio.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Portfolio Positions {aiAdvice && aiAdvice.newETFRecommendations.length > 0 && <span className="text-sm font-normal text-muted-foreground">(including AI recommendations)</span>}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isMobile ? (
                      /* Mobile Card View */
                      <div className="space-y-4">
                        {combinedPortfolio.map((position, index) => {
                          const price = cachedPrices?.[position.ticker]?.price || 0;
                          const isEditing = !position.isRecommendation && editingPosition === (position as any).id;
                          const dripData = position.isRecommendation ? 
                            { score: position.dripScore || 0, rawScore: position.dripRawScore || 0 } :
                            (position.dripScore !== undefined ? 
                              { score: position.dripScore, rawScore: position.dripRawScore } : 
                              calculateDRIPScore(position.ticker));
                          const actualRank = position.rankingPosition;
                          const aiRec = !position.isRecommendation ? aiAdvice?.targetRecommendations.find(rec => rec.ticker === position.ticker) : null;
                          
                          const getDRIPDisplay = (score: number) => {
                            if (score === 1) return { text: 'BUY', variant: 'default' as const, className: 'bg-green-600 text-white' };
                            if (score === -1) return { text: 'SELL', variant: 'destructive' as const, className: 'bg-red-600 text-white' };
                            return { text: 'HOLD', variant: 'secondary' as const, className: 'bg-yellow-600 text-white' };
                          };
                          
                          const dripDisplay = getDRIPDisplay(dripData.score);
                          
                          return (
                            <PortfolioPositionCard
                              key={position.isRecommendation ? `rec-${position.ticker}` : (position as any).id || index}
                              position={position}
                              index={index}
                              price={price}
                              isEditing={isEditing}
                              editShares={editShares}
                              dripDisplay={dripDisplay}
                              dripRawScore={dripData.rawScore}
                              actualRank={actualRank}
                              aiRec={aiRec}
                              aiAdviceLoading={aiAdviceLoading}
                              profileId={profile?.id}
                              onStartEdit={() => startEdit(position as any)}
                              onSaveEdit={() => (position as any).id && saveEdit((position as any).id, position.ticker)}
                              onCancelEdit={cancelEdit}
                              onRemove={() => removePosition(position as any)}
                              onSharesChange={setEditShares}
                            />
                          );
                        })}
                      </div>
                    ) : isTablet ? (
                      /* Tablet Compact Card View */
                      <div className="grid grid-cols-2 gap-3">
                        {combinedPortfolio.map((position, index) => {
                          const price = cachedPrices?.[position.ticker]?.price || 0;
                          const isEditing = !position.isRecommendation && editingPosition === (position as any).id;
                          const dripData = position.isRecommendation ? 
                            { score: position.dripScore || 0, rawScore: position.dripRawScore || 0 } :
                            (position.dripScore !== undefined ? 
                              { score: position.dripScore, rawScore: position.dripRawScore } : 
                              calculateDRIPScore(position.ticker));
                          const actualRank = position.rankingPosition;
                          const aiRec = !position.isRecommendation ? aiAdvice?.targetRecommendations.find(rec => rec.ticker === position.ticker) : null;
                          
                          const getDRIPDisplay = (score: number) => {
                            if (score === 1) return { text: 'BUY', variant: 'default' as const, className: 'bg-green-600 text-white' };
                            if (score === -1) return { text: 'SELL', variant: 'destructive' as const, className: 'bg-red-600 text-white' };
                            return { text: 'HOLD', variant: 'secondary' as const, className: 'bg-yellow-600 text-white' };
                          };
                          
                          const dripDisplay = getDRIPDisplay(dripData.score);
                          
                          return (
                            <PortfolioPositionCardCompact
                              key={position.isRecommendation ? `rec-${position.ticker}` : (position as any).id || index}
                              position={position}
                              index={index}
                              price={price}
                              isEditing={isEditing}
                              editShares={editShares}
                              dripDisplay={dripDisplay}
                              dripRawScore={dripData.rawScore}
                              actualRank={actualRank}
                              aiRec={aiRec}
                              aiAdviceLoading={aiAdviceLoading}
                              profileId={profile?.id}
                              onStartEdit={() => startEdit(position as any)}
                              onSaveEdit={() => (position as any).id && saveEdit((position as any).id, position.ticker)}
                              onCancelEdit={cancelEdit}
                              onRemove={() => removePosition(position as any)}
                              onSharesChange={setEditShares}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      /* Desktop Table View */
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Rank</TableHead>
                              <TableHead>DRIP Signal</TableHead>
                              <TableHead>Ticker</TableHead>
                              <TableHead>Shares</TableHead>
                              <TableHead>Price</TableHead>
                              <TableHead>Current Value</TableHead>
                              <TableHead className="text-center">AI Target Value</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {combinedPortfolio.map((position, index) => {
                              const price = cachedPrices?.[position.ticker]?.price || 0;
                              const value = position.isRecommendation ? (position as any).currentValue : position.shares * price;
                              const shares = position.isRecommendation ? (position as any).shares : position.shares;
                              const isEditing = !position.isRecommendation && editingPosition === (position as any).id;
                              const dripData = position.isRecommendation ? 
                                { score: position.dripScore || 0, rawScore: position.dripRawScore || 0 } :
                                (position.dripScore !== undefined ? 
                                  { score: position.dripScore, rawScore: position.dripRawScore } : 
                                  calculateDRIPScore(position.ticker));
                              const actualRank = position.rankingPosition;
                              
                               // Get AI recommendation for this position (only for existing positions)
                               const aiRec = !position.isRecommendation ? aiAdvice?.targetRecommendations.find(rec => rec.ticker === position.ticker) : null;
                              
                              // DRIP score styling and text
                              const getDRIPDisplay = (score: number) => {
                                if (score === 1) return { text: 'BUY', variant: 'default' as const, className: 'bg-green-600 text-white' };
                                if (score === -1) return { text: 'SELL', variant: 'destructive' as const, className: 'bg-red-600 text-white' };
                                return { text: 'HOLD', variant: 'secondary' as const, className: 'bg-yellow-600 text-white' };
                              };
                              
                              const dripDisplay = getDRIPDisplay(dripData.score);
                              
                               return (
                                 <TableRow 
                                   key={position.isRecommendation ? `rec-${position.ticker}` : (position as any).id || index}
                                   className={position.isRecommendation ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/50' : ''}
                                 >
                                   <TableCell className="font-bold text-primary">
                                     {actualRank ? `#${actualRank}` : 'N/A'}
                                   </TableCell>
                                   <TableCell>
                                     <div className="flex flex-col gap-1">
                                       <Badge className={dripDisplay.className}>
                                         {dripDisplay.text}
                                       </Badge>
                                       <span className="text-xs text-muted-foreground">
                                         {dripData.rawScore.toFixed(4)}
                                       </span>
                                     </div>
                                   </TableCell>
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-2">
                                        {profile?.id ? position.ticker : (position.isRecommendation ? "SIGN IN" : position.ticker)}
                                        {position.isRecommendation && (
                                          <Badge variant="outline" className="text-xs border-blue-500 text-blue-600 dark:text-blue-400">
                                            {profile?.id ? "AI Suggestion" : "***"}
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                   <TableCell>
                                     {isEditing && !position.isRecommendation ? (
                                       <Input
                                         type="number"
                                         value={editShares}
                                         onChange={(e) => setEditShares(Number(e.target.value))}
                                         className="w-20"
                                       />
                                     ) : (
                                       shares.toLocaleString()
                                     )}
                                   </TableCell>
                                   <TableCell>${price.toFixed(2)}</TableCell>
                                   <TableCell>${value.toLocaleString()}</TableCell>
                                   <TableCell className="text-center">
                                      {position.isRecommendation ? (
                                        <div className="space-y-1">
                                          <div className="font-medium text-blue-600 dark:text-blue-400">
                                            💡 {profile?.id ? `$${value.toLocaleString()}` : "***"}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {profile?.id ? "New position" : "***"}
                                          </div>
                                          <Badge variant="outline" className="text-xs border-blue-500">
                                            {profile?.id ? "ADD" : "***"}
                                          </Badge>
                                        </div>
                                     ) : aiAdviceLoading ? (
                                       <div className="text-muted-foreground text-sm">Loading...</div>
                                     ) : aiRec ? (
                                       <div className="space-y-1">
                                         <div className="font-medium">
                                           {aiRec.action === 'INCREASE' && '↗️'}
                                           {aiRec.action === 'DECREASE' && '↘️'}
                                           {aiRec.action === 'SELL' && '❌'}
                                           {aiRec.action === 'HOLD' && '➡️'} ${aiRec.targetValue.toLocaleString()}
                                         </div>
                                         <div className="text-xs text-muted-foreground">
                                           {aiRec.targetShares} shares
                                         </div>
                                          <Badge 
                                            variant={aiRec.action === 'INCREASE' ? 'default' : 
                                                    aiRec.action === 'DECREASE' || aiRec.action === 'SELL' ? 'destructive' : 'outline'}
                                            className={`text-xs ${
                                              aiRec.action === 'INCREASE' ? 'bg-green-600 text-white' :
                                              aiRec.action === 'DECREASE' || aiRec.action === 'SELL' ? 'bg-red-600 text-white' : ''
                                            }`}
                                          >
                                           {aiRec.action}
                                         </Badge>
                                         <div className="text-xs text-muted-foreground mt-1" title={aiRec.reason}>
                                           {aiRec.confidence}% confidence
                                         </div>
                                       </div>
                                     ) : (
                                       <div className="text-muted-foreground text-sm">-</div>
                                     )}
                                   </TableCell>
                                   <TableCell>
                                      {position.isRecommendation ? (
                                        <div className="text-sm text-muted-foreground">
                                          {profile?.id ? "AI Recommendation" : "***"}
                                        </div>
                                     ) : (
                                       <div className="flex gap-2">
                                         {isEditing ? (
                                           <>
                                             <Button
                                               size="sm"
                                               onClick={() => (position as any).id && saveEdit((position as any).id, position.ticker)}
                                             >
                                               Save
                                             </Button>
                                             <Button
                                               size="sm"
                                               variant="outline"
                                               onClick={cancelEdit}
                                             >
                                               Cancel
                                             </Button>
                                           </>
                                         ) : (
                                           <>
                                             <Button
                                               size="sm"
                                               variant="outline"
                                               onClick={() => startEdit(position as any)}
                                             >
                                               Edit
                                             </Button>
                                             <Button
                                               size="sm"
                                               variant="destructive"
                                               onClick={() => removePosition(position as any)}
                                             >
                                               Delete
                                             </Button>
                                           </>
                                         )}
                                       </div>
                                     )}
                                   </TableCell>
                                 </TableRow>
                                );
                             })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                      <div className="mt-4 pt-4 border-t space-y-2">
                        <div className="font-semibold text-lg flex justify-between">
                          <span>Total Portfolio Value:</span>
                          <span>
                            ${totalValueWithRecommendations.toLocaleString()}
                          </span>
                        </div>
                        {aiAdvice && aiAdvice.newETFRecommendations.length > 0 && (
                          <div className="text-sm text-muted-foreground">
                            Includes ${aiAdvice.newETFRecommendations.reduce((sum, rec) => sum + rec.targetValue, 0).toLocaleString()} in AI recommendations
                          </div>
                        )}
                        
                        {aiAdvice && (
                          <div className="bg-muted/30 p-4 rounded-lg">
                            <h4 className="font-medium mb-2">Portfolio Analysis</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <div className="text-muted-foreground">Diversification</div>
                                <div className="font-medium">{aiAdvice.portfolioAnalysis.diversificationScore}/100</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Risk Level</div>
                                <div className="font-medium">{aiAdvice.portfolioAnalysis.riskScore}/100</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Yield Balance</div>
                                <div className="font-medium">{aiAdvice.portfolioAnalysis.yieldBalance}/100</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Trend Alignment</div>
                                <div className="font-medium">{aiAdvice.portfolioAnalysis.trendAlignment}/100</div>
                              </div>
                            </div>
                            
                            {aiAdvice.portfolioAnalysis.recommendations.length > 0 && (
                              <div className="mt-3">
                                <div className="text-muted-foreground text-sm mb-1">AI Recommendations:</div>
                                <ul className="text-sm space-y-1">
                                  {aiAdvice.portfolioAnalysis.recommendations.map((rec, i) => (
                                    <li key={i} className="text-muted-foreground">• {rec}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                  </CardContent>
                </Card>
              )}

              {combinedPortfolio.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground text-lg">No positions added yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Add your current holdings above to get started
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="ai-portfolio" className="mt-6">
            <div className="grid lg:grid-cols-[1fr,2fr] gap-6 lg:gap-8">
              {/* Controls Sidebar */}
              <div className="space-y-4 sm:space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      AI Portfolio Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Portfolio Size */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Portfolio Size</label>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <input
                          type="number"
                          value={portfolioSize}
                          onChange={(e) => setPortfolioSize(Number(e.target.value))}
                          className="flex-1 px-3 py-2 border rounded-md"
                          min="1000"
                          step="1000"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Top K ETFs */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium">Number of ETFs</label>
                        <Badge variant="secondary">{preferences.topK}</Badge>
                      </div>
                      <Slider
                        value={[preferences.topK]}
                        onValueChange={([value]) => setPreferences(p => ({ ...p, topK: value }))}
                        min={3}
                        max={20}
                        step={1}
                        className="mb-2"
                      />
                      <p className="text-xs text-muted-foreground">Select top-performing ETFs for your portfolio</p>
                    </div>

                    {/* Score Source */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Scoring Method</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['trend', 'ret1y', 'pastperf', 'blend'] as ScoreSource[]).map(method => (
                          <Button
                            key={method}
                            variant={preferences.scoreSource === method ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPreferences(p => ({ ...p, scoreSource: method }))}
                          >
                            {method === 'trend' ? 'Trend' : 
                             method === 'ret1y' ? '1Y Return' : 
                             method === 'pastperf' ? 'Past Perf' :
                             'Blend'}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Trend: Ladder-Delta momentum • 1Y Return: Annual performance • Past Perf: Non-overlapping rungs • Blend: 70% trend + 30% return
                      </p>
                    </div>

                    {/* Weighting Method */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Weighting Method</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['equal', 'return', 'risk_parity'] as WeightingMethod[]).map(method => (
                          <Button
                            key={method}
                            variant={preferences.weighting === method ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPreferences(p => ({ ...p, weighting: method }))}
                          >
                            {method === 'equal' ? 'Equal' : method === 'return' ? 'Return' : 'Risk'}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Equal: 1/K weight • Return: Weight by performance • Risk: Inverse volatility
                      </p>
                    </div>

                    {/* Max Weight */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium">Max Weight per ETF</label>
                        <Badge variant="secondary">{(preferences.maxWeight * 100).toFixed(0)}%</Badge>
                      </div>
                      <Slider
                        value={[preferences.maxWeight * 100]}
                        onValueChange={([value]) => setPreferences(p => ({ ...p, maxWeight: value / 100 }))}
                        min={10}
                        max={50}
                        step={5}
                        className="mb-2"
                      />
                      <p className="text-xs text-muted-foreground">Maximum allocation to any single ETF</p>
                    </div>

                    {/* Min Weight */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium">Min Weight per ETF</label>
                        <Badge variant="secondary">{(preferences.minWeight * 100).toFixed(1)}%</Badge>
                      </div>
                      <Slider
                        value={[preferences.minWeight * 100]}
                        onValueChange={([value]) => setPreferences(p => ({ ...p, minWeight: value / 100 }))}
                        min={0.5}
                        max={5}
                        step={0.1}
                        className="mb-2"
                      />
                      <p className="text-xs text-muted-foreground">Minimum allocation to ensure diversification</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* AI Portfolio Results */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Portfolio Recommendations</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {resolvedPortfolio.length} positions • ${portfolioSize.toLocaleString()} • ${totalSpent.toLocaleString()} allocated • ${cashLeft.toLocaleString()} cash
                    </p>
                  </CardHeader>
                  <CardContent>
                    {etfsLoading || portfolioLoading || pricesLoading || dripLoading ? (
                      <LoadingScreen message="Building AI portfolio..." />
                    ) : resolvedPortfolio.length > 0 ? (
                      <div className="space-y-4">
                         {resolvedPortfolio.map((etf, index) => (
                           <div key={etf.ticker} className="flex items-center justify-between p-4 border rounded-lg">
                             <div className="flex-1">
                               <div className="flex items-center gap-2 mb-1">
                                 <Badge variant="outline">{profile?.id ? etf.ticker : "SIGN IN"}</Badge>
                                 <span className="font-medium text-sm">{profile?.id ? etf.name : "***"}</span>
                                 {etf.badge && profile?.id && (
                                   <Badge 
                                     variant="secondary" 
                                     className={`text-xs ${
                                       etf.badgeColor === 'green' ? 'bg-emerald-100 text-emerald-800' :
                                       etf.badgeColor === 'red' ? 'bg-red-100 text-red-800' :
                                       etf.badgeColor === 'orange' ? 'bg-orange-100 text-orange-800' :
                                       'bg-yellow-100 text-yellow-800'
                                     }`}
                                   >
                                     {etf.badge}
                                  </Badge>
                                )}
                              </div>
                                <p className="text-sm text-muted-foreground">
                                  {(etf.weight * 100).toFixed(1)}% • ${(etf.allocationDollar || 0).toFixed(0)} • {etf.shares || 0} shares @ ${etf.lastPrice.toFixed(2)}
                                </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No ETFs found matching your criteria</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Try adjusting your portfolio settings or wait for data to load
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default Portfolio;