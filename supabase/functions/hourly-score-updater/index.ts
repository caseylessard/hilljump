import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting hourly scoring update...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get active ETFs with their data
    const { data: etfs, error: etfsError } = await supabase
      .from('etfs')
      .select('*')
      .eq('active', true);

    if (etfsError) {
      throw new Error(`Failed to fetch ETFs: ${etfsError.message}`);
    }

    console.log(`📊 Calculating scores for ${etfs?.length || 0} ETFs...`);

    // Get current prices for all ETFs
    const tickers = etfs?.map(e => e.ticker) || [];
    const { data: priceData } = await supabase
      .from('price_cache')
      .select('ticker, price')
      .in('ticker', tickers);

    const prices: Record<string, number> = {};
    priceData?.forEach(p => {
      prices[p.ticker] = p.price;
    });

    // Get DRIP data for scoring
    const { data: usDripData } = await supabase
      .from('drip_cache_us')
      .select('ticker, period_4w, period_13w, period_26w, period_52w')
      .in('ticker', tickers);

    const { data: caDripData } = await supabase
      .from('drip_cache_ca')
      .select('ticker, period_4w, period_13w, period_26w, period_52w')
      .in('ticker', tickers);

    // Default scoring weights
    const defaultWeights = {
      return: 15,
      yield: 25,
      risk: 20,
      dividendStability: 20,
      period4w: 8,
      period52w: 2,
      homeCountryBias: 6,
      dripEnabled: true
    };

    // Calculate scores for both US and CA
    const scoreResults = [];
    
    for (const etf of etfs || []) {
      try {
        // Calculate basic scores
        const returnScore = calculateReturnScore(etf);
        const yieldScore = calculateYieldScore(etf);
        const riskScore = calculateRiskScore(etf);
        
        // Get DRIP data
        const usDrip = usDripData?.find(d => d.ticker === etf.ticker);
        const caDrip = caDripData?.find(d => d.ticker === etf.ticker);
        
        // Calculate DRIP scores
        const usDripScore = calculateDripScore(usDrip);
        const caDripScore = calculateDripScore(caDrip);
        
        // Calculate composite scores
        const usComposite = (
          (returnScore * defaultWeights.return) +
          (yieldScore * defaultWeights.yield) +
          (riskScore * defaultWeights.risk) +
          (usDripScore * (defaultWeights.period4w + defaultWeights.period52w))
        ) / (defaultWeights.return + defaultWeights.yield + defaultWeights.risk + defaultWeights.period4w + defaultWeights.period52w);

        const caComposite = (
          (returnScore * defaultWeights.return) +
          (yieldScore * defaultWeights.yield) +
          (riskScore * defaultWeights.risk) +
          (caDripScore * (defaultWeights.period4w + defaultWeights.period52w))
        ) / (defaultWeights.return + defaultWeights.yield + defaultWeights.risk + defaultWeights.period4w + defaultWeights.period52w);

        // Store US scores
        scoreResults.push({
          ticker: etf.ticker,
          country: 'US',
          composite_score: usComposite,
          return_score: returnScore,
          yield_score: yieldScore,
          risk_score: riskScore,
          weights: defaultWeights
        });

        // Store CA scores
        scoreResults.push({
          ticker: etf.ticker,
          country: 'CA',
          composite_score: caComposite,
          return_score: returnScore,
          yield_score: yieldScore,
          risk_score: riskScore,
          weights: defaultWeights
        });

      } catch (error) {
        console.warn(`⚠️ Failed to calculate scores for ${etf.ticker}:`, error.message);
      }
    }

    // Upsert scores to database
    if (scoreResults.length > 0) {
      const { error: upsertError } = await supabase
        .from('etf_scores')
        .upsert(scoreResults, {
          onConflict: 'ticker,country',
          ignoreDuplicates: false
        });

      if (upsertError) {
        throw new Error(`Failed to upsert scores: ${upsertError.message}`);
      }
    }

    console.log(`✅ Hourly scoring update completed - processed ${scoreResults.length} scores`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Scores updated successfully',
        processedScores: scoreResults.length
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ Hourly scoring update failed:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 500 
      }
    );
  }
});

// Scoring helper functions
function calculateReturnScore(etf: any): number {
  if (!etf.total_return_1y || etf.total_return_1y <= 0) return 0;
  return Math.min(100, Math.max(0, etf.total_return_1y * 2)); // Scale 50% return to 100 points
}

function calculateYieldScore(etf: any): number {
  if (!etf.yield_ttm || etf.yield_ttm <= 0) return 0;
  return Math.min(100, Math.max(0, etf.yield_ttm * 10)); // Scale 10% yield to 100 points
}

function calculateRiskScore(etf: any): number {
  if (!etf.volatility_1y || etf.volatility_1y <= 0) return 100;
  // Lower volatility = higher score
  return Math.max(0, 100 - (etf.volatility_1y * 5));
}

function calculateDripScore(dripData: any): number {
  if (!dripData) return 50; // Default score if no DRIP data
  
  // Fix: Use 'growthPercent' not 'valueGrowthPct'
  const period4w = dripData.period_4w?.growthPercent || 0;
  const period52w = dripData.period_52w?.growthPercent || 0;
  
  console.log(`🔍 DRIP Score Debug:`, {
    period4w,
    period52w,
    raw4w: dripData.period_4w,
    raw52w: dripData.period_52w
  });
  
  // Weight 4-week and 52-week performance
  const score = (period4w * 0.8) + (period52w * 0.2);
  return Math.min(100, Math.max(0, score + 50)); // Normalize around 50
}