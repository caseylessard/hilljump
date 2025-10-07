// Enhanced AI Portfolio Advisor for DRIP Income ETFs
// Aligned with income-focused scoring methodology

export interface PortfolioPosition {
  ticker: string;
  shares: number;
  currentValue: number;
  currentPrice: number;
  
  // Income metrics
  dividend_yield?: number;
  dividend_growth_1y?: number;
  dividend_growth_3y?: number;
  dividend_growth_5y?: number;
  payout_ratio?: number;
  dividend_frequency?: number;
  
  // Returns
  ret_1y?: number;
  ret_3y?: number;
  ret_5y?: number;
  
  // Quality metrics
  quality_score?: number;
  expense_ratio?: number;
  aum?: number;
  fund_age_years?: number;
  avg_volume?: number;
  
  // Risk metrics
  sortino?: number;
  sharpe?: number;
  max_drawdown?: number;
  downside_deviation?: number;
  vol_ann?: number;
  
  // Composite scores from enhanced algorithm
  income_score?: number;
  quality_score_raw?: number;
  risk_adjusted_score?: number;
  composite_score?: number;
  trend_score?: number;
  
  // Metadata
  strategy?: string;
  badge?: string;
  badge_label?: string;
  rankingPosition?: number | null;
}

export interface TargetRecommendation {
  ticker: string;
  currentValue: number;
  currentAllocation: number;
  targetValue: number;
  targetAllocation: number;
  targetShares: number;
  action: 'HOLD' | 'INCREASE' | 'DECREASE' | 'SELL';
  reason: string;
  confidence: number; // 0-100
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  metrics?: {
    income_score?: number;
    quality_score?: number;
    risk_adjusted_score?: number;
    composite_score?: number;
  };
}

export interface NewETFRecommendation {
  ticker: string;
  name?: string;
  targetValue: number;
  targetAllocation: number;
  targetShares: number;
  estimatedPrice: number;
  reason: string;
  confidence: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  metrics: {
    dividend_yield?: number;
    dividend_growth_3y?: number;
    income_score?: number;
    quality_score?: number;
    composite_score?: number;
    expense_ratio?: number;
  };
  rankingPosition?: number;
  strategy?: string;
}

export interface PortfolioAnalysis {
  totalValue: number;
  totalShares: number;
  positionCount: number;
  
  // Income metrics
  weightedAvgYield: number;
  weightedAvgDividendGrowth: number;
  estimatedAnnualIncome: number;
  incomeQualityScore: number; // 0-100
  
  // Quality metrics
  weightedAvgExpenseRatio: number;
  weightedAvgQualityScore: number;
  qualityScore: number; // 0-100
  
  // Risk metrics
  weightedAvgSortino: number;
  weightedAvgMaxDrawdown: number;
  riskScore: number; // 0-100 (lower is better)
  
  // Portfolio construction
  diversificationScore: number; // 0-100
  concentrationRisk: number; // 0-100 (lower is better)
  strategyBalance: number; // 0-100
  
  // Overall
  portfolioHealthScore: number; // 0-100
  recommendations: string[];
}

export interface AIPortfolioAdvice {
  targetRecommendations: TargetRecommendation[];
  newETFRecommendations: NewETFRecommendation[];
  portfolioAnalysis: PortfolioAnalysis;
  rebalancingSummary: {
    totalChanges: number;
    sellValue: number;
    buyValue: number;
    netChange: number;
    estimatedTurnover: number;
  };
}

export class AIPortfolioAdvisor {
  private etfData: any;
  private cachedPrices: any;
  private frozenRankings: any;
  private getRankForTicker: (ticker: string) => number | null;
  private availableETFs: any[];

  constructor(
    etfData: any,
    cachedPrices: any,
    frozenRankings: any,
    getRankForTicker: (ticker: string) => number | null,
    availableETFs: any[]
  ) {
    this.etfData = etfData;
    this.cachedPrices = cachedPrices;
    this.frozenRankings = frozenRankings;
    this.getRankForTicker = getRankForTicker;
    this.availableETFs = availableETFs;
  }

  async analyzePortfolio(positions: PortfolioPosition[]): Promise<AIPortfolioAdvice> {
    console.log(`🎯 Analyzing portfolio with ${positions.length} positions`);

    // Enrich positions with latest data if needed
    const enrichedPositions = await this.enrichPositions(positions);

    // Generate comprehensive portfolio analysis
    const portfolioAnalysis = this.analyzePortfolioMetrics(enrichedPositions);

    // Generate target recommendations for existing positions
    const targetRecommendations = this.generateTargetRecommendations(
      enrichedPositions,
      portfolioAnalysis
    );

    // Generate new ETF recommendations
    const newETFRecommendations = this.generateNewETFRecommendations(
      enrichedPositions,
      portfolioAnalysis
    );

    // Calculate rebalancing summary
    const rebalancingSummary = this.calculateRebalancingSummary(
      targetRecommendations,
      newETFRecommendations
    );

    console.log(`✅ Analysis complete: ${targetRecommendations.length} adjustments, ${newETFRecommendations.length} new recommendations`);

    return {
      targetRecommendations,
      newETFRecommendations,
      portfolioAnalysis,
      rebalancingSummary
    };
  }

