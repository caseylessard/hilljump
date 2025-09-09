// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Removed POLYGON_API_KEY - now using Yahoo Finance
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let logId: string | undefined;
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE!, { auth: { persistSession: false } });

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error("Missing Supabase service credentials");

    // Parse request body for specific tickers
    let requestedTickers: string[] = [];
    let isManual = false;
    
    try {
      const body = await req.json();
      requestedTickers = body.tickers || [];
      isManual = body.manual || false;
    } catch {
      // No body or invalid JSON, process all tickers
    }

    // Create log entry for this update run
    const { data: logEntry } = await supabase
      .from("dividend_update_logs")
      .insert({ status: 'running' })
      .select('id')
      .single();
    logId = logEntry?.id;

    // 1) Load tickers from DB
    const { data: etfs, error: e1 } = await supabase.from("etfs").select("id, ticker");
    if (e1) throw e1;
    
    let tickers: { id: string; ticker: string }[] = etfs || [];
    
    // Filter to requested tickers if specified
    if (requestedTickers.length > 0) {
      tickers = tickers.filter(etf => requestedTickers.includes(etf.ticker));
      console.log(`Processing ${tickers.length} specific tickers: ${tickers.map(t => t.ticker).join(', ')}`);
    } else {
      console.log(`Processing all ${tickers.length} tickers`);
    }

    // helper: fetch dividends using multiple sources with fallbacks
    async function fetchDividends(ticker: string): Promise<any[]> {
      // Try EODHD first (premium data source)
      const eodhd = await fetchEODHDDividends(ticker);
      if (eodhd.length > 0) {
        console.log(`✓ EODHD: Found ${eodhd.length} dividends for ${ticker}`);
        return eodhd;
      }

      // Try Yahoo Finance second
      console.log(`⚠️ EODHD failed for ${ticker}, trying Yahoo Finance...`);
      const yahooDividends = await fetchYahooDividends(ticker);
      if (yahooDividends.length > 0) {
        console.log(`✓ Yahoo Finance: Found ${yahooDividends.length} dividends for ${ticker}`);
        return yahooDividends;
      }

      // Fallback to Alpha Vantage
      console.log(`⚠️ Yahoo Finance failed for ${ticker}, trying Alpha Vantage...`);
      const alphaDividends = await fetchAlphaVantageDividends(ticker);
      if (alphaDividends.length > 0) {
        console.log(`✓ Alpha Vantage: Found ${alphaDividends.length} dividends for ${ticker}`);
        return alphaDividends;
      }

      console.log(`❌ No dividend data found for ${ticker} from any source`);
      return [];
    }

    async function fetchYahooDividends(ticker: string) {
      try {
        // Yahoo Finance events API for dividends
        const endDate = Math.floor(Date.now() / 1000);
        const startDate = endDate - (365 * 24 * 60 * 60); // 1 year ago
        
        const url = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d&events=div`;
        
        console.log(`🔍 Yahoo: Fetching dividends for ${ticker}`);
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (!res.ok) {
          console.warn(`Yahoo Finance dividends failed for ${ticker}: ${res.status}`);
          return [];
        }
        
        const csvText = await res.text();
        const lines = csvText.trim().split('\n');
        
        if (lines.length <= 1) return [];
        
        // Parse CSV and prepare for normalization
        const rawData = [];
        for (let i = 1; i < lines.length; i++) {
          const columns = lines[i].split(',');
          if (columns.length >= 2) {
            const date = columns[0];
            const amount = parseFloat(columns[1]);
            
            if (!isNaN(amount) && amount > 0) {
              rawData.push({ date, amount });
            }
          }
        }
        
        const normalized = normalizeDividendData(rawData, 'yahoo');
        console.log(`✓ Yahoo: Found ${normalized.length} valid dividends for ${ticker}`);
        return normalized;
      } catch (error) {
        console.error(`Error fetching Yahoo Finance dividends for ${ticker}:`, error);
        return [];
      }
    }

    // Standardize dividend data from different sources
    function normalizeDividendData(rawData: any, source: string): any[] {
      const dividends = [];
      
      if (source === 'yahoo' && Array.isArray(rawData)) {
        for (const item of rawData) {
          dividends.push({
            ex_dividend_date: item.date,
            pay_date: null, // Yahoo doesn't provide pay dates
            cash_amount: item.amount,
            currency: 'USD', // Yahoo assumes USD
            source: 'yahoo'
          });
        }
      } else if (source === 'alpha_vantage' && Array.isArray(rawData)) {
        for (const item of rawData) {
          dividends.push({
            ex_dividend_date: item.ex_dividend_date,
            pay_date: item.payment_date || null,
            cash_amount: parseFloat(item.amount),
            currency: 'USD', // Alpha Vantage assumes USD
            source: 'alpha_vantage'
          });
        }
      } else if (source === 'eodhd' && Array.isArray(rawData)) {
        for (const item of rawData) {
          dividends.push({
            ex_dividend_date: item.date, // EODHD's 'date' field is ex-dividend date
            pay_date: item.paymentDate || null,
            cash_amount: parseFloat(item.value),
            currency: item.currency || 'USD',
            source: 'eodhd'
          });
        }
      }
      
      return dividends;
    }

    async function fetchEODHDDividends(ticker: string) {
      try {
        const EODHD_API_KEY = Deno.env.get("EODHD_API_KEY");
        if (!EODHD_API_KEY) {
          console.warn("EODHD API key not configured");
          return [];
        }

        // EODHD dividends API - get last year of dividends
        const fromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const url = `https://eodhd.com/api/div/${ticker}?api_token=${EODHD_API_KEY}&fmt=json&from=${fromDate}`;
        
        console.log(`🔍 EODHD: Fetching dividends for ${ticker}`);
        const res = await fetch(url);
        
        if (!res.ok) {
          console.warn(`EODHD dividends failed for ${ticker}: ${res.status}`);
          return [];
        }
        
        const data = await res.json();
        
        if (!Array.isArray(data) || data.length === 0) {
          console.warn(`EODHD: No dividend data for ${ticker}`);
          return [];
        }

        // Filter and normalize data
        const validDividends = data.filter(d => d.value && parseFloat(d.value) > 0);
        const normalized = normalizeDividendData(validDividends, 'eodhd');
        
        console.log(`✓ EODHD: Found ${normalized.length} valid dividends for ${ticker}`);
        return normalized;
      } catch (error) {
        console.error(`Error fetching EODHD dividends for ${ticker}:`, error);
        return [];
      }
    }

    async function fetchAlphaVantageDividends(ticker: string) {
      try {
        const ALPHA_VANTAGE_API_KEY = Deno.env.get("ALPHA_VANTAGE_API_KEY");
        if (!ALPHA_VANTAGE_API_KEY) {
          console.warn("Alpha Vantage API key not configured");
          return [];
        }

        const url = `https://www.alphavantage.co/query?function=DIVIDENDS&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        
        console.log(`🔍 Alpha Vantage: Fetching dividends for ${ticker}`);
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (!res.ok) {
          console.warn(`Alpha Vantage dividends failed for ${ticker}: ${res.status}`);
          return [];
        }
        
        const data = await res.json();
        
        if (data['Error Message'] || data['Note']) {
          console.warn(`Alpha Vantage API limit or error for ${ticker}:`, data['Error Message'] || data['Note']);
          return [];
        }

        const dividendData = data.data || [];
        
        // Filter for last year
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const validDividends = dividendData.filter(dividend => {
          const exDate = new Date(dividend.ex_dividend_date);
          return exDate >= oneYearAgo && dividend.amount && parseFloat(dividend.amount) > 0;
        });
        
        const normalized = normalizeDividendData(validDividends, 'alpha_vantage');
        console.log(`✓ Alpha Vantage: Found ${normalized.length} valid dividends for ${ticker}`);
        return normalized;
      } catch (error) {
        console.error(`Error fetching Alpha Vantage dividends for ${ticker}:`, error);
        return [];
      }
    }

    async function fetchPrevClose(ticker: string) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (!res.ok) return null;
        
        const data = await res.json();
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        
        return typeof price === 'number' && price > 0 ? price : null;
      } catch (error) {
        console.error(`Error fetching Yahoo Finance price for ${ticker}:`, error);
        return null;
      }
    }

    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    let updated = 0;
    let insertedEvents = 0;

    // Process in small batches to respect rate limits
    const batchSize = 10;
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async ({ id, ticker }) => {
          try {
            const startTime = Date.now();
            const divs = await fetchDividends(ticker);
            const responseTime = Date.now() - startTime;
            
            // Log data source performance
            const { error: logError } = await supabase.from('dividend_source_logs').insert({
              ticker: ticker,
              source: divs.length > 0 ? (divs[0].source || 'yahoo') : 'unknown',
              success: divs.length > 0,
              dividends_found: divs.length,
              response_time_ms: responseTime
            });
            if (logError) console.error('Failed to log source performance:', logError);
            // Upsert recent dividends (last ~400 days)
            const recent = divs.filter((d: any) => {
              const ex = new Date(d.ex_dividend_date || d.pay_date || d.declaration_date || 0);
              return ex >= oneYearAgo;
            });

            if (recent.length) {
              const rows = recent.map((d: any) => ({
                etf_id: id,
                ticker,
                ex_date: d.ex_dividend_date || null,
                pay_date: d.pay_date || null,
                amount: Number(d.cash_amount) || 0,
                cash_currency: (d.currency || 'USD') as string,
              }));

              // Insert ignoring conflicts on (ticker, ex_date)
              const { error: insErr } = await supabase
                .from("dividends")
                .insert(rows, { onConflict: "ticker,ex_date" });
              if (insErr && insErr.code !== "23505") throw insErr;
              insertedEvents += rows.length;

              // Compute TTM sum
              const ttm = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
              const prevClose = await fetchPrevClose(ticker);
              if (prevClose && prevClose > 0) {
                const yieldPct = (ttm / prevClose) * 100;
                const { error: updErr } = await supabase
                  .from("etfs")
                  .update({ yield_ttm: yieldPct })
                  .eq("id", id);
                if (updErr) throw updErr;
                updated += 1;
              }
            }
          } catch (err) {
            console.error("dividend-updater error", ticker, err);
          }
        })
      );
    }

    // Update log entry with completion status
    if (logId) {
      await supabase
        .from("dividend_update_logs")
        .update({ 
          status: 'completed',
          end_time: new Date().toISOString(),
          total_etfs: tickers.length,
          updated_etfs: updated,
          inserted_events: insertedEvents
        })
        .eq('id', logId);
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      updated, 
      insertedEvents, 
      totalETFs: tickers.length,
      processedTickers: tickers.map(t => t.ticker),
      successful: updated,
      failed: tickers.length - updated
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("dividend-updater", e?.message || e);
    
    // Update log entry with error status
    if (logId) {
      await supabase
        .from("dividend_update_logs")
        .update({ 
          status: 'error',
          end_time: new Date().toISOString(),
          error_message: String(e?.message || e)
        })
        .eq('id', logId);
    }
    
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
