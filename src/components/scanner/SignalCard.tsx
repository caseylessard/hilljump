import { TradingSignal } from "@/types/scanner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface SignalCardProps {
  signal: TradingSignal;
  rank: number;
}

export function SignalCard({ signal, rank }: SignalCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isCall = signal.direction === "CALL";
  const priceChange = ((signal.target - signal.entry) / signal.entry) * 100;

  const getStrategyIcon = () => {
    switch (signal.strategy) {
      case "Z_SCORE_REVERSION":
        return "📊 Z-Score Reversion";
      case "MOMENTUM_REGIME":
        return "🚀 Momentum+Regime";
      case "RELATIVE_STRENGTH":
        return "💪 Relative Strength";
      default:
        return signal.strategy;
    }
  };

  const getConvictionColor = (conviction: number) => {
    if (conviction >= 85) return "text-green-600 dark:text-green-400";
    if (conviction >= 70) return "text-blue-600 dark:text-blue-400";
    return "text-yellow-600 dark:text-yellow-400";
  };

  return (
    <Card
      className="p-4 hover:shadow-lg transition-shadow border-l-4"
      style={{
        borderLeftColor: isCall ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)",
      }}
    >
      {/* Compact Header - Always Visible */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-muted-foreground">#{rank}</span>
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              {signal.ticker}
              {signal.epsBeatRate !== undefined && signal.epsBeatRate >= 87.5 && (
                <span className="text-sm">📊 {signal.epsBeatRate}% EPS beats ★</span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">{signal.company}</p>
          </div>
        </div>

        {/* Color-coded CALL/PUT Badge */}
        <Badge
          className={`text-base px-4 py-2 font-bold ${
            isCall ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"
          }`}
        >
          {signal.strike} {signal.direction}{" "}
          {signal.exitDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
        </Badge>
      </div>

      {/* Strategy Badge */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Badge variant="secondary" className="text-xs">
          {getStrategyIcon()}
        </Badge>
        {signal.qualifier && (
          <Badge variant="outline" className="text-xs">
            {signal.qualifier}
          </Badge>
        )}
      </div>

      {/* Volatility Warning - Always Visible */}
      {signal.volatilityWarning && (
        <div
          className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border text-sm ${
            signal.volatilityWarning === "EXTREME"
              ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800"
              : signal.volatilityWarning === "HIGH"
                ? "bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800"
                : "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-700"
          }`}
        >
          {signal.volatilityWarning === "EXTREME" && (
            <>
              <span className="text-xl">💀</span>
              <span className="font-bold text-red-700 dark:text-red-400">
                EXTREME VOLATILITY (ATR: {signal.atrPercent}%)
              </span>
            </>
          )}
          {signal.volatilityWarning === "HIGH" && (
            <>
              <span className="text-xl">🔴</span>
              <span className="font-semibold text-orange-700 dark:text-orange-400">
                HIGH VOLATILITY (ATR: {signal.atrPercent}%)
              </span>
            </>
          )}
          {signal.volatilityWarning === "ELEVATED" && (
            <>
              <span className="text-xl">🟡</span>
              <span className="font-medium text-yellow-700 dark:text-yellow-400">
                Elevated Volatility (ATR: {signal.atrPercent}%)
              </span>
            </>
          )}
        </div>
      )}

      {/* Earnings Warnings - Always Visible */}
      {signal.earningsWarnings && signal.earningsWarnings.length > 0 && (
        <div className="mb-3 space-y-1">
          {signal.earningsWarnings.map((warning, idx) => (
            <div key={idx} className="text-xs text-orange-600 dark:text-orange-400 font-medium">
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* Conviction - Always Visible */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">Conviction Score</span>
          <span className={`text-xl font-bold ${getConvictionColor(signal.conviction)}`}>{signal.conviction}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all"
            style={{
              width: `${signal.conviction}%`,
              backgroundColor:
                signal.conviction >= 85
                  ? "rgb(34, 197, 94)"
                  : signal.conviction >= 70
                    ? "rgb(59, 130, 246)"
                    : "rgb(234, 179, 8)",
            }}
          />
        </div>
      </div>

      {/* Key Metrics Grid - Always Visible */}
      <div className="grid grid-cols-4 gap-2 mb-3 text-center">
        <div className="bg-muted/30 p-2 rounded">
          <p className="text-xs text-muted-foreground">Entry</p>
          <p className="text-sm font-bold">${signal.entry.toFixed(2)}</p>
        </div>
        <div className="bg-muted/30 p-2 rounded">
          <p className="text-xs text-muted-foreground">Target</p>
          <p className={`text-sm font-bold ${isCall ? "text-green-600" : "text-red-600"}`}>
            ${signal.target.toFixed(2)}
          </p>
          <p className={`text-xs ${isCall ? "text-green-600" : "text-red-600"}`}>
            {isCall ? "+" : ""}
            {priceChange.toFixed(1)}%
          </p>
        </div>
        <div className="bg-muted/30 p-2 rounded">
          <p className="text-xs text-muted-foreground">Risk:Reward</p>
          <p className="text-sm font-bold">{signal.rr.toFixed(1)}:1</p>
        </div>
        <div className="bg-muted/30 p-2 rounded">
          <p className="text-xs text-muted-foreground">Z-Score</p>
          <p className="text-sm font-bold">{signal.zScore}σ</p>
        </div>
      </div>

      {/* Expandable Details Section */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          {/* Additional Metrics */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Z-Score (20d)</p>
              <p className="font-semibold">{signal.zScore20}σ</p>
            </div>
            <div>
              <p className="text-muted-foreground">Rel Strength</p>
              <p className="font-semibold">{signal.relStrength}</p>
            </div>
            <div>
              <p className="text-muted-foreground">ATR</p>
              <p className="font-semibold">
                ${signal.atr}({signal.atrPercent}%)
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Regime</p>
              <p className="font-semibold">{signal.regime}</p>
            </div>
          </div>

          {/* Trade Details */}
          <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 p-3 rounded-lg">
            <div>
              <p className="text-muted-foreground">Strike</p>
              <p className="font-semibold">${signal.strike}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Exit Date</p>
              <p className="font-semibold">
                {signal.exitDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ({signal.days}d)
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Stop Loss</p>
              <p className="font-semibold text-red-600 dark:text-red-400">${signal.stop.toFixed(2)}</p>
            </div>
          </div>

          {/* Reasoning */}
          <div className="p-3 bg-muted/20 rounded-lg border">
            <h4 className="text-xs font-semibold mb-2">📈 Quantitative Analysis</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{signal.reasoning}</p>
          </div>
        </div>
      )}

      {/* Expand/Collapse Button */}
      <Button variant="ghost" size="sm" className="w-full mt-3" onClick={() => setIsExpanded(!isExpanded)}>
        {isExpanded ? (
          <>
            <ChevronUp className="w-4 h-4 mr-2" />
            Show Less
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4 mr-2" />
            Show Details
          </>
        )}
      </Button>
    </Card>
  );
}