  // ==================== POSITION ENRICHMENT ====================

  private async enrichPositions(positions: PortfolioPosition[]): Promise<PortfolioPosition[]> {
    return positions.map(position => {
      const etfInfo = this.availableETFs.find(e => e.ticker === position.ticker);
      const priceInfo = this.cachedPrices?.[position.ticker];

      if (!etfInfo) return position;

      return {
        ...position,
        currentPrice: priceInfo?.price || position.currentPrice,
        dividend_yield: etfInfo.dividend_yield || position.dividend_yield,
        dividend_growth_3y: etfInfo.dividend_growth_3y || position.dividend_growth_3y,
        payout_ratio: etfInfo.payout_ratio || position.payout_ratio,
        expense_ratio: etfInfo.expense_ratio || position.expense_ratio,
        aum: etfInfo.aum || position.aum,
        fund_age_years: etfInfo.fund_age_years || position.fund_age_years,
        sortino: etfInfo.sortino || position.sortino,
        sharpe: etfInfo.sharpe || position.sharpe,
        max_drawdown: etfInfo.max_drawdown || position.max_drawdown,
        income_score: etfInfo.income_score || position.income_score,
        quality_score: etfInfo.quality_score || position.quality_score,
        risk_adjusted_score: etfInfo.risk_adjusted_score || position.risk_adjusted_score,
        composite_score: etfInfo.composite_score || position.composite_score,
        strategy: etfInfo.strategy_label || position.strategy,
        rankingPosition: this.getRankForTicker(position.ticker)
      };
    });
  }

  // ==================== PORTFOLIO ANALYSIS ====================

  private analyzePortfolioMetrics(positions: PortfolioPosition[]): PortfolioAnalysis {
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalShares = positions.reduce((sum, p) => sum + p.shares, 0);

    // Income metrics
    const incomeMetrics = this.calculateIncomeMetrics(positions, totalValue);
    
    // Quality metrics
    const qualityMetrics = this.calculateQualityMetrics(positions, totalValue);
    
    // Risk metrics
    const riskMetrics = this.calculateRiskMetrics(positions, totalValue);
    
    // Portfolio structure
    const structureMetrics = this.calculateStructureMetrics(positions, totalValue);

    // Calculate overall health score
    const portfolioHealthScore = this.calculatePortfolioHealth(
      incomeMetrics.incomeQualityScore,
      qualityMetrics.qualityScore,
      riskMetrics.riskScore,
      structureMetrics.diversificationScore
    );

    // Generate recommendations
    const recommendations = this.generatePortfolioRecommendations(
      incomeMetrics,
      qualityMetrics,
      riskMetrics,
      structureMetrics,
      positions.length
    );

    return {
      totalValue,
      totalShares,
      positionCount: positions.length,
      ...incomeMetrics,
      ...qualityMetrics,
      ...riskMetrics,
      ...structureMetrics,
      portfolioHealthScore,
      recommendations
    };
  }

  private calculateIncomeMetrics(positions: PortfolioPosition[], totalValue: number) {
    let weightedYield = 0;
    let weightedGrowth = 0;
    let yieldCount = 0;
    let growthCount = 0;
    let sustainabilityScore = 0;
    let sustainCount = 0;

    positions.forEach(p => {
      const weight = p.currentValue / totalValue;

      if (p.dividend_yield !== undefined && p.dividend_yield > 0) {
        weightedYield += p.dividend_yield * weight;
        yieldCount++;
      }

      if (p.dividend_growth_3y !== undefined) {
        weightedGrowth += p.dividend_growth_3y * weight;
        growthCount++;
      }

      if (p.payout_ratio !== undefined && p.payout_ratio > 0) {
        const sustain = p.payout_ratio < 0.60 ? 100 :
                       p.payout_ratio < 0.80 ? 80 :
                       p.payout_ratio < 1.00 ? 50 : 20;
        sustainabilityScore += sustain * weight;
        sustainCount++;
      }
    });

    const avgYield = yieldCount > 0 ? weightedYield : 0;
    const avgGrowth = growthCount > 0 ? weightedGrowth : 0;
    const avgSustain = sustainCount > 0 ? sustainabilityScore : 75;

    // Income quality: 40% yield, 30% growth, 30% sustainability
    const yieldScore = Math.min(100, (avgYield / 0.10) * 100); // 10% = 100 points
    const growthScore = avgGrowth > 0 ? Math.min(100, (avgGrowth / 0.10) * 100) : 50;
    const incomeQualityScore = Math.round(
      0.40 * yieldScore + 0.30 * growthScore + 0.30 * avgSustain
    );

    return {
      weightedAvgYield: avgYield,
      weightedAvgDividendGrowth: avgGrowth,
      estimatedAnnualIncome: totalValue * avgYield,
      incomeQualityScore
    };
  }

