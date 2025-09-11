import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScoredETF } from "@/lib/scoring";
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
};

export const SimpleETFTable = ({ items, live = {}, distributions = {} }: Props) => {
  const [sortKey, setSortKey] = useState<string>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  
  const MANAGER_LOGOS: Record<string, string> = {
    "YIELDMAX": yieldmaxLogo,
    "GLOBAL X": globalxLogo,
    "JPMORGAN": jpmorganLogo,
    "AMPLIFY": amplifyLogo,
    "ROUNDHILL": roundhillLogo,
  };

  function countryFlag(etf: ScoredETF) {
    const currency = etf.currency || 'USD';
    if (currency === 'CAD') return "🇨🇦";
    return "🇺🇸";
  }

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

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const getSortValue = (etf: ScoredETF, key: string): any => {
    const lp = live[etf.ticker];
    switch (key) {
      case "ticker": return etf.ticker;
      case "price": return lp?.price ?? etf.current_price ?? 0;
      case "lastDist": return distributions[etf.ticker]?.amount ?? 0;
      case "drip4w": return lp?.drip4wPercent ?? 0;
      case "drip13w": return lp?.drip13wPercent ?? 0;
      case "drip26w": return lp?.drip26wPercent ?? 0;
      case "drip52w": return lp?.drip52wPercent ?? 0;
      case "score": return etf.compositeScore ?? 0;
      default: return 0;
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    
    const comparison = sortDir === "asc" ? aVal - bVal : bVal - aVal;
    return comparison;
  });

  const indicator = (key: string) => (sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "↕");

  return (
    <Card className="p-4 mb-6 overflow-x-auto">
      <div className="mb-2">
        <h3 className="text-lg font-semibold">Simple ETF Table (No Rules/Filters)</h3>
        <p className="text-sm text-muted-foreground">Basic table without optimizations for comparison</p>
      </div>
      <Table>
        <TableCaption>Simple ETF data without filtering or optimization rules applied.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <button onClick={() => handleSort("rank")} className="flex items-center gap-1">
                # <span className="text-muted-foreground text-xs">{indicator("rank")}</span>
              </button>
            </TableHead>
            <TableHead>
              <button onClick={() => handleSort("ticker")} className="flex items-center gap-1">
                Ticker <span className="text-muted-foreground text-xs">{indicator("ticker")}</span>
              </button>
            </TableHead>
            <TableHead className="text-center">
              Trend
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => handleSort("price")} className="flex items-center gap-1 ml-auto">
                Price <span className="text-muted-foreground text-xs">{indicator("price")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => handleSort("lastDist")} className="flex items-center gap-1 ml-auto">
                Last Dist <span className="text-muted-foreground text-xs">{indicator("lastDist")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">Next Dist</TableHead>
            <TableHead className="text-right">
              <button onClick={() => handleSort("drip4w")} className="flex items-center gap-1 ml-auto">
                4W DRIP <span className="text-muted-foreground text-xs">{indicator("drip4w")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => handleSort("drip13w")} className="flex items-center gap-1 ml-auto">
                13W DRIP <span className="text-muted-foreground text-xs">{indicator("drip13w")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => handleSort("drip26w")} className="flex items-center gap-1 ml-auto">
                26W DRIP <span className="text-muted-foreground text-xs">{indicator("drip26w")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => handleSort("drip52w")} className="flex items-center gap-1 ml-auto">
                52W DRIP <span className="text-muted-foreground text-xs">{indicator("drip52w")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => handleSort("score")} className="flex items-center gap-1 ml-auto">
                Score <span className="text-muted-foreground text-xs">{indicator("score")}</span>
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((etf, index) => {
            const lp = live[etf.ticker];
            const manager = getFundManager(etf);
            const logo = getManagerLogo(etf, manager);
            const dist = distributions[etf.ticker];
            const price = lp?.price ?? etf.current_price;
            
            return (
              <TableRow key={etf.ticker} className="cursor-pointer hover:bg-muted/50">
                <TableCell className="font-medium text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {logo ? (
                      <Avatar className="h-6 w-6">
                        <img src={logo} alt={manager} className="object-contain" />
                        <AvatarFallback className="text-xs">{manager.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{manager.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-medium">{displayTicker(etf.ticker)}</span>
                        <span className="text-xs">{countryFlag(etf)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground truncate max-w-32">
                        {etf.name}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <div className={`w-3 h-3 rounded-full ${
                      etf.position === 1 ? 'bg-emerald-500' : 
                      etf.position === 0 ? 'bg-yellow-500' : 
                      'bg-red-500'
                    }`} />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {price ? `$${price.toFixed(2)}` : '—'}
                </TableCell>
                <TableCell className="text-right">
                  {dist ? `$${dist.amount.toFixed(3)}` : '—'}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  —
                </TableCell>
                <TableCell className="text-right">
                  {lp?.drip4wPercent ? (
                    <div className="inline-flex flex-col items-end leading-tight">
                      <span>+${Math.abs(lp.drip4wDollar || 0).toFixed(3)}</span>
                      <span className={lp.drip4wPercent >= 0 ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>
                        {lp.drip4wPercent >= 0 ? "+" : ""}{lp.drip4wPercent.toFixed(1)}%
                      </span>
                    </div>
                  ) : etf.yieldTTM ? (
                    <div className="inline-flex flex-col items-end leading-tight text-muted-foreground">
                      <span>est.</span>
                      <span className="text-xs">
                        +{((etf.yieldTTM * (28/365))).toFixed(1)}%
                      </span>
                    </div>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  {lp?.drip13wPercent ? (
                    <div className="inline-flex flex-col items-end leading-tight">
                      <span>+${Math.abs(lp.drip13wDollar || 0).toFixed(3)}</span>
                      <span className={lp.drip13wPercent >= 0 ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>
                        {lp.drip13wPercent >= 0 ? "+" : ""}{lp.drip13wPercent.toFixed(1)}%
                      </span>
                    </div>
                  ) : etf.yieldTTM ? (
                    <div className="inline-flex flex-col items-end leading-tight text-muted-foreground">
                      <span>est.</span>
                      <span className="text-xs">
                        +{((etf.yieldTTM * (91/365))).toFixed(1)}%
                      </span>
                    </div>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  {lp?.drip26wPercent ? (
                    <div className="inline-flex flex-col items-end leading-tight">
                      <span>+${Math.abs(lp.drip26wDollar || 0).toFixed(3)}</span>
                      <span className={lp.drip26wPercent >= 0 ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>
                        {lp.drip26wPercent >= 0 ? "+" : ""}{lp.drip26wPercent.toFixed(1)}%
                      </span>
                    </div>
                  ) : etf.yieldTTM ? (
                    <div className="inline-flex flex-col items-end leading-tight text-muted-foreground">
                      <span>est.</span>
                      <span className="text-xs">
                        +{((etf.yieldTTM * (182/365))).toFixed(1)}%
                      </span>
                    </div>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  {lp?.drip52wPercent ? (
                    <div className="inline-flex flex-col items-end leading-tight">
                      <span>+${Math.abs(lp.drip52wDollar || 0).toFixed(3)}</span>
                      <span className={lp.drip52wPercent >= 0 ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>
                        {lp.drip52wPercent >= 0 ? "+" : ""}{lp.drip52wPercent.toFixed(1)}%
                      </span>
                    </div>
                  ) : etf.yieldTTM ? (
                    <div className="inline-flex flex-col items-end leading-tight text-muted-foreground">
                      <span>est.</span>
                      <span className="text-xs">
                        +{etf.yieldTTM.toFixed(1)}%
                      </span>
                    </div>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className="font-mono">
                    {etf.compositeScore?.toFixed(1) ?? '0.0'}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
};