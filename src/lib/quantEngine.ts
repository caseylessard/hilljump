import type { EODHDData, StockMetrics, TradingSignal, EarningsHistory } from "@/types/scanner";
import { COMPANY_NAMES } from "./constants";

export class QuantEngine {
  /**
   * Calculate all metrics from raw EODHD data
   */
  static calculateMetrics(tickerData: EODHDData, spyData?: EODHDData): StockMetrics {
    const closes = tickerData.historicalPrices.map((d) => d.close).reverse();
    const volumes = tickerData.historicalPrices.map((d) => d.volume).reverse();
    const highs = tickerData.historicalPrices.map((d) => d.high).reverse();
    const lows = tickerData.historicalPrices.map((d) => d.low).reverse();

    // After reversing, index 0 is the most recent price
    const currentPrice = closes[0];

    return {
      ticker: tickerData.ticker,
      currentPrice,

      // After reversing, take from the beginning for most recent data
      prices20d: closes.slice(0, 20),
      prices50d: closes.slice(0, 50),
      prices100d: closes.slice(0, 100),

      rsi: this.calculateRSI(closes, 14),
      momentumScore: this.calculateMomentum(closes, 20),
      priceChangePercent: this.calculatePriceChange(closes, 1),

      volumeRatio: this.calculateVolumeRatio(volumes, 20),
      volumeTrend: this.calculateVolumeTrend(volumes, 10),

      atr: this.calculateATR(highs, lows, closes, 14),

      // Take most recent 252 days (1 year) for 52-week high/low
      high52Week: Math.max(...closes.slice(0, Math.min(252, closes.length))),
      low52Week: Math.min(...closes.slice(0, Math.min(252, closes.length))),

      relativeStrength: spyData
        ? this.calculateRelativeStrength(closes, spyData.historicalPrices.map((d) => d.close).reverse(), 50)
        : 50,
    };
  }