  private calculateQualityMetrics(positions: PortfolioPosition[], totalValue: number) {
    let weightedExpense = 0;
    let weightedQuality = 0;
    let expenseCount = 0;
    let qualityCount = 0;

    positions.forEach(p => {
      const weight = p.currentValue / totalValue;

      if (p.expense_ratio !== undefined && p.expense_ratio >= 0) {
        weightedExpense += p.expense_ratio * weight;
        expenseCount++;
      }

      if (p.quality_score !== undefined) {
        weightedQuality += p.quality_score * weight;
        qualityCount++;
      }
    });

    const avgExpense = expenseCount > 0 ? weightedExpense : 0.01;
    const avgQuality = qualityCount > 0 ? weightedQuality : 50;

    // Quality score: lower expenses = higher score
    const expenseScore = avgExpense < 0.005 ? 100 :
                        avgExpense < 0.010 ? 80 :
                        avgExpense < 0.015 ? 60 : 40;

    const qualityScore = Math.round(0.60 * avgQuality + 0.40 * expenseScore);

    return {
      weightedAvgExpenseRatio: avgExpense,
      weightedAvgQualityScore: avgQuality,
      qualityScore
    };
  }

  private calculateRiskMetrics(positions: PortfolioPosition[], totalValue: number) {
    let weightedSortino = 0;
    let weightedDrawdown = 0;
    let sortinoCount = 0;
    let drawdownCount = 0;

    positions.forEach(p => {
      const weight = p.currentValue / totalValue;

      const riskMetric = p.sortino || p.sharpe;
      if (riskMetric !== undefined) {
        weightedSortino += riskMetric * weight;
        sortinoCount++;
      }

      if (p.max_drawdown !== undefined) {
        weightedDrawdown += Math.abs(p.max_drawdown) * weight;
        drawdownCount++;
      }
    });

    const avgSortino = sortinoCount > 0 ? weightedSortino : 0.5;
    const avgDrawdown = drawdownCount > 0 ? weightedDrawdown : 0.15;

    // Risk score: lower is better
    // Good Sortino > 1.0, acceptable drawdown < 20%
    const sortinoScore = avgSortino > 1.5 ? 20 :
                        avgSortino > 1.0 ? 35 :
                        avgSortino > 0.5 ? 50 : 70;

    const drawdownScore = avgDrawdown < 0.15 ? 20 :
                         avgDrawdown < 0.25 ? 40 :
                         avgDrawdown < 0.35 ? 60 : 80;

    const riskScore = Math.round(0.50 * sortinoScore + 0.50 * drawdownScore);

    return {
      weightedAvgSortino: avgSortino,
      weightedAvgMaxDrawdown: -avgDrawdown,
      riskScore
    };
  }

  private calculateStructureMetrics(positions: PortfolioPosition[], totalValue: number) {
    // Strategy diversification
    const strategies = new Set(positions.map(p => p.strategy || 'Unknown'));
    const strategyDiversity = Math.min(strategies.size / 5, 1) * 100;

    // Calculate strategy balance (no single strategy > 40%)
    const strategyAllocations = new Map<string, number>();
    positions.forEach(p => {
      const strat = p.strategy || 'Unknown';
      strategyAllocations.set(strat, (strategyAllocations.get(strat) || 0) + p.currentValue);
    });

    const maxStrategyAlloc = Math.max(...Array.from(strategyAllocations.values())) / totalValue;
    const strategyBalance = maxStrategyAlloc < 0.40 ? 100 :
                           maxStrategyAlloc < 0.60 ? 70 : 40;

    // Position concentration
    const maxPosition = Math.max(...positions.map(p => p.currentValue)) / totalValue;
    const concentrationRisk = maxPosition > 0.30 ? 80 :
                             maxPosition > 0.20 ? 50 :
                             maxPosition > 0.10 ? 30 : 20;

    // Position count score (optimal 8-12)
    const countScore = positions.length >= 8 && positions.length <= 12 ? 100 :
                      positions.length >= 6 && positions.length <= 15 ? 80 :
                      positions.length >= 4 && positions.length <= 18 ? 60 : 40;

    const diversificationScore = Math.round(
      0.30 * strategyDiversity +
      0.30 * strategyBalance +
      0.20 * (100 - concentrationRisk) +
      0.20 * countScore
    );

    return {
      diversificationScore,
      concentrationRisk,
      strategyBalance
    };
  }

  private calculatePortfolioHealth(
    incomeScore: number,
    qualityScore: number,
    riskScore: number,
    diversificationScore: number
  ): number {
    // For income portfolios: income 40%, quality 30%, diversification 20%, risk 10%
    // Risk is inverted (lower risk score = better)
    return Math.round(
      0.40 * incomeScore +
      0.30 * qualityScore +
      0.20 * diversificationScore +
      0.10 * (100 - riskScore)
    );
  }

  // ==================== TARGET RECOMMENDATIONS ====================

