import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CryptoMetrics {
  symbol: string;
  price?: number;
  change_24h_pct?: number;
  rel_vol?: number;
  news_recent_count?: number;
  atr_pct?: number;
  yday_high?: number;
  yday_low?: number;
  mover_score?: number;
}

interface CryptoScanConfig {
  min_price: number;
  max_price: number;
  min_change_24h_pct: number;
  atr_len: number;
  atr_lookback_days: number;
  weights: {
    change: number;
    rel_vol: number;
    news: number;
  };
  target: {
    min: number;
    max: number;
    atr_w: number;
    change_w: number;
  };
}

const DEFAULT_CONFIG: CryptoScanConfig = {
  min_price: 0.05,
  max_price: 5000,
  min_change_24h_pct: 1.5,
  atr_len: 14,
  atr_lookback_days: 120,
  weights: {
    change: 0.6,
    rel_vol: 0.3,
    news: 0.1
  },
  target: {
    min: 3.0,
    max: 18.0,
    atr_w: 0.65,
    change_w: 0.35
  }
};

const DEFAULT_UNIVERSE = [
  "BTC-USD", "ETH-USD", "SOL-USD", "DOGE-USD", "ADA-USD", "AVAX-USD", 
  "MATIC-USD", "DOT-USD", "LINK-USD", "UNI-USD"
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const config = { ...DEFAULT_CONFIG, ...body.config };
    
    // Use filtered universe from DB if available
    let universe = body.universe || DEFAULT_UNIVERSE;
    
    if (body.use_filtered_universe !== false) {
      try {
        const { data: filteredUniverse, error } = await supabase
          .from('crypto_universe')
          .select('symbol')
          .order('rank_order', { ascending: true })
          .limit(25);
          
        if (!error && filteredUniverse && filteredUniverse.length > 0) {
          universe = filteredUniverse.map(c => c.symbol);
          console.log(`📊 Using filtered crypto universe of ${universe.length} coins`);
        } else {
          console.log(`⚠️ No filtered crypto universe found, using ${universe.length} default coins`);
        }
      } catch (error) {
        console.warn('Could not fetch filtered crypto universe:', error);
      }
    }
    
    console.log(`🔍 Scanning ${universe.length} crypto symbols for momentum alerts...`);

    const metrics: CryptoMetrics[] = [];
    
    // Fetch metrics for each crypto symbol
    for (const symbol of universe) {
      try {
        const cryptoMetrics = await getCryptoMetrics(symbol);
        if (cryptoMetrics && passesBasicFilters(cryptoMetrics, config)) {
          metrics.push(cryptoMetrics);
        }
      } catch (error) {
        console.error(`❌ Error fetching ${symbol}:`, error);
      }
    }

    if (metrics.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: "No crypto symbols passed basic filters",
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Score and rank candidates
    const scored = scoreCryptoCandidates(metrics, config);
    const topPicks = scored.slice(0, 5);

    console.log(`✅ Found ${scored.length} crypto candidates, top pick: ${topPicks[0].symbol}`);

    // Save to database
    const alertsData = topPicks.map((pick, index) => ({
      pick_date: new Date().toISOString().split('T')[0],
      picked_at: new Date().toISOString(),
      rank_order: index + 1,
      symbol: pick.symbol,
      price: pick.price,
      change_24h_pct: pick.change_24h_pct,
      rel_vol: pick.rel_vol,
      news_recent_count: pick.news_recent_count,
      atr_pct: pick.atr_pct,
      yday_high: pick.yday_high,
      yday_low: pick.yday_low,
      target_growth_pct: calculateTargetGrowth(pick, config),
      likelihood_of_win: pick.mover_score,
      entry_price: pick.price,
      stop_price: calculateStopPrice(pick),
      tp1_price: calculateTP1(pick),
      tp2_price: calculateTP2(pick)
    }));

    const { error } = await supabase
      .from("crypto_alerts")
      .upsert(alertsData, {
        onConflict: "pick_date,rank_order,symbol"
      });

    if (error) {
      console.error("❌ Database error:", error);
      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully processed ${topPicks.length} crypto alerts`,
      top_pick: topPicks[0],
      all_picks: topPicks,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in daily-crypto-scanner:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function getCryptoMetrics(symbol: string): Promise<CryptoMetrics | null> {
  try {
    // Get current quote data
    const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const quoteResponse = await fetch(quoteUrl);
    const quoteData = await quoteResponse.json();

    if (!quoteData.chart?.result?.[0]) return null;

    const result = quoteData.chart.result[0];
    const meta = result.meta;
    
    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.previousClose;
    const volume = meta.regularMarketVolume;
    const avgVolume = meta.averageDailyVolume3Month;
    
    const change_24h_pct = ((currentPrice - previousClose) / previousClose) * 100;
    const rel_vol = avgVolume && avgVolume > 0 ? volume / avgVolume : null;

    // Get ATR and high/low data
    const { atr_pct, yday_high, yday_low } = await getCryptoTechnicals(symbol);

    return {
      symbol,
      price: currentPrice,
      change_24h_pct,
      rel_vol,
      news_recent_count: 0, // Crypto news is harder to get via free APIs
      atr_pct,
      yday_high,
      yday_low
    };

  } catch (error) {
    console.error(`Error fetching crypto metrics for ${symbol}:`, error);
    return null;
  }
}

async function getCryptoTechnicals(symbol: string): Promise<{ atr_pct: number | null, yday_high: number | null, yday_low: number | null }> {
  try {
    // Get 30 days of data for ATR calculation and yesterday's high/low
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (30 * 24 * 60 * 60);
    
    const histUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`;
    const histResponse = await fetch(histUrl);
    const histData = await histResponse.json();

    if (!histData.chart?.result?.[0]?.indicators?.quote?.[0]) {
      return { atr_pct: null, yday_high: null, yday_low: null };
    }

    const quote = histData.chart.result[0].indicators.quote[0];
    const highs = quote.high;
    const lows = quote.low;
    const closes = quote.close;

    if (!highs || !lows || !closes || highs.length < 15) {
      return { atr_pct: null, yday_high: null, yday_low: null };
    }

    // Get yesterday's high/low (second to last trading day)
    const yday_high = highs.length >= 2 ? highs[highs.length - 2] : null;
    const yday_low = lows.length >= 2 ? lows[lows.length - 2] : null;

    // Calculate 14-day ATR
    const atrLength = 14;
    const trueRanges = [];
    
    for (let i = 1; i < Math.min(highs.length, atrLength + 5); i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];
      
      if (high !== null && low !== null && prevClose !== null) {
        const tr = Math.max(
          high - low,
          Math.abs(high - prevClose),
          Math.abs(low - prevClose)
        );
        trueRanges.push(tr);
      }
    }

    let atr_pct = null;
    if (trueRanges.length >= atrLength) {
      const atr = trueRanges.slice(-atrLength).reduce((a, b) => a + b, 0) / atrLength;
      const lastClose = closes[closes.length - 1];
      atr_pct = lastClose && atr ? (atr / lastClose) * 100 : null;
    }

    return { atr_pct, yday_high, yday_low };

  } catch (error) {
    console.error(`Error fetching technicals for ${symbol}:`, error);
    return { atr_pct: null, yday_high: null, yday_low: null };
  }
}

