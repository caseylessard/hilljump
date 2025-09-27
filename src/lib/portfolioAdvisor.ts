import { supabase } from "@/integrations/supabase/client";

export interface PortfolioPosition {
  ticker: string;
  shares: number;
  currentValue: number;
  currentPrice: number;
  dripScore: number;
  dripRawScore: number;
  rankingPosition?: number | null;
  yieldTTM?: number;
  strategy?: string;
  riskScore?: number;
}

export interface TargetRecommendation {
  ticker: string;
  currentValue: number;
  targetValue: number;
  targetShares: number;
  action: 'HOLD' | 'INCREASE' | 'DECREASE' | 'SELL';
  reason: string;
  confidence: number; // 0-100
}

export interface NewETFRecommendation {
  ticker: string;
  targetValue: number;
  targetShares: number;
  reason: string;
  confidence: number;
  rankingPosition?: number;
  yieldTTM?: number;
  strategy?: string;
}

export interface AIPortfolioAdvice {
  targetRecommendations: TargetRecommendation[];
  newETFRecommendations: NewETFRecommendation[];
  portfolioAnalysis: {
    totalValue: number;
    diversificationScore: number; // 0-100
    riskScore: number; // 0-100
    yieldBalance: number; // 0-100
    trendAlignment: number; // 0-100
    recommendations: string[];
  };
}

export class AIPortfolioAdvisor {
  private etfData: any;
  private cachedPrices: any;
  private frozenRankings: any;

  constructor(etfData: any, cachedPrices: any, frozenRankings: any) {
    this.etfData = etfData;
    this.cachedPrices = cachedPrices;
    this.frozenRankings = frozenRankings;
  }

  async analyzePortfolio(positions: PortfolioPosition[]): Promise<AIPortfolioAdvice> {
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    
    // Calculate portfolio metrics
    const diversificationScore = this.calculateDiversificationScore(positions);
    const riskScore = this.calculateRiskScore(positions);
    const yieldBalance = this.calculateYieldBalance(positions);
    const trendAlignment = this.calculateTrendAlignment(positions);

    // Generate target recommendations for existing positions
    const targetRecommendations = await this.generateTargetRecommendations(positions, totalValue);

    // Generate new ETF recommendations
    const newETFRecommendations = await this.generateNewETFRecommendations(positions, totalValue);

    // Generate overall portfolio recommendations
    const recommendations = this.generatePortfolioRecommendations(
      diversificationScore,
      riskScore,
      yieldBalance,
      trendAlignment,
      positions.length
    );

    return {
      targetRecommendations,
      newETFRecommendations,
      portfolioAnalysis: {
        totalValue,
        diversificationScore,
        riskScore,
        yieldBalance,
        trendAlignment,
        recommendations
      }
    };
  }

  private calculateDiversificationScore(positions: PortfolioPosition[]): number {
    if (positions.length === 0) return 0;
    
    // Check for strategy diversity
    const strategies = new Set(positions.map(p => p.strategy || 'unknown'));
    const strategyDiversity = Math.min(strategies.size / 5, 1) * 40; // Up to 40 points for strategy diversity

    // Check for position balance (no single position > 40% of portfolio)
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    const maxAllocation = Math.max(...positions.map(p => p.currentValue / totalValue));
    const balanceScore = maxAllocation < 0.4 ? 30 : Math.max(0, 30 * (1 - (maxAllocation - 0.4) / 0.3));

    // Position count score (optimal 8-15 positions)
    const positionCountScore = positions.length >= 8 && positions.length <= 15 ? 30 : 
                              positions.length < 8 ? positions.length * 3.75 : Math.max(0, 30 - (positions.length - 15) * 2);

    return Math.round(strategyDiversity + balanceScore + positionCountScore);
  }

  private calculateRiskScore(positions: PortfolioPosition[]): number {
    if (positions.length === 0) return 50;
    
    // Lower risk score means lower risk portfolio
    const avgRisk = positions.reduce((sum, p) => sum + (p.riskScore || 50), 0) / positions.length;
    
    // Penalize concentration in high-risk positions
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    const highRiskExposure = positions
      .filter(p => (p.riskScore || 50) > 70)
      .reduce((sum, p) => sum + p.currentValue, 0) / totalValue;
    
    const concentrationPenalty = highRiskExposure > 0.5 ? 20 : 0;
    
    return Math.round(avgRisk + concentrationPenalty);
  }