  private generateTargetRecommendations(
    positions: PortfolioPosition[],
    analysis: PortfolioAnalysis
  ): TargetRecommendation[] {
    const totalValue = analysis.totalValue;

    return positions.map(position => {
      const currentAllocation = position.currentValue / totalValue;
      const compositeScore = position.composite_score || 50;
      const incomeScore = position.income_score || 50;
      const qualityScore = position.quality_score || 50;

      let targetAllocation = currentAllocation;
      let action: TargetRecommendation['action'] = 'HOLD';
      let reason = 'Maintain current position';
      let confidence = 60;
      let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

      // Check for critical issues first
      if (position.payout_ratio && position.payout_ratio > 1.0) {
        action = 'SELL';
        targetAllocation = 0;
        reason = `Unsustainable dividend (payout ratio ${(position.payout_ratio * 100).toFixed(0)}% > 100%). Exit position.`;
        confidence = 95;
        priority = 'HIGH';
      } else if (position.expense_ratio && position.expense_ratio > 0.025) {
        if (currentAllocation > 0.05) {
          action = 'DECREASE';
          targetAllocation = Math.max(0.03, currentAllocation * 0.7);
          reason = `High expense ratio (${(position.expense_ratio * 100).toFixed(2)}%). Reduce exposure.`;
          confidence = 75;
          priority = 'MEDIUM';
        }
      } else if (compositeScore >= 80) {
        // Excellent ETF - consider increasing
        if (currentAllocation < 0.12 && analysis.concentrationRisk < 60) {
          targetAllocation = Math.min(0.15, currentAllocation * 1.25);
          action = 'INCREASE';
          reason = `Excellent composite score (${compositeScore.toFixed(0)}). Strong income quality and fundamentals.`;
          confidence = 85;
          priority = 'HIGH';
        } else {
          reason = `Top performer (score: ${compositeScore.toFixed(0)}). Maintain position.`;
          confidence = 80;
        }
      } else if (compositeScore >= 65) {
        // Good ETF - maintain or modest increase
        if (currentAllocation < 0.08) {
          targetAllocation = Math.min(0.10, currentAllocation * 1.15);
          action = 'INCREASE';
          reason = `Solid performer (score: ${compositeScore.toFixed(0)}). Room for modest increase.`;
          confidence = 70;
          priority = 'MEDIUM';
        } else {
          reason = `Good quality (score: ${compositeScore.toFixed(0)}). Hold current allocation.`;
        }
      } else if (compositeScore < 40) {
        // Poor ETF - reduce or exit
        if (currentAllocation > 0.08) {
          targetAllocation = Math.max(0.03, currentAllocation * 0.5);
          action = 'DECREASE';
          reason = `Underperforming (score: ${compositeScore.toFixed(0)}). Reduce exposure significantly.`;
          confidence = 80;
          priority = 'HIGH';
        } else {
          targetAllocation = 0;
          action = 'SELL';
          reason = `Poor performance (score: ${compositeScore.toFixed(0)}). Exit small position.`;
          confidence = 85;
          priority = 'HIGH';
        }
      } else if (compositeScore < 50) {
        // Below average - consider trimming
        if (currentAllocation > 0.10) {
          targetAllocation = currentAllocation * 0.75;
          action = 'DECREASE';
          reason = `Below average (score: ${compositeScore.toFixed(0)}). Trim oversized position.`;
          confidence = 70;
          priority = 'MEDIUM';
        }
      }

      // Additional check: oversized positions
      if (currentAllocation > 0.20 && action === 'HOLD') {
        targetAllocation = 0.18;
        action = 'DECREASE';
        reason = `Position exceeds 20% of portfolio. Reduce for diversification.`;
        confidence = 75;
        priority = 'MEDIUM';
      }

      // Check for low income quality
      if (incomeScore < 40 && (position.dividend_yield || 0) < 0.03) {
        if (action === 'HOLD' || action === 'INCREASE') {
          action = 'DECREASE';
          targetAllocation = Math.max(0.02, currentAllocation * 0.7);
          reason = `Low income quality (score: ${incomeScore.toFixed(0)}, yield: ${((position.dividend_yield || 0) * 100).toFixed(1)}%). Consider reducing.`;
          confidence = 65;
          priority = 'MEDIUM';
        }
      }

      const targetValue = targetAllocation * totalValue;
      const targetShares = Math.floor(targetValue / position.currentPrice);

      return {
        ticker: position.ticker,
        currentValue: position.currentValue,
        currentAllocation,
        targetValue: Math.round(targetValue),
        targetAllocation,
        targetShares,
        action,
        reason,
        confidence,
        priority,
        metrics: {
          income_score: position.income_score,
          quality_score: position.quality_score,
          risk_adjusted_score: position.risk_adjusted_score,
          composite_score: position.composite_score
        }
      };
    }).sort((a, b) => {
      // Sort by priority, then confidence
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });
  }

  // ==================== NEW ETF RECOMMENDATIONS ====================