  /**
   * Calculate RSI (Relative Strength Index)
   * Closes array is newest-first after reversal
   */
  private static calculateRSI(closes: number[], period = 14): number {
    if (closes.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    // Process most recent 'period' days (indices 0 to period)
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
   * Closes array is newest-first after reversal
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
   * Closes array is newest-first after reversal
   */
  private static calculatePriceChange(closes: number[], periods = 1): number {
    if (closes.length < periods + 1) return 0;

    const currentPrice = closes[0];
    const oldPrice = closes[periods];

    return ((currentPrice - oldPrice) / oldPrice) * 100;
  }

  /**
   * Calculate volume ratio (current vs average)
   * Volumes array is newest-first after reversal
   */
  private static calculateVolumeRatio(volumes: number[], period = 20): number {
    if (volumes.length < period + 1) return 1.0;

    // After reversal: index 0 is newest, so we need to skip it for historical average
    const recentVolumes = volumes.slice(1, period + 1); // Skip current, take next 'period' days
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / period;
    const currentVolume = volumes[0]; // Most recent volume

    if (avgVolume === 0) return 1.0;

    return currentVolume / avgVolume;
  }

  /**
   * Determine volume trend direction
   * Volumes array is newest-first after reversal
   */
  private static calculateVolumeTrend(volumes: number[], period = 10): "increasing" | "decreasing" | "neutral" {
    if (volumes.length < period * 2) return "neutral";

    // After reversal: index 0 is newest
    const recent = volumes.slice(0, period); // Most recent 'period' days
    const previous = volumes.slice(period, period * 2); // Previous 'period' days (older)

    const recentAvg = recent.reduce((a, b) => a + b, 0) / period;
    const previousAvg = previous.reduce((a, b) => a + b, 0) / period;

    const change = (recentAvg - previousAvg) / previousAvg;

    if (change > 0.15) return "increasing";
    if (change < -0.15) return "decreasing";
    return "neutral";
  }

  /**
   * Calculate Average True Range (ATR) - 14 period standard
   * Arrays are newest-first after reversal
   */
  private static calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number {
    if (highs.length < period + 1) {
      const currentPrice = closes[0];
      return currentPrice * 0.02; // Default 2% if not enough data
    }

    const trueRanges: number[] = [];

    // Start from index 1 (second newest) because we need previous close
    // Calculate TR for the most recent 'period' bars
    for (let i = 1; i <= period; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i + 1]; // ✓ Correct - the day BEFORE the bar

      const tr = Math.max(
        high - low, // Today's range
        Math.abs(high - prevClose), // Gap up from previous close
        Math.abs(low - prevClose), // Gap down from previous close
      );

      trueRanges.push(tr);
    }

    const atr = trueRanges.reduce((a, b) => a + b, 0) / period;
    const currentPrice = closes[0];
    const atrPercent = (atr / currentPrice) * 100;

    // SANITY CHECK: ATR should normally be 2-5% of price
    if (atrPercent > 10) {
      console.warn(
        `⚠️ Suspicious ATR for price ${currentPrice}: ATR=$${atr.toFixed(2)} (${atrPercent.toFixed(1)}%) - capping at 8%`,
      );
      return currentPrice * 0.08; // Cap at 8%
    }

    return atr;
  }

  /**
   * Calculate Relative Strength vs SPY
   * Both arrays are newest-first after reversal
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
      // Round to nearest $1
      return direction === "up" ? Math.ceil(price) : direction === "down" ? Math.floor(price) : Math.round(price);
    } else if (price < 200) {
      // Round to nearest $5
      return direction === "up"
        ? Math.ceil(price / 5) * 5
        : direction === "down"
          ? Math.floor(price / 5) * 5
          : Math.round(price / 5) * 5;
    } else {
      // Round to nearest $10
      return direction === "up"
        ? Math.ceil(price / 10) * 10
        : direction === "down"
          ? Math.floor(price / 10) * 10
          : Math.round(price / 10) * 10;
    }
  }

  /**
   * ============================================
   * PHASE 1 + 2: EARNINGS ENRICHMENT
   * ============================================
   * Fetch earnings data and enrich signal with:
   * - Next earnings date
   * - Historical beat rate
   * - Adjusted conviction
   * - Warnings and adjusted expiry
   */
  static async enrichWithEarnings(signal: TradingSignal, apiKey: string): Promise<TradingSignal> {
    try {
      const ticker = signal.ticker;

      // Fetch fundamentals data from EODHD
      const response = await fetch(`https://eodhd.com/api/fundamentals/${ticker}.US?api_token=${apiKey}`);

      if (!response.ok) {
        console.warn(`Failed to fetch earnings data for ${ticker}`);
        return signal;
      }

      const data = await response.json();

      // Extract earnings date and time
      const earningsCalendar = data?.Earnings?.History;
      const nextEarnings = data?.Earnings?.Trend;

      let earningsDate: string | undefined;
      let earningsTime: string | undefined;

      // Try to get next earnings date from trend data
      if (nextEarnings && Object.keys(nextEarnings).length > 0) {
        const dates = Object.keys(nextEarnings).sort();
        const futureDate = dates.find((d) => new Date(d) > new Date());
        if (futureDate) {
          earningsDate = futureDate;
          earningsTime = nextEarnings[futureDate]?.time || "time-not-supplied";
        }
      }

      // Calculate days to earnings
      const daysToEarnings = earningsDate
        ? Math.ceil((new Date(earningsDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

      // PHASE 2: Calculate beat rates from historical data
      let epsBeatRate: number | undefined;
      let revenueBeatRate: number | undefined;

      if (earningsCalendar && Array.isArray(earningsCalendar)) {
        // Take last 8 quarters
        const recentEarnings = earningsCalendar.slice(0, 8);

        let epsBeats = 0;
        let revenueBeats = 0;
        let epsCount = 0;
        let revenueCount = 0;

        recentEarnings.forEach((quarter: any) => {
          if (quarter.epsEstimate !== null && quarter.epsActual !== null) {
            epsCount++;
            if (quarter.epsActual >= quarter.epsEstimate) epsBeats++;
          }
          if (quarter.revenueEstimate !== null && quarter.revenueActual !== null) {
            revenueCount++;
            if (quarter.revenueActual >= quarter.revenueEstimate) revenueBeats++;
          }
        });

        epsBeatRate = epsCount > 0 ? (epsBeats / epsCount) * 100 : undefined;
        revenueBeatRate = revenueCount > 0 ? (revenueBeats / revenueCount) * 100 : undefined;
      }

      // PHASE 1: Apply earnings-based adjustments
      const warnings: string[] = [];
      let adjustedConviction = signal.conviction;
      let suggestedExpiry = signal.exitDate;

      if (daysToEarnings !== undefined) {
        if (daysToEarnings < 0) {
          // Earnings already passed
          // No adjustment needed
        } else if (daysToEarnings < 7) {
          // CRITICAL: Very close to earnings
          warnings.push(`⚠️ Earnings in ${daysToEarnings}d - High IV crush risk`);
          adjustedConviction = Math.max(50, adjustedConviction - 15);
        } else if (daysToEarnings <= 21) {
          // Earnings window - potential catalyst
          const earningsTiming =
            earningsTime === "bmo" ? "before market" : earningsTime === "amc" ? "after market" : "";
          warnings.push(`📊 Earnings in ${daysToEarnings}d ${earningsTiming ? `(${earningsTiming})` : ""}`);

          // PHASE 2: Boost conviction if beat rate is high
          if (epsBeatRate && epsBeatRate >= 75) {
            warnings.push(`📈 Strong beat history (${Math.round(epsBeatRate)}% EPS beats)`);
            adjustedConviction = Math.min(95, adjustedConviction + 5);
          }

          // Suggest expiry 7-10 days after earnings to capture move
          suggestedExpiry = new Date(earningsDate!);
          suggestedExpiry.setDate(suggestedExpiry.getDate() + 7);

          warnings.push(
            `💡 Consider ${suggestedExpiry.toLocaleDateString("en-US", { month: "short", day: "numeric" })} expiry`,
          );
        }
      }

      // PHASE 2: Boost conviction for consistent beaters (regardless of earnings timing)
      if (epsBeatRate && epsBeatRate >= 87.5) {
        // 7/8 or 8/8 beats = very consistent
        adjustedConviction = Math.min(95, adjustedConviction + 8);
      } else if (epsBeatRate && epsBeatRate >= 75) {
        // 6/8 beats = solid
        adjustedConviction = Math.min(95, adjustedConviction + 5);
      }

      return {
        ...signal,
        conviction: Math.round(adjustedConviction),
        earningsDate,
        daysToEarnings,
        earningsTime,
        epsBeatRate: epsBeatRate ? Math.round(epsBeatRate) : undefined,
        revenueBeatRate: revenueBeatRate ? Math.round(revenueBeatRate) : undefined,
        earningsWarnings: warnings.length > 0 ? warnings : undefined,
        suggestedExpiry:
          daysToEarnings !== undefined && daysToEarnings > 0 && daysToEarnings <= 21 ? suggestedExpiry : undefined,
      };
    } catch (error) {
      console.error(`Error enriching ${signal.ticker} with earnings:`, error);
      return signal;
    }
  }

  /**
   * Generate trading signal from metrics
   */
  static calculateSignal(data: StockMetrics): TradingSignal | null {
    const price = data.currentPrice;
    const ticker = data.ticker.replace(".US", "");

    // ============================================
    // DATA QUALITY FILTERS
    // ============================================

    // Reject penny stocks and data errors
    if (price < 1.0) {
      console.warn(`❌ Rejecting ${ticker}: Price too low ($${price.toFixed(2)})`);
      return null;
    }

    // Reject if price seems like stale/corrupt data
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

    if (atrPercent > 10) {
      console.warn(`❌ Rejecting signal for ${ticker}: ATR too high (${atrPercent.toFixed(1)}%)`);
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
        const targetStrike = price * 1.03;
        strike = this.roundStrike(targetStrike, "up");
      }
    } else {
      if (direction === "CALL") {
        estimatedDelta = 0.45;
        const targetStrike = price * 1.05;
        strike = this.roundStrike(targetStrike, "up");
      } else {
        estimatedDelta = 0.55;
        const targetStrike = price * 1.02;
        strike = this.roundStrike(targetStrike, "up");
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

    if (strategy === "Z_SCORE_REVERSION") {
      reasoning = `${ticker} is ${Math.abs(zScore).toFixed(1)}σ ${zScore < 0 ? "below" : "above"} its 50-day mean ($${mean50.toFixed(2)}). ${zScoreAccelerating ? "20-day z-score (" + zScore20.toFixed(1) + "σ) shows acceleration, confirming setup strength." : "20-day alignment validates signal."} Statistical mean reversion targets return to $${mean50.toFixed(2)} within ${timeframe} days. ${institutionalActivity ? "Institutional volume spike (" + vol.toFixed(1) + "x avg) confirms reversal setup. " : ""}Strike: $${strike} ${direction} (δ≈${estimatedDelta.toFixed(2)}) targeting ~${Math.round(estimatedOptionReturn)}% option return.${cappedTarget ? " Target capped at reasonable limit." : ""}`;
    } else if (strategy === "MOMENTUM_REGIME") {
      reasoning = `${ticker} shows strong ${direction === "CALL" ? "bullish" : "bearish"} regime (momentum: ${momentum}) with ${relStrength > 50 ? "relative outperformance" : "relative underperformance"} vs SPY (RS: ${relStrength}). Trending environment (${(avgRange * 100).toFixed(1)}% 20d range) supports continuation. ${institutionalActivity ? "Institutional accumulation detected (" + vol.toFixed(1) + "x vol). " : ""}${timeframe}-day window targets ${targetMultiple.toFixed(1)}x ATR move. $${strike} ${direction} (δ≈${estimatedDelta.toFixed(2)}) targets ~${Math.round(estimatedOptionReturn)}% option return.`;
    } else if (strategy === "RELATIVE_STRENGTH") {
      reasoning = `${ticker} displays ${relStrength > 50 ? "superior" : "inferior"} relative strength (${relStrength}) vs market while maintaining healthy RSI (${rsi}). This divergence suggests ${direction === "CALL" ? "institutional accumulation" : "distribution"} not yet reflected in momentum. ${vol > 1.2 ? "Volume confirmation (" + vol.toFixed(1) + "x) validates. " : ""}Target: ${targetMultiple.toFixed(1)}x ATR = $${targetPrice.toFixed(2)}. $${strike} ${direction} (δ≈${estimatedDelta.toFixed(2)}) targets ~${Math.round(estimatedOptionReturn)}% option return.`;
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
