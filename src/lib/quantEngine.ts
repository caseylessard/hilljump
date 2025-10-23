import type { EODHDData, StockMetrics, TradingSignal, EarningsHistory } from "@/types/scanner";
import { COMPANY_NAMES } from "./constants";

/**
 * OPTIONS PLAY TYPE DICTIONARY
 * User-friendly labels explaining the risk/reward profile
 */
const PLAY_TYPES = {
  HIGH_PROBABILITY: {
    label: "🎯 High Probability Play",
    description: "Conservative, high win rate (~70-75%). ITM options for steady gains.",
    winRate: "70-75%",
    profile: "Conservative Income"
  },
  BALANCED: {
    label: "⚖️ Balanced Play",
    description: "Moderate risk/reward. ATM options for consistent performance.",
    winRate: "60-65%",
    profile: "Balanced Growth"
  },
  LOTTERY_TICKET: {
    label: "🎰 Lottery Ticket",
    description: "Aggressive, low probability. OTM options for explosive gains when right.",
    winRate: "40-50%",
    profile: "High Risk/High Reward"
  },
  HOME_RUN: {
    label: "⚾ Home Run Swing",
    description: "Directional bet with leverage. OTM options targeting big moves.",
    winRate: "45-55%",
    profile: "Swing for the Fences"
  }
};

export class QuantEngine {
  /**
   * Calculate all metrics from raw EODHD data
   */
  static calculateMetrics(tickerData: EODHDData, spyData?: EODHDData): StockMetrics {
    const closes = tickerData.historicalPrices.map((d) => d.close).reverse();
    const volumes = tickerData.historicalPrices.map((d) => d.volume).reverse();
    const highs = tickerData.historicalPrices.map((d) => d.high).reverse();
    const lows = tickerData.historicalPrices.map((d) => d.low).reverse();

    const currentPrice = closes[0];

    return {
      ticker: tickerData.ticker,
      currentPrice,
      prices20d: closes.slice(0, 20),
      prices50d: closes.slice(0, 50),
      prices100d: closes.slice(0, 100),
      rsi: this.calculateRSI(closes, 14),
      momentumScore: this.calculateMomentum(closes, 20),
      priceChangePercent: this.calculatePriceChange(closes, 1),
      volumeRatio: this.calculateVolumeRatio(volumes, 20),
      volumeTrend: this.calculateVolumeTrend(volumes, 10),
      atr: this.calculateATR(highs, lows, closes, 14),
      high52Week: Math.max(...closes.slice(0, Math.min(252, closes.length))),
      low52Week: Math.min(...closes.slice(0, Math.min(252, closes.length))),
      relativeStrength: spyData
        ? this.calculateRelativeStrength(closes, spyData.historicalPrices.map((d) => d.close).reverse(), 50)
        : 50,
    };
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  private static calculateRSI(closes: number[], period = 14): number {
    if (closes.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = closes[i - 1] - closes[i];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return Math.round(rsi);
  }

  /**
   * Calculate momentum score (0-100)
   */
  private static calculateMomentum(closes: number[], period = 20): number {
    if (closes.length < period) return 50;

    const recentPrices = closes.slice(0, period);
    const currentPrice = closes[0];

    const min = Math.min(...recentPrices);
    const max = Math.max(...recentPrices);

    if (max === min) return 50;

    const momentum = ((currentPrice - min) / (max - min)) * 100;
    return Math.round(momentum);
  }

  /**
   * Calculate price change percentage
   */
  private static calculatePriceChange(closes: number[], periods = 1): number {
    if (closes.length < periods + 1) return 0;

    const currentPrice = closes[0];
    const oldPrice = closes[periods];

    return ((currentPrice - oldPrice) / oldPrice) * 100;
  }

  /**
   * Calculate volume ratio (current vs average)
   */
  private static calculateVolumeRatio(volumes: number[], period = 20): number {
    if (volumes.length < period + 1) return 1.0;

    const recentVolumes = volumes.slice(1, period + 1);
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / period;
    const currentVolume = volumes[0];

    if (avgVolume === 0) return 1.0;

    return currentVolume / avgVolume;
  }

  /**
   * Determine volume trend direction
   */
  private static calculateVolumeTrend(volumes: number[], period = 10): "increasing" | "decreasing" | "neutral" {
    if (volumes.length < period * 2) return "neutral";

    const recent = volumes.slice(0, period);
    const previous = volumes.slice(period, period * 2);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / period;
    const previousAvg = previous.reduce((a, b) => a + b, 0) / period;

    const change = (recentAvg - previousAvg) / previousAvg;

    if (change > 0.15) return "increasing";
    if (change < -0.15) return "decreasing";
    return "neutral";
  }

  /**
   * Calculate Average True Range (ATR) - NO CAP, returns REAL volatility
   */
  private static calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number {
    if (highs.length < period + 1) {
      const currentPrice = closes[0];
      return currentPrice * 0.02;
    }

    const trueRanges: number[] = [];

    for (let i = 1; i <= period; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i + 1];

      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));

      trueRanges.push(tr);
    }