  private generateNewETFRecommendations(
    currentPositions: PortfolioPosition[],
    analysis: PortfolioAnalysis
  ): NewETFRecommendation[] {
    const currentTickers = new Set(currentPositions.map(p => p.ticker));
    const totalValue = analysis.totalValue;
    
    // Determine how many new positions to recommend
    const optimalPositions = 10;
    const currentCount = currentPositions.length;
    const maxNewRecommendations = Math.min(
      5,
      Math.max(0, optimalPositions - currentCount)
    );

    if (maxNewRecommendations === 0) {
      console.log('📊 Portfolio already has optimal position count');
      return [];
    }

    console.log(`🔍 Looking for up to ${maxNewRecommendations} new ETF recommendations`);

    // Get top-ranked ETFs not in portfolio
    const candidates = this.availableETFs
      .filter(etf => !currentTickers.has(etf.ticker))
      .map(etf => ({
        ...etf,
        rank_position: this.getRankForTicker(etf.ticker),
        price: this.cachedPrices?.[etf.ticker]?.price || 0
      }))
      .filter(etf => etf.rank_position !== null && etf.price > 0)
      .sort((a, b) => a.rank_position! - b.rank_position!)
      .slice(0, maxNewRecommendations * 3); // Get extra candidates for filtering

    // Check for strategy diversification needs
    const currentStrategies = new Map<string, number>();
    currentPositions.forEach(p => {
      const strat = p.strategy || 'Unknown';
      currentStrategies.set(strat, (currentStrategies.get(strat) || 0) + p.currentValue);
    });

    const recommendations: NewETFRecommendation[] = [];
    const targetAllocationPerNew = Math.min(0.10, 0.80 / (currentCount + maxNewRecommendations));

    for (const candidate of candidates) {
      if (recommendations.length >= maxNewRecommendations) break;

      // Check strategy overlap
      const strategy = candidate.strategy_label || 'Unknown';
      const currentStrategyAlloc = (currentStrategies.get(strategy) || 0) / totalValue;
      
      // Skip if strategy already > 35% of portfolio
      if (currentStrategyAlloc > 0.35) {
        console.log(`⏭️  Skipping ${candidate.ticker} - ${strategy} already at ${(currentStrategyAlloc * 100).toFixed(0)}%`);
        continue;
      }

      // Calculate scores
      const compositeScore = candidate.composite_score || 50;
      const incomeScore = candidate.income_score || 50;
      const qualityScore = candidate.quality_score || 50;

      // Only recommend if composite score >= 60
      if (compositeScore < 60) {
        continue;
      }

      const targetValue = targetAllocationPerNew * totalValue;
      const targetShares = Math.floor(targetValue / candidate.price);

      if (targetShares === 0) continue;

      let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      let confidence = 70;

      if (candidate.rank_position! <= 10 && compositeScore >= 80) {
        priority = 'HIGH';
        confidence = 90;
      } else if (candidate.rank_position! <= 25 && compositeScore >= 70) {
        priority = 'MEDIUM';
        confidence = 80;
      } else {
        priority = 'LOW';
        confidence = 70;
      }

      const yieldStr = candidate.dividend_yield 
        ? `${(candidate.dividend_yield * 100).toFixed(1)}% yield`
        : 'dividend income';
      
      const growthStr = candidate.dividend_growth_3y
        ? `, ${(candidate.dividend_growth_3y * 100).toFixed(1)}% 3Y growth`
        : '';

      recommendations.push({
        ticker: candidate.ticker,
        name: candidate.name,
        targetValue: Math.round(targetValue),
        targetAllocation: targetAllocationPerNew,
        targetShares,
        estimatedPrice: candidate.price,
        reason: `Top ranked (#${candidate.rank_position}) ${strategy} with ${yieldStr}${growthStr}. Strong composite score (${compositeScore.toFixed(0)}).`,
        confidence,
        priority,
        rankingPosition: candidate.rank_position!,
        strategy: candidate.strategy_label,
        metrics: {
          dividend_yield: candidate.dividend_yield,
          dividend_growth_3y: candidate.dividend_growth_3y,
          income_score: incomeScore,
          quality_score: qualityScore,
          composite_score: compositeScore,
          expense_ratio: candidate.expense_ratio
        }
      });
    }

    console.log(`💡 Generated ${recommendations.length} new ETF recommendations`);
    return recommendations;
  }

  // ==================== PORTFOLIO RECOMMENDATIONS ====================

