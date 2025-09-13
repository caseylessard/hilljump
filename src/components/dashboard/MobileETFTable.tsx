import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoredETF } from "@/lib/scoring";
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import type { LivePrice } from "@/lib/live";
import yieldmaxLogo from "@/assets/logos/yieldmax.png";
import globalxLogo from "@/assets/logos/globalx.png";
import jpmorganLogo from "@/assets/logos/jpmorgan.png";
import amplifyLogo from "@/assets/logos/amplify.png";
import roundhillLogo from "@/assets/logos/roundhill.svg";

type Props = {
  items: ScoredETF[];
  live?: Record<string, LivePrice>;
  distributions?: Record<string, { amount: number; date: string; currency?: string }>;
  cachedDripData?: Record<string, any>;
  originalRanking?: ScoredETF[];
  cachedPrices?: Record<string, any>;
  frozenRankings?: Map<string, number>;
  persistentRanking?: Array<{ticker: string, rank: number, score: number, updatedAt: number}>;
  onSelectETF?: (etf: ScoredETF, rank: number) => void;
};

export const MobileETFTable = ({ 
  items, 
  live = {}, 
  distributions = {}, 
  cachedDripData = {}, 
  originalRanking = [],
  cachedPrices = {},
  frozenRankings = new Map(),
  persistentRanking = [],
  onSelectETF 
}: Props) => {
  // Create original ranking lookup for persistent rank numbers
  const originalRankMap = useMemo(() => {
    const map = new Map<string, number>();
    originalRanking.forEach((etf, index) => {
      map.set(etf.ticker, index + 1);
    });
    return map;
  }, [originalRanking]);

  const MANAGER_LOGOS: Record<string, string> = {
    "YIELDMAX": yieldmaxLogo,
    "GLOBAL X": globalxLogo,
    "JPMORGAN": jpmorganLogo,
    "AMPLIFY": amplifyLogo,
    "ROUNDHILL": roundhillLogo,
  };

  function getFundManager(etf: ScoredETF): string {
    if (etf.manager) return etf.manager;
    const n = (etf.name || "").toUpperCase();
    const c = (etf.category || "").toUpperCase();
    if (n.includes("YIELDMAX") || c.includes("YIELDMAX")) return "YieldMax";
    if (n.includes("GLOBAL X")) return "Global X";
    if (n.includes("JPMORGAN") || n.includes("J.P. MORGAN") || n.includes("JP MORGAN")) return "JPMorgan";
    if (n.includes("AMPLIFY")) return "Amplify";
    if (n.includes("ROUNDHILL")) return "Roundhill";
    return "ETF";
  }

  function getManagerLogo(etf: ScoredETF, manager?: string): string | undefined {
    const key = (etf.logoKey || manager || etf.manager || "").toUpperCase();
    return MANAGER_LOGOS[key];
  }

  const displayTicker = (ticker: string) => {
    return ticker.replace(/\.(TO|NE)$/, '');
  }

  const countryFlag = (etf: ScoredETF) => {
    const currency = etf.currency || 'USD';
    if (currency === 'CAD') return "🇨🇦";
    return "🇺🇸";
  }

  // DRIP data helpers - copy exact logic from OptimizedETFTable
  const getDripPercent = (ticker: string, period: '4w' | '13w' | '26w' | '52w'): number => {
    // Use cached DRIP if available, otherwise fallback to estimates
    
    // Check cached DRIP data first - try multiple potential formats
    const tickerData = cachedDripData?.[ticker];
    if (tickerData) {
      // Format 1: Direct percentage properties (PRIORITIZE FOR CONSISTENCY WITH UI)
      const percentKey = `drip${period}Percent`;
      if (typeof tickerData[percentKey] === 'number') {
        return tickerData[percentKey];
      }
      
      // Format 2: ticker.period structure with percentage
      if (tickerData[period] && typeof tickerData[period].percentage === 'number') {
        return tickerData[period].percentage;
      }
      
      // Format 3: Direct period object with growthPercent (FALLBACK ONLY)
      if (tickerData[period] && typeof tickerData[period].growthPercent === 'number') {
        return tickerData[period].growthPercent;
      }
      
      // Format 4: Nested period object with percentage
      if (tickerData[period] && typeof tickerData[period] === 'object') {
        const periodData = tickerData[period];
        if (typeof periodData.percentage === 'number') {
          return periodData.percentage;
        }
        if (typeof periodData.growthPercent === 'number') {
          return periodData.growthPercent;
        }
      }
    }
    
    // Fallback to live data
    const liveItem = live?.[ticker];
    let liveValue = 0;
    switch (period) {
      case "4w": liveValue = liveItem?.drip4wPercent ?? 0; break;
      case "13w": liveValue = liveItem?.drip13wPercent ?? 0; break;
      case "26w": liveValue = liveItem?.drip26wPercent ?? 0; break;
      case "52w": liveValue = liveItem?.drip52wPercent ?? 0; break;
    }
    
    if (liveValue !== 0) return liveValue;
    
    // Final fallback: estimate based on ETF fundamentals
    const etf = originalRanking?.find(e => e.ticker === ticker);
    if (etf) {
      // Simple estimation fallback - could import estimateQuickDrip if needed
      return 0;
    }
    
    return 0;
  };

  const getDripSum = (ticker: string): number => {
    return getDripPercent(ticker, "4w") + 
           getDripPercent(ticker, "13w") + 
           getDripPercent(ticker, "26w") + 
           getDripPercent(ticker, "52w");
  };

  // Position indicator component
  const PositionIndicator = ({ position }: { position?: number }) => {
    if (position === undefined) return null;
    
    const getPositionDetails = (pos: number) => {
      if (pos === 2) return { color: "bg-emerald-500", label: "Strong Buy", icon: ArrowUpRight };
      if (pos === 1) return { color: "bg-emerald-400", label: "Buy", icon: ArrowUpRight };
      if (pos === 0) return { color: "bg-yellow-500", label: "Hold", icon: Minus };
      if (pos === -1) return { color: "bg-red-400", label: "Sell", icon: ArrowDownRight };
      if (pos === -2) return { color: "bg-red-500", label: "Strong Sell", icon: ArrowDownRight };
      return { color: "bg-gray-400", label: "Unknown", icon: Minus };
    };
    
    const { color, label, icon: Icon } = getPositionDetails(position);
    
    return (
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <span className="text-xs font-medium">{label}</span>
        <Icon className="h-3 w-3" />
      </div>
    );
  };

  const RankingChangeIndicator = ({ ticker, currentRank }: { ticker: string; currentRank: number }) => {
    const storedRank = originalRankMap.get(ticker);
    if (!storedRank || storedRank === currentRank) return null;
    
    const change = storedRank - currentRank;
    if (Math.abs(change) <= 1 || Math.abs(change) > 20) return null;
    
    const movedUp = change > 0;
    const Icon = movedUp ? TrendingUp : TrendingDown;
    const colorClass = movedUp ? "text-emerald-600" : "text-red-600";
    
    return (
      <div className={`flex items-center gap-1 ${colorClass}`}>
        <Icon className="h-3 w-3" />
        <span className="text-xs">{Math.abs(change)}</span>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {items.map((etf, index) => {
        const rank = frozenRankings.get(etf.ticker) || index + 1;
        const manager = getFundManager(etf);
        const logoUrl = getManagerLogo(etf, manager);
        // Use live price to match table display
        const liveItem = live[etf.ticker];
        const price = liveItem?.price || Number(cachedPrices[etf.ticker] || etf.current_price || 0);
        const dripSum = getDripSum(etf.ticker);
        
        return (
          <Card 
            key={etf.ticker} 
            className="p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onSelectETF?.(etf, rank)}
          >
            <CardContent className="p-0 space-y-3">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-primary">#{rank}</span>
                    <RankingChangeIndicator ticker={etf.ticker} currentRank={index + 1} />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {logoUrl && (
                      <img 
                        src={logoUrl} 
                        alt={manager} 
                        className="w-6 h-6 rounded object-contain bg-white"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{displayTicker(etf.ticker)}</span>
                        <span className="text-sm">{countryFlag(etf)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-32">
                        {etf.strategyLabel || manager}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {(() => {
                    const liveItem = live[etf.ticker];
                    const price = liveItem?.price;
                    const cp = liveItem?.changePercent;
                    
                    if (price == null) return "—";
                    const up = (cp ?? 0) >= 0;
                    
                    // Get price update date from cached prices
                    const cachedPrice = cachedPrices[etf.ticker];
                    const priceDate = cachedPrice?.priceUpdatedAt;
                    const dateStr = priceDate ? format(new Date(priceDate), "MM/dd HH:mm") : "";
                    
                    return (
                      <div className="inline-flex flex-col items-end leading-tight">
                        <span className="font-semibold">${price.toFixed(2)}</span>
                        <div className="text-xs space-y-0">
                          {cp != null && (
                            <div className={up ? "text-emerald-600" : "text-red-600"}>
                              {up ? "+" : ""}{cp.toFixed(2)}%
                            </div>
                          )}
                          {dateStr && (
                            <div className="text-muted-foreground">
                              {dateStr}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="text-xs text-muted-foreground mt-1">
                    Score: {dripSum.toFixed(1)}
                  </div>
                </div>
              </div>

              {/* Position indicator */}
              <div className="flex justify-between items-center">
                <PositionIndicator position={etf.position} />
              </div>

              {/* DRIP performance grid */}
              <div className="grid grid-cols-4 gap-2 text-center">
                {(['4w', '13w', '26w', '52w'] as const).map((period) => {
                  const percent = getDripPercent(etf.ticker, period);
                  const isPositive = percent >= 0;
                  
                  return (
                    <div key={period} className="text-xs">
                      <div className="text-muted-foreground mb-1">{period}</div>
                      <div className={`font-medium ${
                        isPositive ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {percent.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};