  private calculateYieldBalance(positions: PortfolioPosition[]): number {
    if (positions.length === 0) return 50;
    
    const yields = positions.map(p => p.yieldTTM || 0).filter(y => y > 0);
    if (yields.length === 0) return 50;

    const avgYield = yields.reduce((sum, y) => sum + y, 0) / yields.length;
    
    // Optimal yield range: 6-15%
    if (avgYield >= 6 && avgYield <= 15) return 85;
    if (avgYield >= 4 && avgYield <= 20) return 70;
    if (avgYield >= 2 && avgYield <= 25) return 55;
    
    return 35; // Very low or extremely high yields
  }

  private calculateTrendAlignment(positions: PortfolioPosition[]): number {
    if (positions.length === 0) return 50;
    
    const buySignals = positions.filter(p => p.dripScore === 1).length;
    const sellSignals = positions.filter(p => p.dripScore === -1).length;
    const holdSignals = positions.filter(p => p.dripScore === 0).length;
    
    const buyRatio = buySignals / positions.length;
    const sellRatio = sellSignals / positions.length;
    
    // Prefer portfolio with more BUY signals and fewer SELL signals
    return Math.round(buyRatio * 60 + (1 - sellRatio) * 40);
  }

  private async generateTargetRecommendations(
    positions: PortfolioPosition[], 
    totalValue: number
  ): Promise<TargetRecommendation[]> {
    
    return positions.map(position => {
      const currentAllocation = position.currentValue / totalValue;
      let targetAllocation = currentAllocation; // Start with current allocation
      let action: TargetRecommendation['action'] = 'HOLD';
      let reason = 'Maintain current position';
      let confidence = 60;

      // AI decision logic based on DRIP signals and ranking
      if (position.dripScore === 1) { // BUY signal
        if (position.rankingPosition && position.rankingPosition <= 10) {
          // Top 10 ranked ETF with BUY signal - increase significantly
          targetAllocation = Math.min(currentAllocation * 1.5, 0.25); // Up to 25% max
          action = 'INCREASE';
          reason = `Strong BUY signal (rank #${position.rankingPosition}). Excellent momentum and fundamentals.`;
          confidence = 90;
        } else if (position.rankingPosition && position.rankingPosition <= 25) {
          // Top 25 with BUY signal - moderate increase
          targetAllocation = Math.min(currentAllocation * 1.25, 0.20);
          action = 'INCREASE';
          reason = `BUY signal with solid ranking (#${position.rankingPosition}). Good growth potential.`;
          confidence = 75;
        } else {
          // Lower ranked BUY signal - small increase or hold
          targetAllocation = Math.min(currentAllocation * 1.1, 0.15);
          action = currentAllocation < 0.05 ? 'INCREASE' : 'HOLD';
          reason = 'BUY signal but lower ranking. Conservative increase suggested.';
          confidence = 65;
        }
      } else if (position.dripScore === -1) { // SELL signal
        if (currentAllocation > 0.15) {
          // Large position with SELL signal - significant reduction
          targetAllocation = Math.max(currentAllocation * 0.4, 0.02);
          action = 'DECREASE';
          reason = 'SELL signal on large position. Reduce exposure significantly.';
          confidence = 85;
        } else if (currentAllocation > 0.05) {
          // Medium position with SELL signal - moderate reduction
          targetAllocation = Math.max(currentAllocation * 0.6, 0.01);
          action = 'DECREASE';
          reason = 'SELL signal. Consider reducing position size.';
          confidence = 75;
        } else {
          // Small position with SELL signal - eliminate or reduce to minimum
          targetAllocation = 0;
          action = 'SELL';
          reason = 'SELL signal on small position. Consider full exit.';
          confidence = 80;
        }
      } else { // HOLD signal (0)
        if (position.rankingPosition && position.rankingPosition <= 15) {
          // Well-ranked HOLD position
          targetAllocation = Math.min(currentAllocation * 1.1, 0.18);
          action = 'HOLD';
          reason = `HOLD signal with good ranking (#${position.rankingPosition}). Stable position.`;
          confidence = 70;
        } else {
          // Lower-ranked HOLD position
          if (currentAllocation > 0.12) {
            targetAllocation = currentAllocation * 0.9;
            action = 'DECREASE';
            reason = 'HOLD signal but large allocation. Consider trimming position.';
            confidence = 65;
          } else {
            reason = 'HOLD signal. Maintain current position.';
            confidence = 60;
          }
        }
      }

      const targetValue = targetAllocation * totalValue;
      const targetShares = position.currentPrice > 0 ? Math.floor(targetValue / position.currentPrice) : 0;

      return {
        ticker: position.ticker,
        currentValue: position.currentValue,
        targetValue: Math.round(targetValue),
        targetShares,
        action,
        reason,
        confidence
      };
    });
  }