  private generatePortfolioRecommendations(
    incomeMetrics: any,
    qualityMetrics: any,
    riskMetrics: any,
    structureMetrics: any,
    positionCount: number
  ): string[] {
    const recommendations: string[] = [];

    // Income quality recommendations
    if (incomeMetrics.incomeQualityScore < 50) {
      recommendations.push(`🔴 Low income quality (${incomeMetrics.incomeQualityScore}/100). Focus on ETFs with sustainable dividends (payout ratio <80%) and positive growth.`);
    } else if (incomeMetrics.incomeQualityScore < 65) {
      recommendations.push(`🟡 Income quality needs improvement (${incomeMetrics.incomeQualityScore}/100). Consider adding higher-yielding ETFs with dividend growth.`);
    }

    if (incomeMetrics.weightedAvgYield < 0.04) {
      recommendations.push(`🟡 Average yield is ${(incomeMetrics.weightedAvgYield * 100).toFixed(1)}%. Consider adding higher-yielding positions (target: 6-10%).`);
    }

    // Quality recommendations
    if (qualityMetrics.weightedAvgExpenseRatio > 0.015) {
      recommendations.push(`🔴 High average expense ratio (${(qualityMetrics.weightedAvgExpenseRatio * 100).toFixed(2)}%). Target <1.0% to maximize net income.`);
    } else if (qualityMetrics.weightedAvgExpenseRatio > 0.010) {
      recommendations.push(`🟡 Expense ratio (${(qualityMetrics.weightedAvgExpenseRatio * 100).toFixed(2)}%) could be lower. Consider low-cost alternatives.`);
    }

    if (qualityMetrics.qualityScore < 60) {
      recommendations.push(`🟡 Portfolio quality score is ${qualityMetrics.qualityScore}/100. Focus on well-established ETFs with strong fundamentals.`);
    }

    // Risk recommendations
    if (riskMetrics.riskScore > 70) {
      recommendations.push(`🔴 High portfolio risk (${riskMetrics.riskScore}/100). Consider defensive dividend ETFs with lower volatility.`);
    } else if (riskMetrics.riskScore > 50) {
      recommendations.push(`🟡 Moderate portfolio risk (${riskMetrics.riskScore}/100). Monitor downside protection and drawdowns.`);
    }

    if (riskMetrics.weightedAvgMaxDrawdown < -0.30) {
      recommendations.push(`🔴 Significant drawdown exposure (${(riskMetrics.weightedAvgMaxDrawdown * 100).toFixed(1)}%). Add stability-focused ETFs.`);
    }

    // Diversification recommendations
    if (structureMetrics.diversificationScore < 50) {
      recommendations.push(`🔴 Poor diversification (${structureMetrics.diversificationScore}/100). Add positions across different strategies and sectors.`);
    } else if (structureMetrics.diversificationScore < 70) {
      recommendations.push(`🟡 Diversification could improve (${structureMetrics.diversificationScore}/100). Consider broader strategy coverage.`);
    }

    if (structureMetrics.concentrationRisk > 60) {
      recommendations.push(`🔴 High concentration risk. Largest position exceeds 20%. Rebalance for better distribution.`);
    } else if (structureMetrics.concentrationRisk > 40) {
      recommendations.push(`🟡 Moderate concentration risk. Monitor largest positions to avoid over-allocation.`);
    }

    // Position count recommendations
    if (positionCount < 6) {
      recommendations.push(`🟡 Consider adding ${8 - positionCount} more positions for better diversification (target: 8-12 ETFs).`);
    } else if (positionCount > 15) {
      recommendations.push(`🟡 Portfolio may be over-diversified with ${positionCount} positions. Consider consolidating into strongest performers.`);
    }

    // Strategy balance
    if (structureMetrics.strategyBalance < 70) {
      recommendations.push(`🟡 Strategy allocation is unbalanced. Diversify across multiple income strategies for better risk management.`);
    }

    // Positive feedback if portfolio is healthy
    if (recommendations.length === 0) {
      recommendations.push(`🟢 Portfolio is well-optimized for income investing. Continue monitoring dividend announcements and quality scores quarterly.`);
      recommendations.push(`🟢 Maintain discipline with rebalancing when positions drift >3% from target allocations.`);
    }

    return recommendations;
  }

  // ==================== REBALANCING SUMMARY ====================

  private calculateRebalancingSummary(
    targetRecs: TargetRecommendation[],
    newRecs: NewETFRecommendation[]
  ): {
    totalChanges: number;
    sellValue: number;
    buyValue: number;
    netChange: number;
    estimatedTurnover: number;
  } {
    let sellValue = 0;
    let buyValue = 0;
    let totalChanges = 0;

    // Calculate changes from existing positions
    targetRecs.forEach(rec => {
      const change = rec.targetValue - rec.currentValue;
      if (change < 0) {
        sellValue += Math.abs(change);
        totalChanges++;
      } else if (change > 0) {
        buyValue += change;
        totalChanges++;
      }
    });

    // Add new position purchases
    newRecs.forEach(rec => {
      buyValue += rec.targetValue;
      totalChanges++;
    });

    const netChange = buyValue - sellValue;
    const totalPortfolioValue = targetRecs.reduce((sum, r) => sum + r.currentValue, 0);
    const estimatedTurnover = totalPortfolioValue > 0 
      ? (sellValue + buyValue) / (2 * totalPortfolioValue)
      : 0;

    return {
      totalChanges,
      sellValue: Math.round(sellValue),
      buyValue: Math.round(buyValue),
      netChange: Math.round(netChange),
      estimatedTurnover
    };
  }
}

// ==================== HELPER FUNCTIONS ====================