function passesBasicFilters(metrics: CryptoMetrics, config: CryptoScanConfig): boolean {
  if (!metrics.price || metrics.price < config.min_price || metrics.price > config.max_price) {
    return false;
  }
  
  if (!metrics.change_24h_pct || Math.abs(metrics.change_24h_pct) < config.min_change_24h_pct) {
    return false;
  }
  
  return true;
}

function scoreCryptoCandidates(metrics: CryptoMetrics[], config: CryptoScanConfig): CryptoMetrics[] {
  // Extract values for z-score calculation
  const changes = metrics.map(m => Math.abs(m.change_24h_pct || 0)); // Use absolute change for crypto
  const relVols = metrics.map(m => m.rel_vol || 0);
  const news = metrics.map(m => (m.news_recent_count || 0) / 3.0); // Normalize news

  // Calculate z-scores
  const changeZ = calculateZScores(changes);
  const relVolZ = calculateZScores(relVols);

  // Score each candidate
  return metrics.map((m, i) => {
    const score = (
      config.weights.change * changeZ[i] +
      config.weights.rel_vol * relVolZ[i] +
      config.weights.news * news[i]
    );

    return {
      ...m,
      mover_score: Math.round(score * 10000) / 10000
    };
  }).sort((a, b) => (b.mover_score || 0) - (a.mover_score || 0));
}

function calculateZScores(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return values.map(() => 0);
  
  return values.map(v => (v - mean) / stdDev);
}

function calculateTargetGrowth(pick: CryptoMetrics, config: CryptoScanConfig): number {
  const baseTarget = Math.abs(pick.change_24h_pct || 0) * config.target.change_w +
                   (pick.atr_pct || 0) * config.target.atr_w;
  return Math.min(Math.max(baseTarget, config.target.min), config.target.max);
}

function calculateStopPrice(pick: CryptoMetrics): number {
  const price = pick.price || 0;
  return price * 0.93; // 7% stop loss for crypto (more volatile)
}

function calculateTP1(pick: CryptoMetrics): number {
  const price = pick.price || 0;
  return price * 1.12; // 12% first target
}

function calculateTP2(pick: CryptoMetrics): number {
  const price = pick.price || 0;
  return price * 1.25; // 25% second target
}