  private async generateNewETFRecommendations(
    currentPositions: PortfolioPosition[],
    totalValue: number
  ): Promise<NewETFRecommendation[]> {
    
    const currentTickers = new Set(currentPositions.map(p => p.ticker));
    const recommendations: NewETFRecommendation[] = [];
    
    // Get top-ranked ETFs not in portfolio
    try {
      const { data: topETFs, error } = await supabase
        .from('etf_rankings')
        .select('ticker, rank_position')
        .not('ticker', 'in', `(${Array.from(currentTickers).join(',')})`)
        .order('rank_position', { ascending: true })
        .limit(10);

      if (error) throw error;

      // Get additional data for these ETFs
      if (topETFs && topETFs.length > 0) {
        const { data: etfDetails } = await supabase
          .from('etfs')
          .select('ticker, yield_ttm, strategy_label, name')
          .in('ticker', topETFs.map(etf => etf.ticker));

        // Calculate suggested allocation based on portfolio size and position count
        const suggestedPositions = Math.min(3, Math.max(1, 12 - currentPositions.length));
        const allocationPerNewPosition = Math.min(0.15, totalValue * 0.3 / suggestedPositions / totalValue);

        for (let i = 0; i < Math.min(suggestedPositions, topETFs.length); i++) {
          const etf = topETFs[i];
          const details = etfDetails?.find(d => d.ticker === etf.ticker);
          const price = this.cachedPrices?.[etf.ticker]?.price || 0;
          
          if (price > 0) {
            const targetValue = allocationPerNewPosition * totalValue;
            const targetShares = Math.floor(targetValue / price);
            
            let reason = `Top-ranked ETF (#${etf.rank_position}) not in your portfolio.`;
            let confidence = 85;
            
            if (details) {
              if (details.yield_ttm && details.yield_ttm > 8) {
                reason += ` High yield (${details.yield_ttm.toFixed(1)}%).`;
                confidence += 5;
              }
              if (details.strategy_label) {
                reason += ` Strategy: ${details.strategy_label}.`;
              }
            }

            recommendations.push({
              ticker: etf.ticker,
              targetValue: Math.round(targetValue),
              targetShares,
              reason,
              confidence,
              rankingPosition: etf.rank_position,
              yieldTTM: details?.yield_ttm,
              strategy: details?.strategy_label
            });
          }
        }
      }
    } catch (error) {
      console.error('Error generating new ETF recommendations:', error);
    }

    return recommendations;
  }

  private generatePortfolioRecommendations(
    diversificationScore: number,
    riskScore: number,
    yieldBalance: number,
    trendAlignment: number,
    positionCount: number
  ): string[] {
    const recommendations: string[] = [];

    if (diversificationScore < 60) {
      if (positionCount < 6) {
        recommendations.push('Consider adding more positions to improve diversification (target: 8-12 positions).');
      }
      recommendations.push('Look for ETFs with different strategies to improve portfolio balance.');
    }

    if (riskScore > 70) {
      recommendations.push('Portfolio has high risk exposure. Consider reducing positions in volatile ETFs.');
    }

    if (yieldBalance < 50) {
      recommendations.push('Yield balance could be improved. Consider ETFs with 6-15% yields for optimal income.');
    }

    if (trendAlignment < 40) {
      recommendations.push('Many positions show SELL signals. Review underperforming holdings for potential exits.');
    }

    if (positionCount > 15) {
      recommendations.push('Portfolio may be over-diversified. Consider consolidating into stronger positions.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Portfolio appears well-balanced. Monitor DRIP signals for timing adjustments.');
    }

    return recommendations;
  }
}