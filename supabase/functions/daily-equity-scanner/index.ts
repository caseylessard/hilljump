import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EquityMetrics {
  ticker: string;
  price?: number;
  prev_close?: number;
  premarket_price?: number;
  premarket_change_pct?: number;
  avg_vol_3m?: number;
  cur_vol?: number;
  rel_vol?: number;
  float_shares?: number;
  news_recent_count?: number;
  exchange?: string;
  mover_score?: number;
}

interface ScanConfig {
  min_price: number;
  max_price: number;
  max_float_shares: number;
  min_gap_pct: number;
  news_hours: number;
  weights: {
    gap: number;
    rel_vol: number;
    float: number;
    news: number;
  };
}

const DEFAULT_CONFIG: ScanConfig = {
  min_price: 1.0,
  max_price: 25.0,
  max_float_shares: 20_000_000,
  min_gap_pct: 2.0,
  news_hours: 36,
  weights: {
    gap: 0.5,
    rel_vol: 0.22,
    float: 0.18,
    news: 0.1
  }
};

const DEFAULT_UNIVERSE = [
  "FCUV", "TSLY", "MSTY", "PLTY", "AMDY", "NVDY", "RYLD", "RYLG", 
  "MARO", "SNOY", "JEPI", "JEPQ", "SCHD", "DIVO", "QYLD"
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const polygonApiKey = Deno.env.get("POLYGON_API_KEY");
  const alphaVantageKey = Deno.env.get("ALPHA_VANTAGE_API_KEY");
  
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const config = { ...DEFAULT_CONFIG, ...body.config };
    
    // Use filtered universe from DB if available, otherwise use provided/default
    let universe = body.universe || DEFAULT_UNIVERSE;
    
    if (body.use_filtered_universe !== false) {
      try {
        const { data: filteredUniverse, error } = await supabase
          .from('equity_universe')
          .select('ticker')
          .order('rank_order', { ascending: true })
          .limit(50);
          
        if (!error && filteredUniverse && filteredUniverse.length > 0) {
          universe = filteredUniverse.map(t => t.ticker);
          console.log(`📊 Using filtered universe of ${universe.length} tickers`);
        } else {
          console.log(`⚠️ No filtered universe found, using ${universe.length} default tickers`);
        }
      } catch (error) {
        console.warn('Could not fetch filtered universe:', error);
      }
    }
    
    console.log(`🔍 Scanning ${universe.length} tickers for daily movers...`);

    const metrics: EquityMetrics[] = [];
    
    // Fetch metrics for each ticker
    for (const ticker of universe) {
      try {
        const tickerMetrics = await getTickerMetrics(ticker, polygonApiKey, alphaVantageKey);
        if (tickerMetrics && passesBasicFilters(tickerMetrics, config)) {
          metrics.push(tickerMetrics);
        }
      } catch (error) {
        console.error(`❌ Error fetching ${ticker}:`, error);
      }
    }

    if (metrics.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: "No tickers passed basic filters",
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Score and rank candidates
    const scored = scoreCandidates(metrics, config);
    const topPicks = scored.slice(0, 5);

    console.log(`✅ Found ${scored.length} candidates, top pick: ${topPicks[0].ticker}`);

    // Save to database
    const alertsData = topPicks.map((pick, index) => ({
      pick_date: new Date().toISOString().split('T')[0],
      picked_at: new Date().toISOString(),
      rank_order: index + 1,
      ticker: pick.ticker,
      exchange: pick.exchange,
      price: pick.price,
      premarket_change_pct: pick.premarket_change_pct,
      rel_vol: pick.rel_vol,
      float_shares: pick.float_shares,
      news_recent_count: pick.news_recent_count,
      atr_pct: null, // Not calculated in this version
      yday_high: null,
      yday_low: null,
      target_growth_pct: calculateTargetGrowth(pick),
      likelihood_of_win: pick.mover_score,
      entry_price: pick.price,
      stop_price: calculateStopPrice(pick),
      tp1_price: calculateTP1(pick),
      tp2_price: calculateTP2(pick)
    }));

    const { error } = await supabase
      .from("equity_alerts")
      .upsert(alertsData, {
        onConflict: "pick_date,rank_order,ticker"
      });

    if (error) {
      console.error("❌ Database error:", error);
      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully processed ${topPicks.length} equity alerts`,
      top_pick: topPicks[0],
      all_picks: topPicks,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in daily-equity-scanner:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function getTickerMetrics(ticker: string, polygonKey?: string, alphaKey?: string): Promise<EquityMetrics | null> {
  try {
    // Try Polygon first if available
    if (polygonKey) {
      return await getPolygonMetrics(ticker, polygonKey);
    }
    
    // Fallback to Alpha Vantage
    if (alphaKey) {
      return await getAlphaVantageMetrics(ticker, alphaKey);
    }

    // Final fallback to Yahoo Finance (no auth required)
    return await getYahooMetrics(ticker);

  } catch (error) {
    console.error(`Error fetching metrics for ${ticker}:`, error);
    return null;
  }
}

async function getPolygonMetrics(ticker: string, apiKey: string): Promise<EquityMetrics | null> {
  try {
    // Get previous close and current data
    const prevCloseUrl = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apikey=${apiKey}`;
    const prevResponse = await fetch(prevCloseUrl);
    const prevData = await prevResponse.json();

    if (!prevData.results || prevData.results.length === 0) {
      return null;
    }

    const prevClose = prevData.results[0].c;
    
    // Get current quote
    const quoteUrl = `https://api.polygon.io/v1/last_quote/stocks/${ticker}?apikey=${apiKey}`;
    const quoteResponse = await fetch(quoteUrl);
    const quoteData = await quoteResponse.json();

    const currentPrice = quoteData.last?.bid || prevClose;
    const premarket_change_pct = ((currentPrice - prevClose) / prevClose) * 100;

    // Get ticker details for float shares
    const detailsUrl = `https://api.polygon.io/v3/reference/tickers/${ticker}?apikey=${apiKey}`;
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();

    return {
      ticker,
      price: currentPrice,
      prev_close: prevClose,
      premarket_price: currentPrice,
      premarket_change_pct,
      float_shares: detailsData.results?.share_class_shares_outstanding,
      exchange: detailsData.results?.primary_exchange || "NASDAQ",
      news_recent_count: 0 // Would need separate news API call
    };

  } catch (error) {
    console.error(`Polygon error for ${ticker}:`, error);
    return null;
  }
}

async function getAlphaVantageMetrics(ticker: string, apiKey: string): Promise<EquityMetrics | null> {
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    const quote = data["Global Quote"];
    if (!quote) return null;

    const currentPrice = parseFloat(quote["05. price"]);
    const prevClose = parseFloat(quote["08. previous close"]);
    const change_pct = parseFloat(quote["10. change percent"].replace('%', ''));

    return {
      ticker,
      price: currentPrice,
      prev_close: prevClose,
      premarket_price: currentPrice,
      premarket_change_pct: change_pct,
      exchange: "NASDAQ/NYSE",
      news_recent_count: 0
    };

  } catch (error) {
    console.error(`Alpha Vantage error for ${ticker}:`, error);
    return null;
  }
}

