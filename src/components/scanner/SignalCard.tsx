import { TradingSignal } from "@/types/scanner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface SignalCardProps {
  signal: TradingSignal;
  rank: number;
}

export function SignalCard({ signal, rank }: SignalCardProps) {
  const isCall = signal.direction === "CALL";
  const priceChange = ((signal.target - signal.entry) / signal.entry) * 100;
  const absChange = Math.abs(priceChange);

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
      className="p-6 hover:shadow-lg transition-shadow border-l-4"
      style={{
        borderLeftColor: isCall ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">#{rank}</span>
            <h3 className="text-2xl font-bold">{signal.ticker}</h3>
            <p className="text-sm text-muted-foreground">{signal.company}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Badge variant={isCall ? "default" : "destructive"} className="text-lg px-4 py-2">
            {signal.strike} {signal.direction}{" "}
            {signal.exitDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
          </Badge>
          <div className="flex items-center gap-2 text-sm">
            {isCall ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
            <span className={isCall ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
              {signal.direction}
            </span>
          </div>
        </div>
      </div>

      {/* Strategy & Qualifier */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Badge variant="secondary" className="text-sm">
          {getStrategyIcon()}
        </Badge>
        {signal.qualifier && (
          <Badge variant="outline" className="text-sm">
            {signal.qualifier}
          </Badge>
        )}
        {signal.epsBeatRate !== undefined && (
          <Badge
            variant="outline"
            className="text-sm bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700"
          >
            📊 {signal.epsBeatRate}% EPS beats {signal.epsBeatRate >= 87.5 ? "★" : ""}
          </Badge>
        )}
      </div>

      {/* Volatility Warning - Traffic Light System */}
      {signal.volatilityWarning && (
        <div
          className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border ${
            signal.volatilityWarning === "EXTREME"
              ? "bg-gradient-to-r from-red-100 to-red-50 dark:from-red-950/40 dark:to-red-900/30 border-red-300 dark:border-red-800"
              : signal.volatilityWarning === "HIGH"
                ? "bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border-red-200 dark:border-red-700"
                : "bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-yellow-200 dark:border-yellow-700"
          }`}
        >
          {signal.volatilityWarning === "EXTREME" && (
            <>
              <span className="text-2xl" role="img" aria-label="skull">
                💀
              </span>
              <span className="text-sm font-bold text-red-700 dark:text-red-400">
                EXTREME VOLATILITY - Penny stock risk (ATR: {signal.atrPercent}%)
              </span>
            </>
          )}
          {signal.volatilityWarning === "HIGH" && (
            <>
              <span className="text-2xl" role="img" aria-label="danger">
                🔴
              </span>
              <span className="text-sm font-bold text-red-600 dark:text-red-400">
                HIGH VOLATILITY - Wide stops required (ATR: {signal.atrPercent}%)
              </span>
            </>
          )}
          {signal.volatilityWarning === "ELEVATED" && (
            <>
              <span className="text-2xl" role="img" aria-label="caution">
                🟡
              </span>
              <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                Elevated Volatility - Monitor closely (ATR: {signal.atrPercent}%)
              </span>
            </>
          )}
        </div>
      )}

      {/* Earnings Warnings */}
      {signal.earningsWarnings && signal.earningsWarnings.length > 0 && (
        <div className="mb-3 space-y-1">
          {signal.earningsWarnings.map((warning, idx) => (
            <div key={idx} className="text-sm text-orange-600 dark:text-orange-400 font-medium">
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* Conviction Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">Conviction Score</span>
          <span className={`text-2xl font-bold ${getConvictionColor(signal.conviction)}`}>{signal.conviction}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all"
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

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground">Entry Price</p>
          <p className="text-lg font-bold">${signal.entry.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Target Price</p>
          <p className={`text-lg font-bold ${isCall ? "text-green-600" : "text-red-600"}`}>
            ${signal.target.toFixed(2)}
          </p>
          <p className={`text-xs ${isCall ? "text-green-600" : "text-red-600"}`}>
            {isCall ? "+" : ""}
            {priceChange.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Risk:Reward</p>
          <p className="text-lg font-bold">{signal.rr.toFixed(1)}:1</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Z-Score (50-day)</p>
          <p className="text-lg font-bold">{signal.zScore}σ</p>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Z-Score (20-day)</p>
          <p className="font-semibold">{signal.zScore20}σ</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Rel Strength</p>
          <p className="font-semibold">{signal.relStrength}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">ATR (% of Price)</p>
          <p className="font-semibold">
            ${signal.atr}({signal.atrPercent}%)
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Market Regime</p>
          <p className="font-semibold">{signal.regime}</p>
        </div>
      </div>

      {/* Trade Details */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-sm bg-muted/50 p-3 rounded-lg">
        <div>
          <p className="text-xs text-muted-foreground">Strike</p>
          <p className="font-semibold">${signal.strike}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Exit Date</p>
          <p className="font-semibold">
            {signal.exitDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
          <p className="text-xs text-muted-foreground">({signal.days}d)</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Stop Loss</p>
          <p className="font-semibold text-red-600 dark:text-red-400">${signal.stop.toFixed(2)}</p>
        </div>
      </div>

      {/* Reasoning */}
      <div className="mt-4 p-4 bg-muted/30 rounded-lg border">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">📈 Quantitative Analysis</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{signal.reasoning}</p>
      </div>
    </Card>
  );
}
