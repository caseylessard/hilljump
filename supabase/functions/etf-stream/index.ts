import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ETFData {
  ticker: string;
  name: string;
  yield?: number;
  aum?: number;
  volume?: number;
  return1y?: number;
  price?: number;
  country: string;
}

async function fetchEODHDData(symbols: string[], apiKey: string): Promise<Map<string, ETFData>> {
  const results = new Map<string, ETFData>();
  
  console.log(`[EODHD] Starting fetch for ${symbols.length} symbols:`, symbols);
  
  // Process symbols one by one with proper error handling
  for (const symbol of symbols) {
    try {
      console.log(`[EODHD] Fetching data for ${symbol}`);
      
      // Get real-time price first (simpler endpoint)
      const priceUrl = `https://eodhd.com/api/real-time/${symbol}?api_token=${apiKey}&fmt=json`;
      const priceResponse = await fetch(priceUrl);
      
      if (!priceResponse.ok) {
        console.error(`[EODHD] Price request failed for ${symbol}: ${priceResponse.status}`);
        continue;
      }
      
      const priceData = await priceResponse.json();
      console.log(`[EODHD] Price data for ${symbol}:`, priceData);
      
      // Get fundamentals data
      const fundUrl = `https://eodhd.com/api/fundamentals/${symbol}?api_token=${apiKey}&fmt=json`;
      const fundResponse = await fetch(fundUrl);
      let fundData = null;
      
      if (fundResponse.ok) {
        fundData = await fundResponse.json();
        console.log(`[EODHD] Fundamentals data for ${symbol}:`, fundData?.General?.Name || 'No name');
      } else {
        console.error(`[EODHD] Fundamentals request failed for ${symbol}: ${fundResponse.status}`);
      }
      
      const etfData: ETFData = {
        ticker: symbol,
        name: fundData?.General?.Name || priceData?.name || symbol,
        yield: fundData?.ETF_Data?.Yield,
        aum: fundData?.ETF_Data?.TotalAssets,
        volume: priceData?.volume || fundData?.Highlights?.AverageVolume,
        return1y: fundData?.Technicals?.['52WeekHigh'] && fundData?.Technicals?.['52WeekLow'] 
          ? ((fundData.Technicals['52WeekHigh'] - fundData.Technicals['52WeekLow']) / fundData.Technicals['52WeekLow'] * 100)
          : undefined,
        price: priceData?.close || priceData?.price || fundData?.General?.LastClosePrice,
        country: symbol.includes('.TO') ? 'CA' : 'US'
      };
      
      console.log(`[EODHD] Final data for ${symbol}:`, etfData);
      results.set(symbol, etfData);
      
    } catch (error) {
      console.error(`[EODHD] Error fetching data for ${symbol}:`, error);
    }
    
    // Rate limiting: small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`[EODHD] Completed fetch. Got data for ${results.size}/${symbols.length} symbols`);
  return results;
}

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  socket.onopen = async () => {
    console.log("[ETF-STREAM] WebSocket connection opened");
    socket.send(JSON.stringify({ type: 'connected', message: 'ETF stream connected' }));
    
    // Send a test message to verify connection is working
    socket.send(JSON.stringify({ 
      type: 'test_data', 
      message: 'WebSocket connection working',
      timestamp: new Date().toISOString() 
    }));
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("[ETF-STREAM] Received client message:", message);
      
      if (message.type === 'test' && message.tickers) {
        console.log("[ETF-STREAM] Test mode activated for tickers:", message.tickers);
        
        try {
          // Use simplified test data since EODHD is rate limited
          socket.send(JSON.stringify({ 
            type: 'progress', 
            message: `Starting simplified test for ${message.tickers.length} tickers (EODHD rate limited)`,
            total: message.tickers.length 
          }));
          
          // Generate test data for each ticker
          let processed = 0;
          for (const ticker of message.tickers) {
            processed++;
            
            // Send test data immediately
            socket.send(JSON.stringify({
              type: 'data',
              ticker: ticker,
              data: {
                name: `Test ${ticker} Name`,
                yield: Math.random() * 10,
                aum: Math.random() * 1000000000,
                volume: Math.random() * 1000000,
                return1y: Math.random() * 20 - 10,
                price: Math.random() * 100 + 10
              },
              progress: {
                current: processed,
                total: message.tickers.length,
                percentage: Math.round((processed / message.tickers.length) * 100)
              }
            }));
            
            // Small delay to simulate real API calls
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          socket.send(JSON.stringify({
            type: 'complete',
            message: `Successfully processed ${processed} test tickers`,
            stats: {
              total: message.tickers.length,
              updated: 0, // No database updates in test mode
              processed
            }
          }));
          
        } catch (error) {
          console.error("[ETF-STREAM] Test error:", error);
          socket.send(JSON.stringify({
            type: 'error',
            message: `Test error: ${error.message}`
          }));
        }
        
      } else {
        console.log("[ETF-STREAM] Regular mode - fetching ETFs from database");
        
        try {
          // Initialize Supabase client
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const eodhd_api_key = Deno.env.get('EODHD_API_KEY')!;
          
          if (!eodhd_api_key) {
            socket.send(JSON.stringify({ type: 'error', message: 'EODHD API key not configured' }));
            return;
          }
          
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          // Get all ETFs that need updating
          const { data: etfs, error } = await supabase
            .from('etfs')
            .select('ticker, name, country')
            .or('yield_ttm.is.null,total_return_1y.is.null,aum.is.null')
            .limit(50); // Start with a reasonable batch
          
          if (error) {
            socket.send(JSON.stringify({ type: 'error', message: 'Failed to fetch ETFs from database' }));
            return;
          }
          
          if (!etfs || etfs.length === 0) {
            socket.send(JSON.stringify({ type: 'complete', message: 'No ETFs need updating' }));
            return;
          }
          
          socket.send(JSON.stringify({ 
            type: 'progress', 
            message: `Starting to fetch data for ${etfs.length} ETFs`,
            total: etfs.length 
          }));
          
          const symbols = etfs.map(etf => etf.ticker);
          const etfDataMap = await fetchEODHDData(symbols, eodhd_api_key);
          
          let processed = 0;
          const updates = [];
          
          // Stream results as they're processed
          for (const [ticker, data] of etfDataMap) {
            processed++;
            
            // Send progress update
            socket.send(JSON.stringify({
              type: 'data',
              ticker: data.ticker,
              data: {
                name: data.name,
                yield: data.yield,
                aum: data.aum,
                volume: data.volume,
                return1y: data.return1y,
                price: data.price
              },
              progress: {
                current: processed,
                total: etfs.length,
                percentage: Math.round((processed / etfs.length) * 100)
              }
            }));
            
            // Prepare database update
            const updateData: any = {};
            if (data.yield !== undefined) updateData.yield_ttm = data.yield;
            if (data.aum !== undefined) updateData.aum = data.aum;
            if (data.volume !== undefined) updateData.avg_volume = data.volume;
            if (data.return1y !== undefined) updateData.total_return_1y = data.return1y;
            if (data.name) updateData.name = data.name;
            
            if (Object.keys(updateData).length > 0) {
              updates.push({ ticker, ...updateData });
            }
          }
          
          // Batch update database
          if (updates.length > 0) {
            for (const update of updates) {
              const { ticker, ...updateData } = update;
              await supabase
                .from('etfs')
                .update(updateData)
                .eq('ticker', ticker);
            }
            
            socket.send(JSON.stringify({
              type: 'database_updated',
              message: `Updated ${updates.length} ETFs in database`
            }));
          }
          
          socket.send(JSON.stringify({
            type: 'complete',
            message: `Successfully processed ${processed} ETFs`,
            stats: {
              total: etfs.length,
              updated: updates.length,
              processed
            }
          }));
          
        } catch (error) {
          console.error("[ETF-STREAM] Error:", error);
          socket.send(JSON.stringify({
            type: 'error',
            message: `Stream error: ${error.message}`
          }));
        }
      }
    } catch (error) {
      console.error("[ETF-STREAM] Error parsing message:", error);
      socket.send(JSON.stringify({
        type: 'error',
        message: `Message parsing error: ${error.message}`
      }));
    }
  };
  
  socket.onerror = (error) => {
    console.error("[ETF-STREAM] WebSocket error:", error);
  };
  
  socket.onclose = () => {
    console.log("[ETF-STREAM] WebSocket connection closed");
  };

  return response;
});