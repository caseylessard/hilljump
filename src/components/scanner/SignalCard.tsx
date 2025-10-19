import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { TradingSignal } from '@/types/scanner';
import { STRATEGY_LABELS } from '@/lib/constants';

interface SignalCardProps {
  signal: TradingSignal;
  rank: number;
}

export function SignalCard({ signal, rank }: SignalCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const movePercent = ((signal.target - signal.entry) / signal.entry * 100).toFixed(1);
  const isPositive = parseFloat(movePercent) > 0;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = signal.exitDate;
  const contract = `${signal.strike} ${signal.direction === 'CALL' ? 'C' : 'P'} ${months[d.getMonth()]} ${d.getDate()} '${d.getFullYear().toString().slice(-2)}`;

  const directionClass = signal.direction === 'CALL'
    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/50'
    : 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/50';

  const strategyColor = 
    signal.strategy === 'Z_SCORE_REVERSION' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/50' :
    signal.strategy === 'MOMENTUM_REGIME' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/50' :
    'bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/50';

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-primary/30 transition-colors">
      <CardContent className="p-0">
        {/* Mobile/Tablet: Collapsible */}
        <div className="lg:hidden">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {signal.ticker}
                </div>
                <div className="text-sm text-muted-foreground">
                  {signal.company}
                </div>
              </div>
              <Badge variant="outline" className={`${directionClass} font-bold text-base px-3 py-1`}>
                {signal.direction}
              </Badge>
            </div>

            {/* Contract */}
            <div className="text-base font-semibold text-primary/80 mb-3">
              {contract}
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <MetricBox label="Conviction">
                <div className="text-xl font-semibold">{signal.conviction}%</div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500"
                    style={{ width: `${signal.conviction}%` }}
                  />
                </div>
              </MetricBox>

              <MetricBox label="Entry → Target">
                <div className="text-xl font-semibold">
                  ${signal.entry.toFixed(2)} → ${signal.target.toFixed(2)}
                </div>
                <div className={`text-xs font-medium ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                  {isPositive ? '+' : ''}{movePercent}%
                </div>
              </MetricBox>

              <MetricBox label="Risk:Reward">
                <div className="text-xl font-semibold">{signal.rr.toFixed(1)}:1</div>
              </MetricBox>

              <MetricBox label="Days to Exit">
                <div className="text-xl font-semibold">{signal.days}d</div>
              </MetricBox>
            </div>

            {/* Expand indicator */}
            <div className="flex items-center justify-center gap-2 pt-3 border-t border-border/50 text-sm text-muted-foreground">
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  <span>Tap to Close</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span>Tap for Details</span>
                </>
              )}
            </div>
          </button>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="px-4 pb-4 space-y-4 border-t border-border/50">
              {/* Strategy */}
              <div>
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                  Strategy
                </h4>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className={strategyColor}>
                    {STRATEGY_LABELS[signal.strategy]}
                  </Badge>
                  {signal.qualifier && (
                    <Badge variant="outline" className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50">
                      {signal.qualifier}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Quant Metrics */}
              <div>
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                  Quant Metrics
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <DetailItem label="Z-Score (50d)" value={`${signal.zScore}σ`} />
                  <DetailItem label="Z-Score (20d)" value={`${signal.zScore20}σ`} />
                  <DetailItem label="Rel Strength" value={signal.relStrength.toString()} />
                  <DetailItem label="ATR" value={`$${signal.atr}`} />
                  <DetailItem label="Regime" value={signal.regime} />
                  <DetailItem label="Stop" value={`$${signal.stop.toFixed(2)}`} valueClass="text-red-500" />
                  <DetailItem label="RSI" value={signal.rsi.toString()} />
                  <DetailItem label="Vol Ratio" value={`${signal.vol.toFixed(1)}x`} />
                </div>
              </div>

              {/* Analysis */}
              <div>
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                  Analysis
                </h4>
                <div className="bg-primary/5 border-l-4 border-primary rounded p-3 text-sm leading-relaxed text-foreground/90">
                  {signal.reasoning}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop: Always Expanded */}
        <div className="hidden lg:block p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-border/50">
            <div>
              <div className="text-3xl font-bold text-primary mb-1">
                #{rank} {signal.ticker}
              </div>
              <div className="text-lg text-muted-foreground">
                {signal.company}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-primary/80 mb-2">
                {contract}
              </div>
              <Badge variant="outline" className={`${directionClass} font-bold text-lg px-4 py-1.5`}>
                {signal.direction}
              </Badge>
            </div>
          </div>

          {/* Strategy Badges */}
          <div className="flex gap-2 mb-6">
            <Badge variant="outline" className={strategyColor}>
              {STRATEGY_LABELS[signal.strategy]}
            </Badge>
            {signal.qualifier && (
              <Badge variant="outline" className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50">
                {signal.qualifier}
              </Badge>
            )}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <DesktopMetric label="Conviction Score">
              <div className="text-2xl font-semibold">{signal.conviction}%</div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500"
                  style={{ width: `${signal.conviction}%` }}
                />
              </div>
            </DesktopMetric>

            <DesktopMetric label="Entry Price">
              <div className="text-2xl font-semibold">${signal.entry.toFixed(2)}</div>
            </DesktopMetric>

            <DesktopMetric label="Target Price">
              <div className={`text-2xl font-semibold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                ${signal.target.toFixed(2)}
              </div>
              <div className={`text-sm font-medium ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{movePercent}%
              </div>
            </DesktopMetric>

            <DesktopMetric label="Risk:Reward">
              <div className="text-2xl font-semibold">{signal.rr.toFixed(1)}:1</div>
            </DesktopMetric>

            <DesktopMetric label="Z-Score (50-day)">
              <div className="text-2xl font-semibold">{signal.zScore}σ</div>
            </DesktopMetric>

            <DesktopMetric label="Z-Score (20-day)">
              <div className="text-2xl font-semibold">{signal.zScore20}σ</div>
            </DesktopMetric>

            <DesktopMetric label="Rel Strength">
              <div className="text-2xl font-semibold">{signal.relStrength}</div>
            </DesktopMetric>

            <DesktopMetric label="ATR (Stop Basis)">
              <div className="text-2xl font-semibold">${signal.atr}</div>
            </DesktopMetric>

            <DesktopMetric label="Market Regime">
              <div className="text-2xl font-semibold">{signal.regime}</div>
            </DesktopMetric>

            <DesktopMetric label="Strike">
              <div className="text-2xl font-semibold">${signal.strike}</div>
            </DesktopMetric>

            <DesktopMetric label="Exit Date">
              <div className="text-xl font-semibold">
                {months[d.getMonth()]} {d.getDate()}, {d.getFullYear()}
              </div>
              <div className="text-sm text-muted-foreground">({signal.days}d)</div>
            </DesktopMetric>

            <DesktopMetric label="Stop Loss">
              <div className="text-2xl font-semibold text-red-500">
                ${signal.stop.toFixed(2)}
              </div>
            </DesktopMetric>
          </div>

          {/* Analysis */}
          <div className="bg-primary/5 border-l-4 border-primary rounded-lg p-4">
            <h4 className="font-semibold text-primary mb-2">📈 Quantitative Analysis</h4>
            <div className="text-sm leading-relaxed text-foreground/90">
              {signal.reasoning}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper Components

function MetricBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-2">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}

function DetailItem({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-secondary/30 rounded p-2">
      <div className="text-[9px] text-muted-foreground uppercase mb-0.5">
        {label}
      </div>
      <div className={`text-sm font-semibold ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function DesktopMetric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}
