import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CryptoData {
  symbol: string;
  price: number;
  change_24h_pct: number;
  atr_pct: number;
  volume_usd: number;
  score?: number;
}

interface CryptoConfig {
  top_n: number;
  min_price: number;
  max_price: number;
  min_vol_usd: number;
  atr_lookback_days: number;
  atr_length: number;
  weights: {
    change: number;
    atr: number;
    volume: number;
  };
}

const DEFAULT_CONFIG: CryptoConfig = {
  top_n: 100,
  min_price: 0.01,
  max_price: 50000,
  min_vol_usd: 5_000_000,
  atr_lookback_days: 60,
  atr_length: 14,
  weights: {
    change: 0.55,
    atr: 0.30,
    volume: 0.15
  }
};

// Comprehensive crypto universe (major coins + trending altcoins)
const CRYPTO_CANDIDATES = [
  "BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "DOGE-USD", "ADA-USD", "AVAX-USD", 
  "LINK-USD", "LTC-USD", "BCH-USD", "MATIC-USD", "TRX-USD", "DOT-USD", "NEAR-USD",
  "APT-USD", "ARB-USD", "OP-USD", "SUI-USD", "ATOM-USD", "INJ-USD", "RNDR-USD",
  "AAVE-USD", "UNI-USD", "RUNE-USD", "FTM-USD", "SEI-USD", "STX-USD", "FIL-USD",
  "HBAR-USD", "GRT-USD", "ALGO-USD", "TIA-USD", "JTO-USD", "STRK-USD", "WIF-USD",
  "BONK-USD", "PEPE-USD", "SHIB-USD", "PYTH-USD", "ENA-USD", "TAO-USD", "ORDI-USD",
  "SAGA-USD", "AEVO-USD", "AR-USD", "IMX-USD", "ONDO-USD", "TON11419-USD", "BLUR-USD",
  "SKL-USD", "MINA-USD", "EOS-USD", "QTUM-USD", "KAS-USD", "RAY-USD", "CELO-USD",
  "KAVA-USD", "CFX-USD", "CKB-USD", "ANKR-USD", "ARPA-USD", "ID-USD", "HOOK-USD",
  "JUP-USD", "SNX-USD", "GMX-USD", "DYDX-USD"
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
    const customUniverse = body.universe || CRYPTO_CANDIDATES;
    
    console.log(`🔍 Filtering ${customUniverse.length} crypto symbols...`);

    const validCoins: CryptoData[] = [];
    let processed = 0;
    let errors = 0;
    
    // Process each crypto symbol
    for (const symbol of customUniverse) {
      try {
        processed++;
        const coinData = await getCryptoData(symbol, config);
        
        if (coinData && passesFilters(coinData, config)) {
          validCoins.push(coinData);
          console.log(`✅ ${symbol}: $${coinData.price.toFixed(4)}, 24h: ${coinData.change_24h_pct.toFixed(2)}%, ATR: ${coinData.atr_pct.toFixed(2)}%`);
        } else if (coinData) {
          console.log(`❌ ${symbol}: Filtered out - Price: $${coinData.price?.toFixed(4) || 'N/A'}, Vol: $${coinData.volume_usd ? (coinData.volume_usd/1e6).toFixed(1) + 'M' : 'N/A'}`);
        }
        
        // Rate limit protection
        if (processed % 15 === 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
      } catch (error) {
        errors++;
        console.error(`❌ Error processing ${symbol}:`, error.message);
      }
    }

    if (validCoins.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: "No crypto coins passed filters",
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Score and rank coins
    const scoredCoins = scoreCryptoCoins(validCoins, config);
    const finalUniverse = scoredCoins.slice(0, config.top_n);
    
    console.log(`✅ Crypto universe: ${finalUniverse.length} coins from ${processed} processed (${errors} errors)`);

    // Store in database
    const universeData = finalUniverse.map((coin, index) => ({
      symbol: coin.symbol,
      rank_order: index + 1,
      price: coin.price,
      change_24h_pct: coin.change_24h_pct,
      atr_pct: coin.atr_pct,
      volume_usd: coin.volume_usd,
      momentum_score: coin.score,
      filtered_at: new Date().toISOString(),
      filter_date: new Date().toISOString().split('T')[0]
    }));

    // Create table and store data
    await createCryptoUniverseTableIfNotExists(supabase);
    
    const today = new Date().toISOString().split('T')[0];
    
    const { error: deleteError } = await supabase
      .from('crypto_universe')
      .delete()
      .eq('filter_date', today);
      
    if (deleteError) {
      console.warn('Note: Could not clear previous crypto universe data:', deleteError);
    }

    const { error: insertError } = await supabase
      .from('crypto_universe')
      .insert(universeData);
      
    if (insertError) {
      console.error('Database insert error:', insertError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Crypto universe created with ${finalUniverse.length} coins`,
      universe: finalUniverse.map(c => c.symbol),
      details: finalUniverse,
      stats: {
        processed,
        errors,
        filtered: finalUniverse.length,
        config
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in filter-crypto-universe:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function getCryptoData(symbol: string, config: CryptoConfig): Promise<CryptoData | null> {
  try {
    // Use Yahoo Finance API for crypto data
    const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const quoteResponse = await fetch(quoteUrl);
    const quoteData = await quoteResponse.json();

    if (!quoteData.chart?.result?.[0]) return null;

    const result = quoteData.chart.result[0];
    const meta = result.meta;
    
    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.previousClose;
    const volume = meta.regularMarketVolume;
    
    const change_24h_pct = ((currentPrice - previousClose) / previousClose) * 100;
    const volume_usd = currentPrice * volume;

    // Get ATR data
    const atr_pct = await calculateATR(symbol, config.atr_lookback_days, config.atr_length);
    
    return {
      symbol,
      price: currentPrice,
      change_24h_pct,
      atr_pct: atr_pct || 0,
      volume_usd
    };

  } catch (error) {
    console.error(`Error fetching crypto data for ${symbol}:`, error);
    return null;
  }
}

async function calculateATR(symbol: string, lookbackDays: number, atrLength: number): Promise<number | null> {
  try {
    // Get historical data for ATR calculation
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (lookbackDays * 24 * 60 * 60);
    
    const histUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`;
    const histResponse = await fetch(histUrl);
    const histData = await histResponse.json();

    if (!histData.chart?.result?.[0]?.indicators?.quote?.[0]) return null;

    const quote = histData.chart.result[0].indicators.quote[0];
    const highs = quote.high;
    const lows = quote.low;
    const closes = quote.close;

    if (!highs || !lows || !closes || highs.length < atrLength + 1) return null;

    // Calculate True Range and ATR
    const trueRanges = [];
    for (let i = 1; i < highs.length; i++) {
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

    if (trueRanges.length < atrLength) return null;

    // Calculate ATR as simple moving average of TR
    const atrValues = [];
    for (let i = atrLength - 1; i < trueRanges.length; i++) {
      const atr = trueRanges.slice(i - atrLength + 1, i + 1).reduce((a, b) => a + b, 0) / atrLength;
      atrValues.push(atr);
    }

    const lastATR = atrValues[atrValues.length - 1];
    const lastClose = closes[closes.length - 1];
    
    return lastClose && lastATR ? (lastATR / lastClose) * 100 : null;

  } catch (error) {
    console.error(`ATR calculation error for ${symbol}:`, error);
    return null;
  }
}

function passesFilters(coin: CryptoData, config: CryptoConfig): boolean {
  if (coin.price < config.min_price || coin.price > config.max_price) {
    return false;
  }
  
  if (coin.volume_usd < config.min_vol_usd) {
    return false;
  }
  
  return true;
}

function scoreCryptoCoins(coins: CryptoData[], config: CryptoConfig): CryptoData[] {
  // Extract values for z-score calculation
  const changes = coins.map(c => c.change_24h_pct);
  const atrs = coins.map(c => c.atr_pct);
  const volumes = coins.map(c => Math.log(c.volume_usd)); // Log transform volume
  
  // Calculate z-scores
  const changeZ = calculateZScores(changes);
  const atrZ = calculateZScores(atrs);
  const volumeZ = calculateZScores(volumes);
  
  // Score each coin
  return coins.map((coin, i) => {
    const score = (
      config.weights.change * changeZ[i] +
      config.weights.atr * atrZ[i] +
      config.weights.volume * volumeZ[i]
    );
    
    return {
      ...coin,
      score: Math.round(score * 10000) / 10000
    };
  }).sort((a, b) => (b.score || 0) - (a.score || 0));
}

function calculateZScores(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return values.map(() => 0);
  
  return values.map(v => (v - mean) / stdDev);
}

async function createCryptoUniverseTableIfNotExists(supabase: any) {
  // This will be handled by migration if needed
}