import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { TradingSignal } from '@/types/scanner';

interface ScannerStatsProps {
  totalAnalyzed: number;
  qualifiedSignals: number;
  avgConviction: number;
  avgRR: number;
  analyzedTickers?: string[];
  signals?: TradingSignal[];
}

export function ScannerStats({
  totalAnalyzed,
  qualifiedSignals,
  avgConviction,
  avgRR,
  analyzedTickers = [],
  signals = [],
}: ScannerStatsProps) {
  const [isUniverseOpen, setIsUniverseOpen] = useState(false);
  const sortedTickers = [...analyzedTickers].sort();
  
  // Create earnings map for tickers with upcoming earnings (within 14 days)
  const earningsMap = new Map<string, { date: string; days: number }>();
  signals.forEach(signal => {
    if (signal.earningsDate && signal.daysToEarnings !== undefined && signal.daysToEarnings <= 14) {
      earningsMap.set(signal.ticker, {
        date: signal.earningsDate,
        days: signal.daysToEarnings
      });
    }
  });
  const stats = [
    {
      label: 'Analyzed',
      value: totalAnalyzed,
      color: 'text-primary',
    },
    {
      label: 'Qualified',
      value: qualifiedSignals,
      color: 'text-emerald-500',
    },
    {
      label: 'Avg Conv.',
      value: `${avgConviction}%`,
      color: 'text-violet-500',
    },
    {
      label: 'Avg R:R',
      value: `${avgRR}:1`,
      color: 'text-amber-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {stats.map((stat) => {
        const isAnalyzed = stat.label === 'Analyzed';
        const CardWrapper = isAnalyzed ? Dialog : 'div';
        const cardContent = (
          <Card 
            key={stat.label} 
            className={`bg-gradient-to-br from-card to-card/50 border-border/50 ${
              isAnalyzed ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''
            }`}
          >
            <CardContent className="pt-6 text-center">
              <div className={`text-3xl md:text-4xl font-bold mb-2 ${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </div>
            </CardContent>
          </Card>
        );

        if (isAnalyzed) {
          return (
            <Dialog key={stat.label} open={isUniverseOpen} onOpenChange={setIsUniverseOpen}>
              <DialogTrigger asChild>
                {cardContent}
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Analyzed Universe ({totalAnalyzed} stocks)</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {sortedTickers.map((ticker) => {
                      const earnings = earningsMap.get(ticker);
                      return (
                        <div
                          key={ticker}
                          className="px-3 py-2 bg-card border border-border rounded text-sm font-medium hover:border-primary/50 transition-colors"
                        >
                          <div className="font-semibold text-center">{ticker}</div>
                          {earnings && (
                            <div className="text-xs text-muted-foreground text-center mt-1">
                              📊 {earnings.days}d
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          );
        }

        return <div key={stat.label}>{cardContent}</div>;
      })}
    </div>
  );
}
