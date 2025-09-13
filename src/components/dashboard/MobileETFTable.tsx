import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ScoredETF } from "@/lib/scoring";
import type { LivePrice } from "@/lib/live";
import { useRankingHistory, type RankingChange } from "@/hooks/useRankingHistory";
import yieldmaxLogo from "@/assets/logos/yieldmax.png";
import globalxLogo from "@/assets/logos/globalx.png";
import jpmorganLogo from "@/assets/logos/jpmorgan.png";
import amplifyLogo from "@/assets/logos/amplify.png";
import roundhillLogo from "@/assets/logos/roundhill.svg";
import { format } from "date-fns";

type Props = {
  items: ScoredETF[];
  live?: Record<string, LivePrice>;
  distributions?: Record<string, { amount: number; date: string; currency?: string }>;
  cachedDripData?: Record<string, any>;
  cachedPrices?: Record<string, any>;
  frozenRankings?: Map<string, number>;
  persistentRanking?: Array<{ticker: string, rank: number, score: number, updatedAt: number}>;
  onItemClick: (etf: ScoredETF, rank: number) => void;
};

// Helper functions
const getFundManager = (etf: ScoredETF): string => {
  if (etf.manager) return etf.manager;
  const n = (etf.name || "").toUpperCase();
  const c = (etf.category || "").toUpperCase();
  if (n.includes("YIELDMAX") || c.includes("YIELDMAX")) return "YieldMax";
  if (n.includes("GLOBAL X")) return "Global X";
  if (n.includes("JPMORGAN") || n.includes("J.P. MORGAN") || n.includes("JP MORGAN")) return "JPMorgan";
  if (n.includes("AMPLIFY")) return "Amplify";
  if (n.includes("ROUNDHILL")) return "Roundhill";
  return "ETF";
};

const getManagerLogo = (etf: ScoredETF, manager?: string): string | undefined => {
  const MANAGER_LOGOS = {
    "YIELDMAX": yieldmaxLogo,
    "GLOBAL X": globalxLogo,
    "JPMORGAN": jpmorganLogo,
    "AMPLIFY": amplifyLogo,
    "ROUNDHILL": roundhillLogo,
  };
  
  const key = (etf.logoKey || manager || etf.manager || "").toUpperCase();
  return MANAGER_LOGOS[key as keyof typeof MANAGER_LOGOS];
};

const getEtfDescription = (etf: ScoredETF): string => {
  if (etf.strategyLabel) return etf.strategyLabel;
  const nm = (etf.name || "").toUpperCase();
  const cat = (etf.category || "").toUpperCase();
  let base = "ETF";
  if (nm.includes("COVERED CALL") || nm.includes("OPTION INCOME") || cat.includes("COVERED CALL") || cat.includes("YIELDMAX")) {
    base = "CC ETF";
  }
  return base;
};

const countryFlag = (etf: ScoredETF) => {
  const currency = etf.currency || 'USD';
  return currency === 'CAD' ? "🇨🇦" : "🇺🇸";
};

const TrendIndicator = memo(({ position }: { position?: number }) => {
  if (position === undefined || position === null) {
    return (
      <div className="flex justify-center">
        <div className="w-3 h-3 rounded-full bg-muted-foreground" />
      </div>
    );
  }
  
  let circleClass: string;
  
  if (position === 2) {
    circleClass = "bg-emerald-500 border-emerald-500";
  } else if (position === 1) {
    circleClass = "bg-transparent border-2 border-emerald-500";
  } else if (position === 0) {
    circleClass = "bg-yellow-500 border-yellow-500";
  } else if (position === -1) {
    circleClass = "bg-transparent border-2 border-red-500";
  } else if (position === -2) {
    circleClass = "bg-red-500 border-red-500";
  } else {
    circleClass = "bg-muted-foreground border-muted-foreground";
  }
  
  return (
    <div className="flex justify-center">
      <div className={`w-3 h-3 rounded-full border ${circleClass}`} />
    </div>
  );
});