export function formatAllocation(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function getHealthScoreLabel(score: number): { label: string; color: string; emoji: string } {
  if (score >= 80) return { label: 'Excellent', color: 'green', emoji: '🟢' };
  if (score >= 70) return { label: 'Good', color: 'lightgreen', emoji: '🟢' };
  if (score >= 60) return { label: 'Fair', color: 'yellow', emoji: '🟡' };
  if (score >= 40) return { label: 'Needs Improvement', color: 'orange', emoji: '🟡' };
  return { label: 'Poor', color: 'red', emoji: '🔴' };
}

export function getPriorityColor(priority: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (priority) {
    case 'HIGH': return 'red';
    case 'MEDIUM': return 'orange';
    case 'LOW': return 'gray';
  }
}

export function getActionColor(action: TargetRecommendation['action']): string {
  switch (action) {
    case 'INCREASE': return 'green';
    case 'HOLD': return 'blue';
    case 'DECREASE': return 'orange';
    case 'SELL': return 'red';
  }
}

export function getActionEmoji(action: TargetRecommendation['action']): string {
  switch (action) {
    case 'INCREASE': return '📈';
    case 'HOLD': return '⏸️';
    case 'DECREASE': return '📉';
    case 'SELL': return '❌';
  }
}

// ==================== PORTFOLIO COMPARISON ====================

export interface PortfolioComparison {
  current: {
    value: number;
    income: number;
    yieldPercent: number;
    positionCount: number;
  };
  recommended: {
    value: number;
    income: number;
    yieldPercent: number;
    positionCount: number;
  };
  improvements: {
    incomeIncrease: number;
    incomeIncreasePercent: number;
    yieldImprovement: number;
    diversificationChange: number;
  };
}

export function comparePortfolios(
  currentAnalysis: PortfolioAnalysis,
  recommendations: AIPortfolioAdvice
): PortfolioComparison {
  const currentValue = currentAnalysis.totalValue;
  const currentIncome = currentAnalysis.estimatedAnnualIncome;
  const currentYield = currentAnalysis.weightedAvgYield;

  // Calculate recommended portfolio metrics
  let recommendedValue = 0;
  let recommendedIncome = 0;
  let recommendedPositionCount = 0;

  recommendations.targetRecommendations.forEach(rec => {
    if (rec.action !== 'SELL') {
      recommendedValue += rec.targetValue;
      recommendedPositionCount++;
    }
  });

  recommendations.newETFRecommendations.forEach(rec => {
    recommendedValue += rec.targetValue;
    recommendedPositionCount++;
  });

  // Estimate income improvement
  const avgYieldImprovement = 0.01; // Conservative 1% improvement estimate
  recommendedIncome = currentIncome * (1 + avgYieldImprovement);
  const recommendedYield = recommendedValue > 0 ? recommendedIncome / recommendedValue : currentYield;

  return {
    current: {
      value: currentValue,
      income: currentIncome,
      yieldPercent: currentYield,
      positionCount: currentAnalysis.positionCount
    },
    recommended: {
      value: recommendedValue,
      income: recommendedIncome,
      yieldPercent: recommendedYield,
      positionCount: recommendedPositionCount
    },
    improvements: {
      incomeIncrease: recommendedIncome - currentIncome,
      incomeIncreasePercent: currentIncome > 0 
        ? (recommendedIncome - currentIncome) / currentIncome
        : 0,
      yieldImprovement: recommendedYield - currentYield,
      diversificationChange: recommendedPositionCount - currentAnalysis.positionCount
    }
  };
}

// ==================== EXPORT HELPERS ====================

export function exportRecommendationsToCSV(advice: AIPortfolioAdvice): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Type,Ticker,Action,Current Value,Target Value,Current Allocation,Target Allocation,Shares,Reason,Confidence,Priority');
  
  // Existing positions
  advice.targetRecommendations.forEach(rec => {
    lines.push([
      'EXISTING',
      rec.ticker,
      rec.action,
      rec.currentValue.toFixed(2),
      rec.targetValue.toFixed(2),
      formatAllocation(rec.currentAllocation),
      formatAllocation(rec.targetAllocation),
      rec.targetShares.toString(),
      `"${rec.reason}"`,
      rec.confidence.toString(),
      rec.priority
    ].join(','));
  });
  
  // New positions
  advice.newETFRecommendations.forEach(rec => {
    lines.push([
      'NEW',
      rec.ticker,
      'BUY',
      '0.00',
      rec.targetValue.toFixed(2),
      '0.0%',
      formatAllocation(rec.targetAllocation),
      rec.targetShares.toString(),
      `"${rec.reason}"`,
      rec.confidence.toString(),
      rec.priority
    ].join(','));
  });
  
  return lines.join('\n');
}

