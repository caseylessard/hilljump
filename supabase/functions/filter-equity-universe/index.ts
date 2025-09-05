import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TickerData {
  ticker: string;
  price: number;
  float_shares: number;
  avg_dollar_volume: number;
  exchange: string;
  market_cap?: number;
}

interface FilterConfig {
  require_float: boolean;
  min_float: number;
  max_float: number;
  max_price: number;
  min_avg_dollar_vol: number;
  max_out: number;
}

const DEFAULT_CONFIG: FilterConfig = {
  require_float: true,
  min_float: 1_000_000,
  max_float: 10_000_000,
  max_price: 2.00,
  min_avg_dollar_vol: 1_000_000,
  max_out: 100
};

// Seed universe of small-cap tickers (intentionally broad)
const RAW_UNIVERSE = [
  "FCUV", "GROM", "PXMD", "VRAX", "RVSN", "SNTG", "TOP", "TENX", "PEPG", "WINT",
  "PALI", "CING", "BTTX", "PRST", "KTRA", "COSM", "BIAF", "CYN", "CRKN", "SHPH",
  "TKAT", "PULM", "IMTE", "SONN", "MBRX", "ATHE", "GLMD", "ALZN", "ADIL", "APLM",
  "APVO", "BNED", "BRSH", "CBIO", "CEI", "CLNN", "CRDF", "CRVS", "CTXR", "CYTO",
  "DBGI", "ENSC", "FFIE", "FRGT", "GFAI", "GOVX", "GRPN", "HOOK", "HUBC", "ICCM",
  "IMRA", "INAB", "INBS", "INPX", "IPHA", "IRIX", "IVER", "JZXN", "KAVL", "KOSS",
  "LIDR", "LIFW", "LOAN", "MBIO", "MEGL", "MLGO", "MMV", "NERV", "NUVB", "OP",
  "OPTT", "PHGE", "PRTG", "PTPI", "RNXT", "RSLS", "SCPS", "SEED", "SIDU", "SLNO",
  "SMFL", "SNSE", "SNTI", "SPRO", "STRM", "STSS", "TAOP", "TCBP", "TCON", "THMO",
  "TRVN", "UCAR", "USEA", "VEDU", "VERA", "VGAS", "VINO", "VIRI", "VRAR", "VRME",
  "VRPX", "WLDS", "WISA", "WKEY", "WORX", "XPON", "YVR"
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
    const customUniverse = body.universe || RAW_UNIVERSE;
    
    console.log(`🔍 Filtering ${customUniverse.length} tickers for small-cap universe...`);

    const validTickers: TickerData[] = [];
    let processed = 0;
    let errors = 0;
    
    // Process each ticker in the seed universe
    for (const ticker of customUniverse) {
      try {
        processed++;
        const tickerData = await getTickerDetails(ticker, polygonApiKey, alphaVantageKey);
        
        if (tickerData && passesFilters(tickerData, config)) {
          validTickers.push(tickerData);
          console.log(`✅ ${ticker}: $${tickerData.price.toFixed(2)}, Float: ${(tickerData.float_shares/1e6).toFixed(1)}M`);
        } else if (tickerData) {
          console.log(`❌ ${ticker}: Filtered out - Price: $${tickerData.price?.toFixed(2) || 'N/A'}, Float: ${tickerData.float_shares ? (tickerData.float_shares/1e6).toFixed(1) + 'M' : 'N/A'}`);
        }
        
        // Rate limit protection
        if (processed % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        errors++;
        console.error(`❌ Error processing ${ticker}:`, error.message);
      }
    }

    // Sort by smallest float first, then highest liquidity
    validTickers.sort((a, b) => {
      if (a.float_shares !== b.float_shares) {
        return a.float_shares - b.float_shares;
      }
      return b.avg_dollar_volume - a.avg_dollar_volume;
    });

    // Limit to max output
    const finalUniverse = validTickers.slice(0, config.max_out);
    
    console.log(`✅ Filtered universe: ${finalUniverse.length} tickers from ${processed} processed (${errors} errors)`);

    // Store in database for future use
    const universeData = finalUniverse.map((ticker, index) => ({
      ticker: ticker.ticker,
      rank_order: index + 1,
      price: ticker.price,
      float_shares: ticker.float_shares,
      avg_dollar_volume: ticker.avg_dollar_volume,
      exchange: ticker.exchange,
      market_cap: ticker.market_cap,
      filtered_at: new Date().toISOString(),
      filter_date: new Date().toISOString().split('T')[0]
    }));

    // Create or update universe table
    await createUniverseTableIfNotExists(supabase);
    
    // Clear previous day's data and insert new
    const today = new Date().toISOString().split('T')[0];
    
    const { error: deleteError } = await supabase
      .from('equity_universe')
      .delete()
      .eq('filter_date', today);
      
    if (deleteError) {
      console.warn('Note: Could not clear previous universe data:', deleteError);
    }

    const { error: insertError } = await supabase
      .from('equity_universe')
      .insert(universeData);
      
    if (insertError) {
      console.error('Database insert error:', insertError);
      // Continue anyway, return the filtered data
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Filtered universe created with ${finalUniverse.length} tickers`,
      universe: finalUniverse.map(t => t.ticker),
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
    console.error('❌ Error in filter-equity-universe:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function getTickerDetails(ticker: string, polygonKey?: string, alphaKey?: string): Promise<TickerData | null> {
  try {
    // Try Polygon first for best data quality
    if (polygonKey) {
      return await getPolygonDetails(ticker, polygonKey);
    }
    
    // Fallback to Alpha Vantage
    if (alphaKey) {
      return await getAlphaVantageDetails(ticker, alphaKey);
    }

    // Final fallback to Yahoo Finance
    return await getYahooDetails(ticker);

  } catch (error) {
    console.error(`Error fetching details for ${ticker}:`, error);
    return null;
  }
}

async function getPolygonDetails(ticker: string, apiKey: string): Promise<TickerData | null> {
  try {
    // Get ticker details
    const detailsUrl = `https://api.polygon.io/v3/reference/tickers/${ticker}?apikey=${apiKey}`;
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();

    if (!detailsData.results) return null;

    const details = detailsData.results;
    
    // Check if it's on a major US exchange
    const exchange = details.primary_exchange;
    if (!isValidExchange(exchange)) return null;
    
    // Check if it's an ETF/ETP
    if (isETF(details)) return null;

    // Get current price data
    const prevCloseUrl = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apikey=${apiKey}`;
    const prevResponse = await fetch(prevCloseUrl);
    const prevData = await prevResponse.json();

    if (!prevData.results || prevData.results.length === 0) return null;

    const price = prevData.results[0].c;
    const volume = prevData.results[0].v;
    
    return {
      ticker,
      price,
      float_shares: details.share_class_shares_outstanding || details.weighted_shares_outstanding,
      avg_dollar_volume: price * volume, // Approximation
      exchange,
      market_cap: details.market_cap
    };

  } catch (error) {
    console.error(`Polygon error for ${ticker}:`, error);
    return null;
  }
}

async function getAlphaVantageDetails(ticker: string, apiKey: string): Promise<TickerData | null> {
  try {
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.Symbol) return null;

    const exchange = data.Exchange;
    if (!isValidExchange(exchange)) return null;
    
    // Basic ETF detection
    if (data.AssetType?.includes('ETF') || data.Name?.includes('ETF')) return null;

    // Get quote data
    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${apiKey}`;
    const quoteResponse = await fetch(quoteUrl);
    const quoteData = await quoteResponse.json();

    const quote = quoteData["Global Quote"];
    if (!quote) return null;

    const price = parseFloat(quote["05. price"]);
    const volume = parseFloat(quote["06. volume"]);
    
    return {
      ticker,
      price,
      float_shares: parseFloat(data.SharesFloat) || parseFloat(data.SharesOutstanding),
      avg_dollar_volume: price * volume, // Approximation
      exchange,
      market_cap: parseFloat(data.MarketCapitalization)
    };

  } catch (error) {
    console.error(`Alpha Vantage error for ${ticker}:`, error);
    return null;
  }
}

async function getYahooDetails(ticker: string): Promise<TickerData | null> {
  try {
    // Get basic quote
    const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
    const quoteResponse = await fetch(quoteUrl);
    const quoteData = await quoteResponse.json();

    if (!quoteData.chart?.result?.[0]) return null;

    const result = quoteData.chart.result[0];
    const meta = result.meta;
    
    // Check exchange
    if (!isValidExchange(meta.exchangeName)) return null;

    // Get additional details
    const summaryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=defaultKeyStatistics,summaryDetail`;
    const summaryResponse = await fetch(summaryUrl);
    const summaryData = await summaryResponse.json();

    const stats = summaryData.quoteSummary?.result?.[0];
    const keyStats = stats?.defaultKeyStatistics;
    const summary = stats?.summaryDetail;

    // Basic ETF detection
    if (meta.instrumentType === 'ETF' || ticker.includes('ETF')) return null;

    const price = meta.regularMarketPrice;
    const volume = meta.regularMarketVolume;
    
    return {
      ticker,
      price,
      float_shares: keyStats?.floatShares?.raw || keyStats?.sharesOutstanding?.raw,
      avg_dollar_volume: price * (keyStats?.averageVolume?.raw || volume || 0),
      exchange: meta.exchangeName,
      market_cap: summary?.marketCap?.raw
    };

  } catch (error) {
    console.error(`Yahoo Finance error for ${ticker}:`, error);
    return null;
  }
}

function isValidExchange(exchange: string): boolean {
  if (!exchange) return false;
  const exchUpper = exchange.toUpperCase();
  return ['NASDAQ', 'NYSE', 'AMEX', 'NMS', 'BATS', 'XNAS', 'XNYS'].some(valid => 
    exchUpper.includes(valid)
  );
}

function isETF(details: any): boolean {
  const type = (details.type || details.quoteType || '').toUpperCase();
  const name = (details.name || details.shortName || details.longName || '').toUpperCase();
  
  return (
    ['ETF', 'ETP', 'MUTUALFUND'].includes(type) ||
    name.includes(' ETF') ||
    name.includes(' ETN') ||
    name.includes(' TRUST')
  );
}

function passesFilters(ticker: TickerData, config: FilterConfig): boolean {
  // Price filter
  if (!ticker.price || ticker.price > config.max_price) {
    return false;
  }

  // Float shares filter
  if (config.require_float && !ticker.float_shares) {
    return false;
  }
  
  if (ticker.float_shares && (ticker.float_shares < config.min_float || ticker.float_shares > config.max_float)) {
    return false;
  }

  // Average dollar volume filter
  if (ticker.avg_dollar_volume < config.min_avg_dollar_vol) {
    return false;
  }

  return true;
}

async function createUniverseTableIfNotExists(supabase: any) {
  // This will be handled by migration if needed
  // For now, we'll assume the table exists or create via SQL migration
}