const RankingChangeIndicator = memo(({ ticker, changes }: { ticker: string; changes: Record<string, RankingChange> }) => {
  const change = changes[ticker];
  if (!change || change.isNew || !change.previousRank || Math.abs(change.change) > 50) return null;
  
  if (change.change === 0) {
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
  
  const movedUp = change.change > 0;
  const Icon = movedUp ? TrendingUp : TrendingDown;
  const colorClass = movedUp ? "text-emerald-600" : "text-red-600";
  
  return (
    <div className={`flex items-center gap-1 ${colorClass}`}>
      <Icon className="h-3 w-3" />
      <span className="text-xs">{Math.abs(change.change)}</span>
    </div>
  );
});

const PersistentRankingChangeIndicator = memo(({ ticker, currentRank, persistentRanking }: { ticker: string; currentRank: number; persistentRanking: Array<{ticker: string, rank: number, score: number, updatedAt: number}> }) => {
  const persistentRank = persistentRanking.find(r => r.ticker === ticker)?.rank;
  if (!persistentRank || persistentRank === currentRank) return null;
  
  const change = persistentRank - currentRank;
  
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
});

const DRIPCell = memo(({ 
  ticker, 
  period, 
  dripData, 
  live,
  etfData
}: { 
  ticker: string; 
  period: '4w' | '13w' | '26w' | '52w'; 
  dripData: Record<string, any>; 
  live: Record<string, LivePrice>; 
  etfData?: ScoredETF;
}) => {
  const tickerData = dripData[ticker];
  
  if (!tickerData) {
    const liveItem = live[ticker];
    const periodKey = period as '4w' | '12w' | '52w';
    const d = liveItem?.[`drip${periodKey}Dollar` as keyof LivePrice];
    const p = liveItem?.[`drip${periodKey}Percent` as keyof LivePrice];
    
    if (d != null || p != null) {
      const up = (p as number ?? 0) >= 0;
      return (
        <div className="text-right text-sm">
          <div>{d != null ? `${(d as number) >= 0 ? '+' : ''}$${Math.abs(d as number).toFixed(2)}` : "—"}</div>
          <div className={p != null ? (up ? "text-emerald-600 text-xs" : "text-red-600 text-xs") : "text-muted-foreground text-xs"}>
            {p != null ? `${up ? "+" : ""}${(p as number).toFixed(1)}%` : "—"}
          </div>
        </div>
      );
    }
    
    return <span className="text-sm">—</span>;
  }
  
  const percentKey = `drip${period}Percent`;
  const dollarKey = `drip${period}Dollar`;
  
  const percent = tickerData?.[percentKey];
  const dollar = tickerData?.[dollarKey];
  
  if (percent === undefined || percent === null) return <span className="text-sm">—</span>;
  
  const up = percent >= 0;
  return (
    <div className="text-right text-sm">
      <div>{dollar >= 0 ? '+' : '-'}${Math.abs(dollar).toFixed(3)}</div>
      <div className={up ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>
        {up ? "+" : ""}{percent.toFixed(1)}%
      </div>
    </div>
  );
});

const NextDistributionCell = memo(({ 
  ticker, 
  predictions 
}: { 
  ticker: string; 
  predictions: Record<string, any>; 
}) => {
  const prediction = predictions[ticker];
  
  if (!prediction) return <span className="text-sm">—</span>;
  
  const dateStr = format(new Date(prediction.date), "MM/dd");
  const symbol = prediction.currency === 'CAD' ? 'CA$' : '$';
  const amountStr = `${symbol}${prediction.amount.toFixed(4)}`;
  
  return (
    <div className="text-right text-sm">
      <div className="text-muted-foreground">{amountStr}</div>
      <div className="text-muted-foreground text-xs">{dateStr}*</div>
    </div>
  );
});

export const MobileETFTable = ({ 
  items, 
  live = {}, 
  distributions = {}, 
  cachedDripData = {},
  cachedPrices = {},
  frozenRankings = new Map(),
  persistentRanking = [],
  onItemClick
}: Props) => {
  const tickers = items.map(item => item.ticker);
  const { data: rankingChanges = {} } = useRankingHistory(tickers);
  const dividendPredictions = {}; // TODO: Add this if needed

  return (
    <div className="space-y-3">
      {items.map((etf, idx) => {
        const rank = frozenRankings.get(etf.ticker) || idx + 1;
        const manager = getFundManager(etf);
        const logo = getManagerLogo(etf, manager);
        const price = Number(cachedPrices[etf.ticker] || etf.current_price || 0);

        return (
          <Card 
            key={etf.ticker} 
            className="p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onItemClick(etf, rank)}
          >
            <div className="flex items-start gap-3">
              {/* Rank and Flag */}
              <div className="flex flex-col items-center shrink-0 min-w-[40px]">
                <span className="text-lg font-bold text-muted-foreground">#{rank}</span>
                <span className="text-lg">{countryFlag(etf)}</span>
              </div>
              
              {/* Main Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-lg">{etf.ticker}</span>
                  <TrendIndicator position={etf.position} />
                  <RankingChangeIndicator ticker={etf.ticker} changes={rankingChanges} />
                  <PersistentRankingChangeIndicator 
                    ticker={etf.ticker} 
                    currentRank={rank} 
                    persistentRanking={persistentRanking} 
                  />
                </div>
                
                <div className="flex items-center gap-2 mb-2">
                  {logo && (
                    <Avatar className="h-6 w-6">
                      <img src={logo} alt={manager} className="object-contain" />
                      <AvatarFallback className="text-xs">{manager.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                  )}
                  <span className="text-sm font-medium truncate">{manager}</span>
                </div>
                
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {getEtfDescription(etf)}
                </p>
                
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-medium">${price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">4W:</span>
                    <DRIPCell 
                      ticker={etf.ticker} 
                      period="4w" 
                      dripData={cachedDripData} 
                      live={live}
                      etfData={etf}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">13W:</span>
                    <DRIPCell 
                      ticker={etf.ticker} 
                      period="13w" 
                      dripData={cachedDripData} 
                      live={live}
                      etfData={etf}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next:</span>
                    <NextDistributionCell ticker={etf.ticker} predictions={dividendPredictions} />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};