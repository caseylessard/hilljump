import type { EODHDData, StockMetrics, TradingSignal } from '@/types/scanner';
import { COMPANY_NAMES } from './constants';

export class QuantEngine {
  /**
   * Calculate all metrics from raw EODHD data
   */
  static calculateMetrics(tickerData: EODHDData, spyData?: EODHDData): StockMetrics {
    const closes = tickerData.historicalPrices.map(d => d.close).reverse();
    const volumes = tickerData.historicalPrices.map(d => d.volume).reverse();
    const highs = tickerData.historicalPrices.map(d => d.high).reverse();
    const lows = tickerData.historicalPrices.map(d => d.low).reverse();
    
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
      
      relativeStrength: spyData ? 
        this.calculateRelativeStrength(closes, spyData.historicalPrices.map(d => d.close).reverse(), 50) : 
        50,
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
     const rsi = 100 - (100 / (1 + rs));
     
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
   */
  private static calculateVolumeRatio(volumes: number[], period = 20): number {
    if (volumes.length < period + 1) return 1.0;
    
    const recentVolumes = volumes.slice(-period - 1, -1);
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / period;
    const currentVolume = volumes[volumes.length - 1];
    
    if (avgVolume === 0) return 1.0;
    
    return currentVolume / avgVolume;
  }

  /**
   * Determine volume trend direction
   */
  private static calculateVolumeTrend(volumes: number[], period = 10): 'increasing' | 'decreasing' | 'neutral' {
    if (volumes.length < period * 2) return 'neutral';
    
    const recent = volumes.slice(-period);
    const previous = volumes.slice(-period * 2, -period);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / period;
    const previousAvg = previous.reduce((a, b) => a + b, 0) / period;
    
    const change = (recentAvg - previousAvg) / previousAvg;
    
    if (change > 0.15) return 'increasing';
    if (change < -0.15) return 'decreasing';
    return 'neutral';
  }

  /**
   * Calculate Average True Range (ATR)
   */
  private static calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number {
    if (highs.length < period + 1) {
      const currentPrice = closes[closes.length - 1];
      return currentPrice * 0.02;
    }
    
    const trueRanges: number[] = [];
    
    for (let i = highs.length - period; i < highs.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      
      trueRanges.push(tr);
    }
    
    return trueRanges.reduce((a, b) => a + b, 0) / period;
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
     const normalized = 50 + (relativeReturn * 250);
     
     return Math.max(0, Math.min(100, Math.round(normalized)));
   }

  /**
   * Generate trading signal from metrics
   */
  static calculateSignal(data: StockMetrics): TradingSignal | null {
    const price = data.currentPrice;
    const ticker = data.ticker.replace('.US', '');

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
    const institutionalActivity = vol > 1.5 && volTrend === 'increasing';

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

    let strategy: TradingSignal['strategy'] | null = null;
    let direction: 'CALL' | 'PUT' | null = null;
    let conviction = 0;
    let timeframe = 45;
    let qualifier = '';

    // Strategy 1: Z-Score Mean Reversion
    if (Math.abs(zScore) >= 2.0 && !isTrending) {
      strategy = 'Z_SCORE_REVERSION';
      direction = zScore < -2.0 ? 'CALL' : 'PUT';
      
      conviction = 60 + (Math.abs(zScore) - 2.0) * 10;
      
      if (zScoreAccelerating) conviction += 8;
      if (!isChopping) conviction += 5;
      if (institutionalActivity) conviction += 8;
      if (direction === 'CALL' && rsi < 35) conviction += 7;
      if (direction === 'PUT' && rsi > 65) conviction += 7;
      
      timeframe = Math.abs(zScore) > 2.5 ? 30 : 45;
      qualifier = `${Math.abs(zScore).toFixed(1)}σ (50d)${zScoreAccelerating ? ' 🔥' : ''}`;
    }
    // Strategy 2: Momentum + Regime Filter
    else if (isTrending && Math.abs(momentum - 50) > 15) {
      strategy = 'MOMENTUM_REGIME';
      direction = momentum > 50 ? 'CALL' : 'PUT';
      
      if (direction === 'CALL' && !outperformingSPY) return null;
      if (direction === 'PUT' && !underperformingSPY) return null;
      
      conviction = 55 + Math.abs(momentum - 50) / 2;
      
      if (direction === 'CALL' && relStrength > 55) conviction += 8;
      if (direction === 'PUT' && relStrength < 45) conviction += 8;
      if (institutionalActivity) conviction += 7;
      if (direction === 'CALL' && change > 2) conviction += 5;
      if (direction === 'PUT' && change < -2) conviction += 5;
      
      timeframe = 60;
      qualifier = `RS:${relStrength}`;
    }
    // Strategy 3: Relative Strength Divergence
    else if ((outperformingSPY && momentum > 55 && rsi < 60) || 
             (underperformingSPY && momentum < 45 && rsi > 40)) {
      strategy = 'RELATIVE_STRENGTH';
      direction = outperformingSPY ? 'CALL' : 'PUT';
      
      conviction = 58;
      
      if (Math.abs(relStrength - 50) > 8) conviction += 8;
      if (direction === 'CALL' && rsi > 45 && rsi < 60) conviction += 6;
      if (direction === 'PUT' && rsi < 55 && rsi > 40) conviction += 6;
      if (vol > 1.2) conviction += 5;
      
      timeframe = 45;
      qualifier = 'RS Divergence';
    }
    else {
      return null;
    }

    // Allow conviction to vary between 50-95%
    conviction = Math.min(95, Math.max(50, conviction));

    // ATR-based targets & stops (FIXED: Using 2x ATR for stops as requested)
    const targetMultiple = strategy === 'Z_SCORE_REVERSION' ? 2.5 : 3.0;
    
    // CRITICAL FIX: Stops FIRST, then targets, then R/R calculation
    // For CALLS: Stop below entry, target above entry
    // For PUTS: Stop above entry, target below entry
    let stopPrice: number;
    let targetPrice: number;
    
    if (direction === 'CALL') {
      stopPrice = price - (atr * 2);
      targetPrice = price + (atr * targetMultiple);
    } else {
      // PUT
      stopPrice = price + (atr * 2);
      targetPrice = price - (atr * targetMultiple);
      
      // Ensure target price is never negative or too low
      if (targetPrice < price * 0.2) {
        // If target would be below 20% of entry, adjust to 20% of entry
        targetPrice = price * 0.2;
      }
      if (targetPrice <= 0) {
        // Skip signals with invalid targets
        return null;
      }
    }

    // Calculate ACTUAL risk/reward ratio based on direction
    let reward: number;
    let risk: number;
    
    if (direction === 'CALL') {
      reward = targetPrice - price;  // How much we can gain
      risk = price - stopPrice;       // How much we can lose
    } else {
      // PUT
      reward = price - targetPrice;   // How much we can gain (entry - target)
      risk = stopPrice - price;       // How much we can lose (stop - entry)
    }
    
    const rr = reward / risk;

    // Only require R/R > 1.5
    if (rr < 1.5 || risk <= 0 || reward <= 0) return null;

    const exitDate = new Date();
    exitDate.setDate(exitDate.getDate() + timeframe);

    // Calculate expected stock move percentage
    const expectedMovePercent = Math.abs((targetPrice - price) / price) * 100;

    // Smart strike selection based on expected move
    let strike: number;
    let estimatedDelta: number;
    
    if (expectedMovePercent < 5) {
      // Small move: Use ATM or slightly ITM strikes (delta ~0.60-0.70)
      estimatedDelta = 0.65;
      if (direction === 'CALL') {
        // For calls, use ATM or slightly ITM
        if (price < 50) {
          strike = Math.floor(price);
        } else if (price < 200) {
          strike = Math.floor(price / 5) * 5;
        } else {
          strike = Math.floor(price / 10) * 10;
        }
      } else {
        // For puts with small moves, use ATM or slightly OTM (closer to current price)
        if (price < 50) {
          strike = Math.ceil(price);
        } else if (price < 200) {
          strike = Math.ceil(price / 5) * 5;
        } else {
          strike = Math.ceil(price / 10) * 10;
        }
      }
    } else if (expectedMovePercent < 15) {
      // Medium move: Use ATM strikes (delta ~0.50-0.55)
      estimatedDelta = 0.55;
      if (price < 50) {
        strike = Math.round(price);
      } else if (price < 200) {
        strike = Math.round(price / 5) * 5;
      } else {
        strike = Math.round(price / 10) * 10;
      }
    } else {
      // Large move: Use slightly OTM strikes (delta ~0.40-0.45)
      estimatedDelta = 0.45;
      if (direction === 'CALL') {
        const targetStrike = price * 1.05; // 5% OTM
        if (price < 50) {
          strike = Math.ceil(targetStrike);
        } else if (price < 200) {
          strike = Math.ceil(targetStrike / 5) * 5;
        } else {
          strike = Math.ceil(targetStrike / 10) * 10;
        }
      } else {
        const targetStrike = price * 0.95; // 5% OTM
        if (price < 50) {
          strike = Math.floor(targetStrike);
        } else if (price < 200) {
          strike = Math.floor(targetStrike / 5) * 5;
        } else {
          strike = Math.floor(targetStrike / 10) * 10;
        }
      }
    }

    // Calculate estimated option return
    const stockMovePercent = ((targetPrice - price) / price) * 100;
    const leverageFactor = 4; // Options typically provide 3-5x leverage
    const estimatedOptionReturn = Math.abs(stockMovePercent) * estimatedDelta * leverageFactor;

    // Flag extreme z-scores (beyond ±3σ)
    const extremeZScore = Math.abs(zScore) > 3 || Math.abs(zScore20) > 3;

    // Reasoning
    let reasoning = '';
    
    if (strategy === 'Z_SCORE_REVERSION') {
      reasoning = `${ticker} is ${Math.abs(zScore).toFixed(1)}σ ${zScore < 0 ? 'below' : 'above'} its 50-day mean ($${mean50.toFixed(2)}). ${zScoreAccelerating ? '20-day z-score (' + zScore20.toFixed(1) + 'σ) shows acceleration, confirming setup strength.' : '20-day alignment validates signal.'} Statistical mean reversion targets return to $${mean50.toFixed(2)} within ${timeframe} days. ${institutionalActivity ? 'Institutional volume spike (' + vol.toFixed(1) + 'x avg) confirms reversal setup.' : 'Standard volume conditions.'} ATR: $${atr.toFixed(2)} (${atrPercent.toFixed(1)}%) sets stop at 2x ATR = $${(atr * 2).toFixed(2)}.`;
    }
    else if (strategy === 'MOMENTUM_REGIME') {
      reasoning = `${ticker} shows strong ${direction === 'CALL' ? 'bullish' : 'bearish'} regime (momentum: ${momentum}) with ${relStrength > 50 ? 'relative outperformance' : 'relative underperformance'} vs SPY (RS: ${relStrength}). Trending environment (${(avgRange * 100).toFixed(1)}% 20d range) supports continuation. ${institutionalActivity ? 'Institutional accumulation detected.' : ''} ${timeframe}-day window targets ${targetMultiple}x ATR move.`;
    }
    else if (strategy === 'RELATIVE_STRENGTH') {
      reasoning = `${ticker} displays ${relStrength > 50 ? 'superior' : 'inferior'} relative strength (${relStrength}) vs market while maintaining healthy RSI (${rsi}). This divergence suggests ${direction === 'CALL' ? 'institutional accumulation' : 'distribution'} not yet reflected in momentum. ${vol > 1.2 ? 'Volume confirmation (' + vol.toFixed(1) + 'x) validates.' : ''} Target: ${targetMultiple}x ATR = $${targetPrice.toFixed(2)}.`;
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
      regime: isChopping ? 'CHOPPY' : isTrending ? 'TRENDING' : 'NEUTRAL',
      qualifier,
      reasoning,
      estimatedOptionReturn: Math.round(estimatedOptionReturn),
      estimatedDelta: parseFloat(estimatedDelta.toFixed(2)),
      extremeZScore
    };
  }

  /**
   * Batch process multiple tickers
   */
  static batchCalculate(tickersData: EODHDData[], spyData: EODHDData): StockMetrics[] {
    return tickersData.map(tickerData => {
      try {
        return this.calculateMetrics(tickerData, spyData);
      } catch (error) {
        console.error(`Error processing ${tickerData.ticker}:`, error);
        return null;
      }
    }).filter((m): m is StockMetrics => m !== null);
  }
}