export function generatePortfolioReport(advice: AIPortfolioAdvice): string {
  const analysis = advice.portfolioAnalysis;
  const health = getHealthScoreLabel(analysis.portfolioHealthScore);
  
  let report = '=' .repeat(80) + '\n';
  report += '📊 AI PORTFOLIO ANALYSIS REPORT\n';
  report += '=' .repeat(80) + '\n\n';
  
  // Portfolio Overview
  report += '📈 PORTFOLIO OVERVIEW\n';
  report += '-'.repeat(80) + '\n';
  report += `Total Value: ${formatCurrency(analysis.totalValue)}\n`;
  report += `Positions: ${analysis.positionCount}\n`;
  report += `Health Score: ${analysis.portfolioHealthScore}/100 (${health.label}) ${health.emoji}\n`;
  report += `Annual Income: ${formatCurrency(analysis.estimatedAnnualIncome)} (${formatPercent(analysis.weightedAvgYield)} yield)\n\n`;
  
  // Key Metrics
  report += '📊 KEY METRICS\n';
  report += '-'.repeat(80) + '\n';
  report += `Income Quality: ${analysis.incomeQualityScore}/100\n`;
  report += `Quality Score: ${analysis.qualityScore}/100\n`;
  report += `Risk Score: ${analysis.riskScore}/100 (lower is better)\n`;
  report += `Diversification: ${analysis.diversificationScore}/100\n`;
  report += `Avg Expense Ratio: ${formatPercent(analysis.weightedAvgExpenseRatio, 2)}\n`;
  report += `Avg Dividend Growth: ${formatPercent(analysis.weightedAvgDividendGrowth)}\n\n`;
  
  // Recommendations Summary
  report += '💡 RECOMMENDATIONS SUMMARY\n';
  report += '-'.repeat(80) + '\n';
  const highPriority = advice.targetRecommendations.filter(r => r.priority === 'HIGH').length;
  const sells = advice.targetRecommendations.filter(r => r.action === 'SELL').length;
  const increases = advice.targetRecommendations.filter(r => r.action === 'INCREASE').length;
  const decreases = advice.targetRecommendations.filter(r => r.action === 'DECREASE').length;
  
  report += `Total Actions: ${advice.targetRecommendations.length + advice.newETFRecommendations.length}\n`;
  report += `High Priority: ${highPriority}\n`;
  report += `Increases: ${increases}\n`;
  report += `Decreases: ${decreases}\n`;
  report += `Sells: ${sells}\n`;
  report += `New Positions: ${advice.newETFRecommendations.length}\n\n`;
  
  // Rebalancing Impact
  report += '💰 REBALANCING IMPACT\n';
  report += '-'.repeat(80) + '\n';
  report += `Estimated Sell: ${formatCurrency(advice.rebalancingSummary.sellValue)}\n`;
  report += `Estimated Buy: ${formatCurrency(advice.rebalancingSummary.buyValue)}\n`;
  report += `Net Change: ${formatCurrency(advice.rebalancingSummary.netChange)}\n`;
  report += `Portfolio Turnover: ${formatPercent(advice.rebalancingSummary.estimatedTurnover)}\n\n`;
  
  // Portfolio Recommendations
  report += '🎯 PORTFOLIO RECOMMENDATIONS\n';
  report += '-'.repeat(80) + '\n';
  analysis.recommendations.forEach((rec, i) => {
    report += `${i + 1}. ${rec}\n`;
  });
  report += '\n';
  
  // Top Priority Actions
  report += '⚠️  TOP PRIORITY ACTIONS\n';
  report += '-'.repeat(80) + '\n';
  const topActions = advice.targetRecommendations
    .filter(r => r.priority === 'HIGH')
    .slice(0, 5);
  
  topActions.forEach((rec, i) => {
    report += `${i + 1}. ${rec.ticker} - ${rec.action}\n`;
    report += `   ${rec.reason}\n`;
    report += `   Target: ${formatAllocation(rec.targetAllocation)} (${formatCurrency(rec.targetValue)})\n\n`;
  });
  
  // New ETF Recommendations
  if (advice.newETFRecommendations.length > 0) {
    report += '✨ NEW ETF RECOMMENDATIONS\n';
    report += '-'.repeat(80) + '\n';
    advice.newETFRecommendations.forEach((rec, i) => {
      report += `${i + 1}. ${rec.ticker} (${rec.strategy || 'N/A'})\n`;
      report += `   ${rec.reason}\n`;
      report += `   Target: ${formatAllocation(rec.targetAllocation)} (${formatCurrency(rec.targetValue)}, ${rec.targetShares} shares)\n`;
      report += `   Metrics: Yield ${formatPercent(rec.metrics.dividend_yield || 0)}, Score ${rec.metrics.composite_score?.toFixed(0) || 'N/A'}\n\n`;
    });
  }
  
  report += '=' .repeat(80) + '\n';
  report += 'End of Report\n';
  report += '=' .repeat(80) + '\n';
  
  return report;
}

// ==================== PRESET ADVISORY STRATEGIES ====================

export const ADVISORY_PRESETS = {
  conservative: {
    minCompositeScore: 70,
    maxAllocationPerPosition: 0.15,
    minAllocationPerPosition: 0.05,
    targetPositions: 10,
    requireDividendGrowth: true,
    maxExpenseRatio: 0.01,
    maxRiskScore: 50
  },
  
  balanced: {
    minCompositeScore: 60,
    maxAllocationPerPosition: 0.18,
    minAllocationPerPosition: 0.04,
    targetPositions: 12,
    requireDividendGrowth: false,
    maxExpenseRatio: 0.015,
    maxRiskScore: 65
  },
  
  growth_income: {
    minCompositeScore: 55,
    maxAllocationPerPosition: 0.20,
    minAllocationPerPosition: 0.03,
    targetPositions: 15,
    requireDividendGrowth: false,
    maxExpenseRatio: 0.02,
    maxRiskScore: 75
  },
  
  high_yield: {
    minCompositeScore: 50,
    maxAllocationPerPosition: 0.25,
    minAllocationPerPosition: 0.05,
    targetPositions: 8,
    requireDividendGrowth: false,
    maxExpenseRatio: 0.015,
    maxRiskScore: 70
  }
};

export type AdvisoryPreset = keyof typeof ADVISORY_PRESETS;
