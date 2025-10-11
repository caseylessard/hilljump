import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptionCandidate {
  ticker: string;
  currentPrice: number;
  strike: number;
  premium: number;
  expiry: string;
  earningsDate: string;
  impliedVol: number;
}

interface PolygonOptionContract {
  ticker: string;
  strike_price: number;
  expiration_date: string;
  contract_type: string;
}

interface PolygonSnapshot {
  implied_volatility?: number;
  last_quote?: {
    ask: number;
    bid: number;
  };
  day?: {
    volume: number;
    open_interest: number;
  };
}

const CACHE_TTL = 300; // 5 minutes
const VOLATILITY_MAP: Record<string, number> = {
  'NVDA': 0.45,
  'PLTR': 0.55,
  'TSLA': 0.6,
  'AAPL': 0.3,
  'MSFT': 0.28,
  'GOOGL': 0.32,
  'AMD': 0.5,
  'SOFI': 0.65,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tickers } = await req.json();
    
    if (!tickers || !Array.isArray(tickers)) {
      throw new Error('Invalid request: tickers array required');
    }

    const polygonApiKey = Deno.env.get('POLYGON_API_KEY');
    if (!polygonApiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching options data for:', tickers);

    const signals: OptionCandidate[] = [];

    for (const ticker of tickers) {
      try {
        const result = await researchTicker(ticker, polygonApiKey, supabase);
        if (result) {
          signals.push(result);
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (tickerError) {
        console.error(`Error processing ${ticker}:`, tickerError);
      }
    }

    console.log(`Generated ${signals.length} option signals`);

    return new Response(
      JSON.stringify({
        success: true,
        signals,
        count: signals.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in polygon-options-scanner:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function researchTicker(ticker: string, apiKey: string, supabase: any): Promise<OptionCandidate | null> {
  try {
    // Check cache first
    const cacheKey = `options_${ticker}_${Math.floor(Date.now() / (CACHE_TTL * 1000))}`;
    const { data: cachedData } = await supabase
      .from('options_cache')
      .select('data')
      .eq('cache_key', cacheKey)
      .single();

    if (cachedData) {
      console.log(`Cache hit for ${ticker}`);
      return cachedData.data;
    }

    // Fetch current price
    const quote = await fetchPolygonQuote(ticker, apiKey);
    if (!quote) return null;

    // Fetch real options data
    const optionsData = await fetchPolygonOptions(ticker, quote.currentPrice, apiKey);
    
    let optimalOption;
    if (optionsData && optionsData.length > 0) {
      optimalOption = findOptimalCall(quote.currentPrice, optionsData);
    }

    // Fallback to synthetic option if no real data
    if (!optimalOption) {
      console.log(`No real options data for ${ticker}, generating synthetic`);
      optimalOption = generateSyntheticOption(quote.currentPrice, ticker);
    }

    const result: OptionCandidate = {
      ticker,
      currentPrice: quote.currentPrice,
      strike: optimalOption.strike,
      expiry: optimalOption.expiration,
      impliedVol: optimalOption.impliedVolatility || 0.5,
      premium: optimalOption.premium,
      earningsDate: quote.earningsDate || estimateEarningsDate(),
    };

    // Cache the result
    await supabase.from('options_cache').upsert({
      cache_key: cacheKey,
      ticker,
      data: result,
      expires_at: new Date(Date.now() + CACHE_TTL * 1000).toISOString(),
    });

    return result;
  } catch (error) {
    console.error(`Error researching ${ticker}:`, error);
    return null;
  }
}

async function fetchPolygonQuote(ticker: string, apiKey: string): Promise<{ currentPrice: number; earningsDate: string } | null> {
  try {
    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${apiKey}`;
    console.log(`Fetching quote for ${ticker}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch quote for ${ticker}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const currentPrice = data.results?.[0]?.c;

    if (!currentPrice) {
      console.error(`No price data for ${ticker}`);
      return null;
    }

    return {
      currentPrice,
      earningsDate: estimateEarningsDate(),
    };
  } catch (error) {
    console.error(`Error fetching quote for ${ticker}:`, error);
    return null;
  }
}

async function fetchPolygonOptions(ticker: string, currentPrice: number, apiKey: string): Promise<any[] | null> {
  try {
    // Calculate target expiration (45 days out)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 45);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    // Fetch options contracts
    const contractsUrl = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}&contract_type=call&expiration_date.gte=${targetDateStr}&limit=250&apiKey=${apiKey}`;
    console.log(`Fetching options contracts for ${ticker}`);
    
    const response = await fetch(contractsUrl);
    if (!response.ok) {
      console.log(`Options data not available for ${ticker}`);
      return null;
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      console.log(`No options contracts found for ${ticker}`);
      return null;
    }

    // Filter for contracts near our target date and strike
    const targetStrike = currentPrice * 1.1;
    const contracts = data.results
      .filter((c: PolygonOptionContract) => {
        const strike = c.strike_price;
        return strike >= currentPrice * 1.05 && strike <= currentPrice * 1.2;
      })
      .slice(0, 20); // Limit to prevent too many API calls

    if (contracts.length === 0) return null;

    // Fetch snapshots for each contract to get pricing
    const optionsWithData = [];
    for (const contract of contracts) {
      try {
        const snapshotUrl = `https://api.polygon.io/v3/snapshot/options/${ticker}/${contract.ticker}?apiKey=${apiKey}`;
        const snapRes = await fetch(snapshotUrl);
        
        if (snapRes.ok) {
          const snapData = await snapRes.json();
          const snap: PolygonSnapshot = snapData.results;
          
          if (snap.last_quote?.ask && snap.day?.volume) {
            optionsWithData.push({
              strike: contract.strike_price,
              expiration: contract.expiration_date,
              ask: snap.last_quote.ask,
              bid: snap.last_quote.bid || snap.last_quote.ask * 0.95,
              volume: snap.day.volume,
              openInterest: snap.day.open_interest || 0,
              impliedVolatility: snap.implied_volatility || 0.4,
            });
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
      } catch (err) {
        console.error(`Error fetching snapshot for ${contract.ticker}:`, err);
      }
    }

    return optionsWithData.length > 0 ? optionsWithData : null;
  } catch (error) {
    console.error(`Error fetching options for ${ticker}:`, error);
    return null;
  }
}

function findOptimalCall(currentPrice: number, calls: any[]): any {
  if (!calls || calls.length === 0) return null;

  const targetStrike = currentPrice * 1.1;

  // Filter for liquid options
  const liquidCalls = calls.filter(
    (call) => call.volume > 5 || call.openInterest > 10
  );

  if (liquidCalls.length === 0) return null;

  // Find closest to target strike
  const optimalCall = liquidCalls.reduce((best, option) => {
    const targetDiff = Math.abs(option.strike - targetStrike);
    const bestDiff = Math.abs(best.strike - targetStrike);
    return targetDiff < bestDiff ? option : best;
  }, liquidCalls[0]);

  return {
    strike: Math.round(optimalCall.strike * 100) / 100,
    expiration: optimalCall.expiration,
    premium: Math.round(optimalCall.ask * 100) / 100,
    impliedVolatility: optimalCall.impliedVolatility,
  };
}

function generateSyntheticOption(currentPrice: number, ticker: string): any {
  const impliedVol = VOLATILITY_MAP[ticker] || 0.4;
  const strike = Math.round(currentPrice * 1.1 * 100) / 100;
  const daysToExpiry = 45;
  const T = daysToExpiry / 365;
  
  // Black-Scholes approximation for premium
  const premium = currentPrice * 0.05 * impliedVol * Math.sqrt(T);
  
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + daysToExpiry);

  return {
    strike,
    expiration: expiry.toISOString().split('T')[0],
    premium: Math.round(premium * 100) / 100,
    impliedVolatility: impliedVol,
  };
}

function estimateEarningsDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 35);
  return date.toISOString().split('T')[0];
}