    const atr = trueRanges.reduce((a, b) => a + b, 0) / period;

    // Return REAL ATR - no artificial cap
    return atr;
  }

  /**
   * Calculate Relative Strength vs SPY
   */
  private static calculateRelativeStrength(tickerCloses: number[], spyCloses: number[], period = 50): number {
    if (tickerCloses.length < period || spyCloses.length < period) {
      return 50;
    }

    const tickerEnd = tickerCloses[0];
    const tickerStart = tickerCloses[period - 1];
    const tickerReturn = (tickerEnd - tickerStart) / tickerStart;

    const spyEnd = spyCloses[0];
    const spyStart = spyCloses[period - 1];
    const spyReturn = (spyEnd - spyStart) / spyStart;

    const relativeReturn = tickerReturn - spyReturn;
    const normalized = 50 + relativeReturn * 250;

    return Math.max(0, Math.min(100, Math.round(normalized)));
  }

  /**
   * Helper: Round strike price based on price level
   */
  private static roundStrike(price: number, direction: "up" | "down" | "nearest"): number {
    if (price < 50) {
      return direction === "up" ? Math.ceil(price) : direction === "down" ? Math.floor(price) : Math.round(price);
    } else if (price < 200) {
      return direction === "up"
        ? Math.ceil(price / 5) * 5
        : direction === "down"
          ? Math.floor(price / 5) * 5
          : Math.round(price / 5) * 5;
    } else {
      return direction === "up"
        ? Math.ceil(price / 10) * 10
        : direction === "down"
          ? Math.floor(price / 10) * 10
          : Math.round(price / 10) * 10;
    }
  }

  /**
   * ============================================
   * BATCH EARNINGS ENRICHMENT (Optimized - 1 API call!)
   * ============================================
   */
  static async batchEnrichWithEarnings(signals: TradingSignal[], supabaseClient: any): Promise<TradingSignal[]> {
    try {
      if (signals.length === 0) return signals;

      const tickers = signals.map((s) => s.ticker);
      console.log(`📊 Batch fetching earnings for ${tickers.length} tickers in ONE call...`);

      // ONE API call for all tickers
      const { data, error } = await supabaseClient.functions.invoke("fetch-earnings-data", {
        body: { tickers },
      });

      if (error || !data || !data.earnings) {
        console.warn("No earnings data returned");
        return signals;
      }

      const earningsData = data.earnings;

      // Enrich each signal
      return signals.map((signal) => {
        const earningsInfo = earningsData[signal.ticker];

        if (!earningsInfo) {
          return signal;
        }

        let earningsDate: string | undefined = earningsInfo.nextEarningsDate;

        const daysToEarnings = earningsDate
          ? Math.ceil((new Date(earningsDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          : undefined;

        const epsBeatRate = earningsInfo.epsBeatRate;

        const warnings: string[] = [];
        let adjustedConviction = signal.conviction;
        let suggestedExpiry = signal.exitDate;

        if (daysToEarnings !== undefined) {
          if (daysToEarnings < 0) {
            // Earnings already passed
          } else if (daysToEarnings < 7) {
            warnings.push(`⚠️ Earnings in ${daysToEarnings}d - High IV crush risk`);
            adjustedConviction = Math.max(50, adjustedConviction - 15);
          } else if (daysToEarnings <= 21) {
            warnings.push(`📊 Earnings in ${daysToEarnings}d`);

            if (epsBeatRate && epsBeatRate >= 75) {
              warnings.push(`📈 Strong beat history (${Math.round(epsBeatRate)}% EPS beats)`);
              adjustedConviction = Math.min(95, adjustedConviction + 5);
            }

            suggestedExpiry = new Date(earningsDate!);
            suggestedExpiry.setDate(suggestedExpiry.getDate() + 7);
            warnings.push(
              `💡 Consider ${suggestedExpiry.toLocaleDateString("en-US", { month: "short", day: "numeric" })} expiry`,
            );
          }
        }

        if (epsBeatRate && epsBeatRate >= 87.5) {
          adjustedConviction = Math.min(95, adjustedConviction + 8);
        } else if (epsBeatRate && epsBeatRate >= 75) {
          adjustedConviction = Math.min(95, adjustedConviction + 5);
        }

        return {
          ...signal,
          conviction: Math.round(adjustedConviction),
          earningsDate,
          daysToEarnings,
          epsBeatRate: epsBeatRate ? Math.round(epsBeatRate) : undefined,
          earningsWarnings: warnings.length > 0 ? warnings : undefined,
          suggestedExpiry:
            daysToEarnings !== undefined && daysToEarnings > 0 && daysToEarnings <= 21 ? suggestedExpiry : undefined,
        };
      });
    } catch (error) {
      console.error("Error batch enriching signals:", error);
      return signals;
    }
  }

  /**
   * Generate trading signal from metrics
   */
  static calculateSignal(data: StockMetrics): TradingSignal | null {
    const price = data.currentPrice;
    const ticker = data.ticker.replace(".US", "");

    // Data quality filters
    if (price < 1.0) {
      console.warn(`❌ Rejecting ${ticker}: Price too low ($${price.toFixed(2)})`);
      return null;
    }

    if (price > 100000) {
      console.warn(`❌ Rejecting ${ticker}: Price unrealistic ($${price.toFixed(2)})`);
      return null;
    }

    // Dual timeframe z-score analysis
    const prices20d = data.prices20d;
    const mean20 = prices20d.reduce((a, b) => a + b, 0) / prices20d.length;
    const variance20 = prices20d.reduce((sum, p) => sum + Math.pow(p - mean20, 2), 0) / prices20d.length;
    const stdDev20 = Math.sqrt(variance20);
    const zScore20 = stdDev20 > 0 ? (price - mean20) / stdDev20 : 0;

    const prices50d = data.prices50d;
    const mean50 = prices50d.reduce((a, b) => a + b, 0) / prices50d.length;
    const variance50 = prices50d.reduce((sum, p) => sum + Math.pow(p - mean50, 2), 0) / prices50d.length;
    const stdDev50 = Math.sqrt(variance50);
    const zScore50 = stdDev50 > 0 ? (price - mean50) / stdDev50 : 0;

    const zScore = zScore50;
    const zScoreAccelerating = Math.abs(zScore20) > Math.abs(zScore50);

    // Regime filter
    const high20 = Math.max(...prices20d);
    const low20 = Math.min(...prices20d);
    const range20 = high20 - low20;
    const avgRange = range20 / high20;
    const isChopping = avgRange < 0.08;
    const isTrending = avgRange > 0.15;

    // Relative strength
    const relStrength = data.relativeStrength;
    const outperformingSPY = relStrength > 52;
    const underperformingSPY = relStrength < 48;

    // Volume analysis
    const vol = data.volumeRatio;
    const volTrend = data.volumeTrend;
    const institutionalActivity = vol > 1.5 && volTrend === "increasing";

    // ATR-based risk
    const atr = data.atr;
    const atrPercent = (atr / price) * 100;

    // Technical indicators
    const rsi = data.rsi;
    const momentum = data.momentumScore;
    const change = data.priceChangePercent;

    // 52-week positioning
    const high52 = data.high52Week;
    const low52 = data.low52Week;
    const range52 = high52 - low52;
    const position52 = ((price - low52) / range52) * 100;

    let strategy: TradingSignal["strategy"] | null = null;
    let direction: "CALL" | "PUT" | null = null;
    let conviction = 0;
    let timeframe = 45;
    let qualifier = "";

    // Strategy 1: Z-Score Mean Reversion
    if (Math.abs(zScore) >= 2.0 && !isTrending) {
      strategy = "Z_SCORE_REVERSION";
      direction = zScore < -2.0 ? "CALL" : "PUT";

      conviction = 60 + (Math.abs(zScore) - 2.0) * 12;

      if (zScoreAccelerating) conviction += 10;
      if (!isChopping) conviction += 6;
      if (institutionalActivity) conviction += 9;
      if (direction === "CALL" && rsi < 35) conviction += 8;
      if (direction === "PUT" && rsi > 65) conviction += 8;

      if (Math.abs(zScore) > 2.5) conviction += 5;

      timeframe = Math.abs(zScore) > 2.5 ? 30 : 45;
      qualifier = `${Math.abs(zScore).toFixed(1)}σ (50d)${zScoreAccelerating ? " 🔥" : ""}`;
    }
    // Strategy 2: Momentum + Regime Filter
    else if (isTrending && Math.abs(momentum - 50) > 15) {
      strategy = "MOMENTUM_REGIME";
      direction = momentum > 50 ? "CALL" : "PUT";

      if (direction === "CALL" && !outperformingSPY) return null;
      if (direction === "PUT" && !underperformingSPY) return null;

      conviction = 55 + Math.abs(momentum - 50) / 1.8;

      if (direction === "CALL") {
        if (relStrength > 70) conviction += 12;
        else if (relStrength > 55) conviction += 8;
      }
      if (direction === "PUT") {
        if (relStrength < 30) conviction += 12;
        else if (relStrength < 45) conviction += 8;
      }

      if (institutionalActivity) conviction += 9;
      if (direction === "CALL" && change > 3) conviction += 7;
      if (direction === "PUT" && change < -3) conviction += 7;

      if (avgRange > 0.25) conviction += 5;

      timeframe = 60;
      qualifier = `RS:${relStrength}`;
    }
    // Strategy 3: Relative Strength Divergence
    else if ((outperformingSPY && momentum > 55 && rsi < 60) || (underperformingSPY && momentum < 45 && rsi > 40)) {
      strategy = "RELATIVE_STRENGTH";
      direction = outperformingSPY ? "CALL" : "PUT";

      conviction = 56;

      const rsDivergence = Math.abs(relStrength - 50);
      if (rsDivergence > 15) conviction += 12;
      else if (rsDivergence > 8) conviction += 8;
      else conviction += 4;

      if (direction === "CALL" && rsi > 45 && rsi < 58) conviction += 7;
      if (direction === "PUT" && rsi < 55 && rsi > 42) conviction += 7;

      if (vol > 1.5) conviction += 8;
      else if (vol > 1.2) conviction += 5;

      if (direction === "CALL" && momentum > 60) conviction += 5;
      if (direction === "PUT" && momentum < 40) conviction += 5;

      timeframe = 45;
      qualifier = "RS Divergence";
    } else {
      return null;
    }

    conviction = Math.min(95, Math.max(50, conviction));

    // ============================================
    // VOLATILITY PENALTY - Reduce conviction for high ATR
    // ============================================
    let volatilityWarning: string | undefined;

    if (atrPercent > 13) {
      // Extreme volatility (penny stocks, micro caps)
      const penalty = Math.min(25, (atrPercent - 13) * 2.5);
      conviction -= penalty;
      volatilityWarning = "EXTREME";
      console.log(
        `💀 ${ticker}: Extreme volatility (${atrPercent.toFixed(1)}% ATR) - reducing conviction by ${penalty.toFixed(0)} points`,
      );
    } else if (atrPercent > 10) {
      // High volatility
      const penalty = Math.min(15, (atrPercent - 10) * 3);
      conviction -= penalty;
      volatilityWarning = "HIGH";
      console.log(
        `🔴 ${ticker}: High volatility (${atrPercent.toFixed(1)}% ATR) - reducing conviction by ${penalty.toFixed(0)} points`,
      );
    } else if (atrPercent > 8) {
      // Elevated volatility
      conviction -= 5;
      volatilityWarning = "ELEVATED";
      console.log(
        `🟡 ${ticker}: Elevated volatility (${atrPercent.toFixed(1)}% ATR) - reducing conviction by 5 points`,
      );
    }

    conviction = Math.max(50, Math.round(conviction));

    // Reject if ATR is impossibly high (data error protection)
    if (atrPercent > 25) {
      console.warn(`❌ Rejecting ${ticker}: ATR too extreme (${atrPercent.toFixed(1)}%) - likely data error`);
      return null;
    }

    let stopMultiple = 2.0;
    let targetMultiple = 3.0;

    if (strategy === "Z_SCORE_REVERSION") {
      targetMultiple = 2.5;
      stopMultiple = 1.8;
    } else if (atrPercent > 6) {
      stopMultiple = 1.5;
      targetMultiple = 2.8;
    } else if (atrPercent < 3) {
      stopMultiple = 2.2;
      targetMultiple = 3.5;
    }

    if (conviction > 85) {
      targetMultiple += 0.5;
    }

    let stopPrice: number;
    let targetPrice: number;
    let cappedTarget = false;

    if (direction === "CALL") {
      stopPrice = price - atr * stopMultiple;
      targetPrice = price + atr * targetMultiple;

      const maxTarget = price * 1.5;
      if (targetPrice > maxTarget) {
        targetPrice = maxTarget;
        cappedTarget = true;
      }
    } else {
      stopPrice = price + atr * stopMultiple;
      targetPrice = price - atr * targetMultiple;

      const minTarget = price * 0.7;
      if (targetPrice < minTarget) {
        targetPrice = minTarget;
        cappedTarget = true;
      }

      if (targetPrice < price * 0.2) {
        targetPrice = price * 0.2;
        cappedTarget = true;
      }
      if (targetPrice <= 0) {
        console.warn(`❌ Rejecting ${ticker} PUT: Invalid target price`);
        return null;
      }
    }

    let reward: number;
    let risk: number;

    if (direction === "CALL") {
      reward = targetPrice - price;
      risk = price - stopPrice;
    } else {
      reward = price - targetPrice;
      risk = stopPrice - price;
    }

    const rr = reward / risk;

    if (rr < 1.3 || risk <= 0 || reward <= 0) return null;

    const exitDate = new Date();
    exitDate.setDate(exitDate.getDate() + timeframe);

    const expectedMovePercent = Math.abs((targetPrice - price) / price) * 100;

    let strike: number;
    let estimatedDelta: number;

    if (expectedMovePercent < 5) {
      estimatedDelta = 0.7;

      if (direction === "CALL") {
        const targetStrike = price * 0.97;
        strike = this.roundStrike(targetStrike, "down");
      } else {
        const targetStrike = price * 1.05;
        strike = this.roundStrike(targetStrike, "up");
      }
    } else if (expectedMovePercent < 15) {
      estimatedDelta = 0.6;

      if (direction === "CALL") {
        strike = this.roundStrike(price, "nearest");
      } else {
        strike = this.roundStrike(price, "nearest");
      }
    } else {
      if (direction === "CALL") {
        estimatedDelta = 0.45;
        const targetStrike = price * 1.05;
        strike = this.roundStrike(targetStrike, "up");
      } else {
        estimatedDelta = 0.45;
        const targetStrike = price * 0.95; // ✅ OTM below price
        strike = this.roundStrike(targetStrike, "down");
      }
    }

    if (strategy === "Z_SCORE_REVERSION") {
      estimatedDelta = 0.7;

      if (direction === "CALL") {
        const targetStrike = price * 0.95;
        strike = this.roundStrike(targetStrike, "down");
      } else {
        const targetStrike = price * 1.05;
        strike = this.roundStrike(targetStrike, "up");
      }
    }

    const stockMovePercent = ((targetPrice - price) / price) * 100;
    const leverageFactor = 4.5;
    const estimatedOptionReturn = Math.abs(stockMovePercent) * estimatedDelta * leverageFactor;

    let riskTier: "Conservative" | "Moderate" | "Aggressive";
    if (expectedMovePercent < 8) {
      riskTier = "Conservative";
    } else if (expectedMovePercent < 15) {
      riskTier = "Moderate";
    } else {
      riskTier = "Aggressive";
    }

    const extremeZScore = Math.abs(zScore) > 3 || Math.abs(zScore20) > 3;

    let reasoning = "";
    let playType = "";

    // Determine play type based on strategy and delta
    if (strategy === "Z_SCORE_REVERSION") {
      playType = PLAY_TYPES.HIGH_PROBABILITY.label;
      
      reasoning = `**${playType}** (${PLAY_TYPES.HIGH_PROBABILITY.winRate} win rate, ${PLAY_TYPES.HIGH_PROBABILITY.profile})\n\n${ticker} is ${Math.abs(zScore).toFixed(1)}σ ${zScore < 0 ? "below" : "above"} its 50-day mean ($${mean50.toFixed(2)}). ${zScoreAccelerating ? "20-day z-score (" + zScore20.toFixed(1) + "σ) shows acceleration, confirming setup strength." : "20-day alignment validates signal."} Statistical mean reversion targets return to $${mean50.toFixed(2)} within ${timeframe} days. ${institutionalActivity ? "Institutional volume spike (" + vol.toFixed(1) + "x avg) confirms reversal setup. " : ""}\n\nUsing ITM $${strike} ${direction} (δ≈${estimatedDelta.toFixed(2)}) for higher probability of success. Target: ~${Math.round(estimatedOptionReturn)}% option return.${cappedTarget ? " Target capped at reasonable limit." : ""}`;

    } else if (strategy === "MOMENTUM_REGIME") {
      // Determine if it's a lottery ticket or home run based on expected move and delta
      if (estimatedDelta <= 0.45) {
        playType = PLAY_TYPES.LOTTERY_TICKET.label;
      } else {
        playType = PLAY_TYPES.HOME_RUN.label;
      }
      
      const playInfo = estimatedDelta <= 0.45 ? PLAY_TYPES.LOTTERY_TICKET : PLAY_TYPES.HOME_RUN;
      
      reasoning = `**${playType}** (${playInfo.winRate} win rate, ${playInfo.profile})\n\n${ticker} shows strong ${direction === "CALL" ? "bullish" : "bearish"} regime (momentum: ${momentum}) with ${relStrength > 50 ? "relative outperformance" : "relative underperformance"} vs SPY (RS: ${relStrength}). Trending environment (${(avgRange * 100).toFixed(1)}% 20d range) supports continuation. ${institutionalActivity ? "Institutional accumulation detected (" + vol.toFixed(1) + "x vol). " : ""}\n\n${timeframe}-day window targets ${targetMultiple.toFixed(1)}x ATR move. Using ${estimatedDelta <= 0.45 ? "OTM" : "ATM"} $${strike} ${direction} (δ≈${estimatedDelta.toFixed(2)}) for ${estimatedDelta <= 0.45 ? "maximum leverage" : "balanced exposure"}. Target: ~${Math.round(estimatedOptionReturn)}% option return.`;

    } else if (strategy === "RELATIVE_STRENGTH") {
      // RS plays are typically balanced or home runs
      if (estimatedDelta >= 0.60) {
        playType = PLAY_TYPES.BALANCED.label;
      } else {
        playType = PLAY_TYPES.HOME_RUN.label;
      }
      
      const playInfo = estimatedDelta >= 0.60 ? PLAY_TYPES.BALANCED : PLAY_TYPES.HOME_RUN;
      
      reasoning = `**${playType}** (${playInfo.winRate} win rate, ${playInfo.profile})\n\n${ticker} displays ${relStrength > 50 ? "superior" : "inferior"} relative strength (${relStrength}) vs market while maintaining healthy RSI (${rsi}). This divergence suggests ${direction === "CALL" ? "institutional accumulation" : "distribution"} not yet reflected in momentum. ${vol > 1.2 ? "Volume confirmation (" + vol.toFixed(1) + "x) validates. " : ""}\n\nTarget: ${targetMultiple.toFixed(1)}x ATR = $${targetPrice.toFixed(2)}. Using ${estimatedDelta >= 0.60 ? "ATM" : "OTM"} $${strike} ${direction} (δ≈${estimatedDelta.toFixed(2)}) for ${estimatedDelta >= 0.60 ? "consistent execution" : "leveraged exposure"}. Target: ~${Math.round(estimatedOptionReturn)}% option return.`;
    }

    return {
      ticker,
      company: COMPANY_NAMES[ticker] || ticker,
      direction,
      strategy,
      conviction: Math.round(conviction),
      entry: price,
      target: targetPrice,
      stop: stopPrice,
      rr,
      strike,
      exitDate,
      days: timeframe,
      position: Math.round(position52),
      rsi: Math.round(rsi),
      momentum,
      vol,
      zScore: zScore.toFixed(2),
      zScore20: zScore20.toFixed(2),
      relStrength,
      atr: atr.toFixed(2),
      atrPercent: parseFloat(atrPercent.toFixed(2)),
      regime: isChopping ? "CHOPPY" : isTrending ? "TRENDING" : "NEUTRAL",
      qualifier,
      reasoning,
      estimatedOptionReturn: Math.round(estimatedOptionReturn),
      estimatedDelta: parseFloat(estimatedDelta.toFixed(2)),
      extremeZScore,
      riskTier,
      daysToExpiration: timeframe,
      volatilityWarning, // ✅ Add volatility warning
    };
  }

  /**
   * Batch process multiple tickers
   */
  static batchCalculate(tickersData: EODHDData[], spyData: EODHDData): StockMetrics[] {
    return tickersData
      .map((tickerData) => {
        try {
          return this.calculateMetrics(tickerData, spyData);
        } catch (error) {
          console.error(`Error processing ${tickerData.ticker}:`, error);
          return null;
        }
      })
      .filter((m): m is StockMetrics => m !== null);
  }
}
