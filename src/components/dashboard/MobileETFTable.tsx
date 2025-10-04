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

const hilljumpLogo = "/lovable-uploads/hilljump.png";

type Props = {
  items: ScoredETF[];
  live?: Record<string, LivePrice>;
  distributions?: Record<string, { amount: number; date: string; currency?: string }>;
  dividendPredictions?: Record<string, { amount: number; date: string }>;
  cachedDripData?: Record<string, any>;
  originalRanking?: ScoredETF[];
  cachedPrices?: Record<string, any>;
  frozenRankings?: Map<string, number>;
  persistentRanking?: Array<{ticker: string, rank: number, score: number, updatedAt: number}>;
  onSelectETF?: (etf: ScoredETF, rank: number) => void;
  previewMode?: boolean;
};

export const MobileETFTable = ({ 
  items, 
  live = {}, 
  distributions = {}, 
  dividendPredictions = {},
  cachedDripData = {}, 
  originalRanking = [],
  cachedPrices = {},
  frozenRankings = new Map(),
  persistentRanking = [],
  onSelectETF,
  previewMode = false
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
    if (position === undefined || position === null) return <span className="text-xs text-muted-foreground">Unknown</span>;
    
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
    <div className="space-y-3 sm:space-y-4 lg:space-y-3 etf-table">
      {items.map((etf, index) => {
        const rank = frozenRankings.get(etf.ticker) || index + 1;
        const manager = getFundManager(etf);
        const logoUrl = getManagerLogo(etf, manager);
        // Use live price to match table display
        const liveItem = live[etf.ticker];
        const price = liveItem?.price || Number(cachedPrices[etf.ticker] || etf.current_price || 0);
        const dripSum = getDripSum(etf.ticker);
        
        // Preview mode: replace sensitive data with placeholders for ranks 1-3 and 7+
        const shouldObfuscate = previewMode && (index <= 2 || index >= 6);
        
        // Create obfuscated data
        const displayTicker = shouldObfuscate ? "SIGN IN" : etf.ticker;
        const displayName = shouldObfuscate ? "***" : etf.name;
        const displayPrice = shouldObfuscate ? "***" : price;
        const displayDripSum = shouldObfuscate ? "***" : dripSum;
        const displayRank = rank; // Always show rank
        
        return (
          <Card 
            key={shouldObfuscate ? `obfuscated-${index}` : etf.ticker} 
            className={`p-4 sm:p-6 lg:p-4 ${shouldObfuscate ? "" : "cursor-pointer hover:shadow-md"} transition-shadow`}
            onClick={() => {
              if (shouldObfuscate) return; // Prevent clicks on obfuscated cards
              onSelectETF?.(etf, rank);
            }}
          >
            <CardContent className="p-0 space-y-3 sm:space-y-4 lg:space-y-3">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4 lg:gap-3">
                  <div className="flex flex-col items-center">
                    <span className="text-lg sm:text-xl lg:text-lg font-bold text-primary">#{rank}</span>
                    <RankingChangeIndicator ticker={etf.ticker} currentRank={index + 1} />
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-3 lg:gap-2">
                    <img 
                      src={logoUrl || hilljumpLogo} 
                      alt={logoUrl ? manager : "HillJump"} 
                      className="w-8 h-8 sm:w-10 sm:h-10 lg:w-8 lg:h-8 rounded object-contain bg-background"
                      onError={(e) => {
                        e.currentTarget.src = hilljumpLogo;
                      }}
                    />
                     <div>
                       <div className="flex items-center gap-2">
                         <span className="font-bold text-lg sm:text-xl lg:text-lg">{displayTicker}</span>
                         {shouldObfuscate ? (
                           <img 
                             src="/lovable-uploads/81de2019-2acd-4cc3-8af5-508908a6fbc2.png" 
                             alt="HillJump" 
                             className="w-4 h-4 rounded" 
                           />
                         ) : (
                           <span className="text-sm sm:text-base lg:text-sm">{countryFlag(etf)}</span>
                         )}
                       </div>
                       <div className="text-xs sm:text-sm lg:text-xs text-muted-foreground truncate max-w-32 sm:max-w-48 lg:max-w-32">
                         {shouldObfuscate ? "***" : manager}
                       </div>
                       <div className="text-xs sm:text-sm lg:text-xs text-muted-foreground truncate max-w-32 sm:max-w-48 lg:max-w-32">
                         {shouldObfuscate ? "***" : (etf.underlying || etf.name)}
                       </div>
                     </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    {(() => {
                      const liveItem = live[etf.ticker];
                      let price = liveItem?.price;
                      const cp = liveItem?.changePercent;
                      
                      // If no live price, get from cached prices or ETF current_price
                      if (price == null) {
                        const cachedPrice = cachedPrices[etf.ticker];
                        if (cachedPrice) {
                          if (typeof cachedPrice === 'number') {
                            price = cachedPrice;
                          } else if (typeof cachedPrice === 'object' && 'price' in cachedPrice && typeof cachedPrice.price === 'number') {
                            price = cachedPrice.price;
                          }
                        }
                        
                        if (price == null && etf.current_price) {
                          if (typeof etf.current_price === 'number') {
                            price = etf.current_price;
                          } else if (typeof etf.current_price === 'object' && 'price' in etf.current_price && typeof (etf.current_price as any).price === 'number') {
                            price = (etf.current_price as any).price;
                          }
                        }
                      }
                      
                      if (price == null) return "—";
                      const up = (cp ?? 0) >= 0;
                      
                      // Get price update date from cached prices
                      const cachedPrice = cachedPrices[etf.ticker];
                      let priceDate = null;
                      if (cachedPrice && typeof cachedPrice === 'object' && 'priceUpdatedAt' in cachedPrice) {
                        priceDate = (cachedPrice as any).priceUpdatedAt;
                      }
                      const dateStr = priceDate ? format(new Date(priceDate), "MM/dd HH:mm") : "";
                      
                       return (
                         <div className="inline-flex flex-col items-end leading-tight">
                           <span className="font-semibold">{shouldObfuscate ? "***" : `$${price.toFixed(2)}`}</span>
                           <div className="text-xs space-y-0">
                             {cp != null && !shouldObfuscate && (
                               <div className={up ? "text-emerald-600" : "text-red-600"}>
                                 {up ? "+" : ""}{cp.toFixed(2)}%
                               </div>
                             )}
                             {dateStr && !shouldObfuscate && (
                               <div className="text-muted-foreground">
                                 {dateStr}
                               </div>
                             )}
                           </div>
                         </div>
                       );
                    })()}
                  </div>
                </div>
              </div>

              {/* Buy/Sell Signal */}
              <div className="flex justify-between items-center">
                <PositionIndicator position={etf.position} />
                 <div className="text-xs text-muted-foreground">
                   {distributions[etf.ticker]?.date ? (
                     <>
                       Last {shouldObfuscate ? "***" : format(new Date(distributions[etf.ticker].date), "MM/dd")}
                       {dividendPredictions[etf.ticker]?.date && !shouldObfuscate && (
                         <>, Next {format(new Date(dividendPredictions[etf.ticker].date), "MM/dd")}</>
                       )}
                       {dividendPredictions[etf.ticker]?.date && shouldObfuscate && (
                         <>, Next ***</>
                       )}
                     </>
                   ) : (
                     shouldObfuscate ? "***" : "No distribution"
                   )}
                 </div>
              </div>

               {/* DRIP performance grid */}
               <div className="grid grid-cols-4 gap-2 sm:gap-4 lg:gap-2 text-center">
                 {(['4w', '13w', '26w', '52w'] as const).map((period) => {
                   const percent = getDripPercent(etf.ticker, period);
                   const isPositive = percent >= 0;
                   
                   return (
                     <div key={period} className="text-xs sm:text-sm lg:text-xs">
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