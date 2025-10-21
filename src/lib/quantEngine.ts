/**
 * ============================================
 * PHASE 1 + 2: EARNINGS ENRICHMENT (via Supabase)
 * ============================================
 * Fetch earnings data and enrich signal with:
 * - Next earnings date
 * - Historical beat rate
 * - Adjusted conviction
 * - Warnings and adjusted expiry
 */
static async enrichWithEarnings(
  signal: TradingSignal,
  supabaseClient: any // Pass Supabase client instead of API key
): Promise<TradingSignal> {
  try {
    const ticker = signal.ticker;
    
    // Fetch earnings data via Supabase Edge Function
    const { data, error } = await supabaseClient.functions.invoke('fetch-earnings-data', {
      body: { ticker }
    });
    
    if (error) {
      console.warn(`Failed to fetch earnings data for ${ticker}:`, error);
      return signal;
    }
    
    if (!data || !data.earnings) {
      console.warn(`No earnings data returned for ${ticker}`);
      return signal;
    }
    
    const earningsInfo = data.earnings;
    
    // Extract earnings date and time
    const earningsCalendar = earningsInfo?.History;
    const nextEarnings = earningsInfo?.Trend;
    
    let earningsDate: string | undefined;
    let earningsTime: string | undefined;
    
    // Try to get next earnings date from trend data
    if (nextEarnings && Object.keys(nextEarnings).length > 0) {
      const dates = Object.keys(nextEarnings).sort();
      const futureDate = dates.find(d => new Date(d) > new Date());
      if (futureDate) {
        earningsDate = futureDate;
        earningsTime = nextEarnings[futureDate]?.time || 'time-not-supplied';
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
      } else if (daysToEarnings < 7) {
        // CRITICAL: Very close to earnings
        warnings.push(`⚠️ Earnings in ${daysToEarnings}d - High IV crush risk`);
        adjustedConviction = Math.max(50, adjustedConviction - 15);
        
      } else if (daysToEarnings <= 21) {
        // Earnings window - potential catalyst
        const earningsTiming = earningsTime === 'bmo' ? 'before market' : 
                              earningsTime === 'amc' ? 'after market' : '';
        warnings.push(`📊 Earnings in ${daysToEarnings}d ${earningsTiming ? `(${earningsTiming})` : ''}`);
        
        // PHASE 2: Boost conviction if beat rate is high
        if (epsBeatRate && epsBeatRate >= 75) {
          warnings.push(`📈 Strong beat history (${Math.round(epsBeatRate)}% EPS beats)`);
          adjustedConviction = Math.min(95, adjustedConviction + 5);
        }
        
        // Suggest expiry 7-10 days after earnings to capture move
        suggestedExpiry = new Date(earningsDate!);
        suggestedExpiry.setDate(suggestedExpiry.getDate() + 7);
        
        warnings.push(`💡 Consider ${suggestedExpiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} expiry`);
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
      suggestedExpiry: daysToEarnings !== undefined && daysToEarnings > 0 && daysToEarnings <= 21 
        ? suggestedExpiry 
        : undefined
    };
    
  } catch (error) {
    console.error(`Error enriching ${signal.ticker} with earnings:`, error);
    return signal;
  }
}