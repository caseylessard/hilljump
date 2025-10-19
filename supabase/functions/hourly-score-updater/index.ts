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

  // Authentication check for cron jobs
  const cronSecret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('X-Cron-Secret');
  
  if (!cronSecret || providedSecret !== cronSecret) {
    console.error('❌ Unauthorized access attempt to hourly-score-updater');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
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
  if (!etf.total_return_1y || isNaN(etf.total_return_1y)) return 30; // Default neutral score
  
  // Normalize returns: -50% = 0 points, 0% = 30 points, 50% = 100 points
  const returnPct = etf.total_return_1y * 100; // Convert to percentage
  const normalized = ((returnPct + 50) / 100) * 100; // Scale from -50% to +50% range
  return Math.min(100, Math.max(0, normalized));
}

function calculateYieldScore(etf: any): number {
  if (!etf.yield_ttm || isNaN(etf.yield_ttm)) return 30; // Default neutral score
  
  // Normalize yields: 0% = 0 points, 5% = 50 points, 15%+ = 100 points
  const yieldPct = etf.yield_ttm * 100; // Convert to percentage
  const normalized = Math.min(100, (yieldPct / 15) * 100);
  return Math.max(0, normalized);
}

function calculateRiskScore(etf: any): number {
  if (!etf.volatility_1y || isNaN(etf.volatility_1y)) return 50; // Default neutral score
  
  // Normalize volatility: 5% vol = 100 points, 25% vol = 0 points
  const volPct = etf.volatility_1y * 100; // Convert to percentage  
  const normalized = Math.max(0, 100 - ((volPct - 5) / 20) * 100);
  return Math.min(100, Math.max(0, normalized));
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