async function getYahooMetrics(ticker: string): Promise<EquityMetrics | null> {
  try {
    // Simple Yahoo Finance API call (no auth required)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return null;
    }

    const result = data.chart.result[0];
    const meta = result.meta;
    const currentPrice = meta.regularMarketPrice;
    const prevClose = meta.previousClose;
    const premarket_change_pct = ((currentPrice - prevClose) / prevClose) * 100;

    return {
      ticker,
      price: currentPrice,
      prev_close: prevClose,
      premarket_price: currentPrice,
      premarket_change_pct,
      exchange: meta.exchangeName || "NASDAQ",
      news_recent_count: 0
    };

  } catch (error) {
    console.error(`Yahoo Finance error for ${ticker}:`, error);
    return null;
  }
}

function passesBasicFilters(metrics: EquityMetrics, config: ScanConfig): boolean {
  if (!metrics.price || metrics.price < config.min_price || metrics.price > config.max_price) {
    return false;
  }
  
  if (!metrics.premarket_change_pct || metrics.premarket_change_pct < config.min_gap_pct) {
    return false;
  }
  
  return true;
}

function scoreCandidates(metrics: EquityMetrics[], config: ScanConfig): EquityMetrics[] {
  // Extract values for z-score calculation
  const gaps = metrics.map(m => m.premarket_change_pct || 0);
  const relVols = metrics.map(m => m.rel_vol || 0);
  const floats = metrics.map(m => m.float_shares ? Math.log(m.float_shares) : 0);
  const news = metrics.map(m => Math.min(m.news_recent_count || 0, 3) / 3.0);

  // Calculate z-scores
  const gapZ = calculateZScores(gaps);
  const relVolZ = calculateZScores(relVols);
  const floatZ = calculateZScores(floats).map(z => -z); // Invert for float (smaller is better)

  // Score each candidate
  return metrics.map((m, i) => {
    const lowFloatBonus = m.float_shares && m.float_shares <= config.max_float_shares ? 
      (m.float_shares <= 10_000_000 ? 0.25 : 0.12) : 0;

    const score = (
      config.weights.gap * gapZ[i] +
      config.weights.rel_vol * relVolZ[i] +
      config.weights.float * (floatZ[i] + lowFloatBonus) +
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

function calculateTargetGrowth(pick: EquityMetrics): number {
  // Simple target based on gap and volatility
  const baseTarget = Math.abs(pick.premarket_change_pct || 0) * 1.5;
  return Math.min(Math.max(baseTarget, 5.0), 25.0);
}

function calculateStopPrice(pick: EquityMetrics): number {
  const price = pick.price || 0;
  return price * 0.95; // 5% stop loss
}

function calculateTP1(pick: EquityMetrics): number {
  const price = pick.price || 0;
  return price * 1.08; // 8% first target
}

function calculateTP2(pick: EquityMetrics): number {
  const price = pick.price || 0;
  return price * 1.15; // 15% second target
}