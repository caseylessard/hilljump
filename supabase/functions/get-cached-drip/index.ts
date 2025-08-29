import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tickers, taxPreferences } = await req.json();
    if (!Array.isArray(tickers)) {
      throw new Error("tickers must be an array");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`📊 Fetching cached DRIP data for ${tickers.length} tickers`);
    console.log(`🎯 Tax preferences:`, taxPreferences);
    
    // Determine which cache table to use based on tax preferences
    let tableName = 'drip_cache_us'; // Default
    
    if (taxPreferences) {
      if (!taxPreferences.enabled) {
        // Tax disabled = use CA cache (no withholding)
        tableName = 'drip_cache_ca';
        console.log(`📊 Using CA cache (no tax)`);
      } else if (taxPreferences.enabled && taxPreferences.rate === 0.15) {
        // Standard 15% tax = use country-appropriate cache
        tableName = taxPreferences.country === 'CA' ? 'drip_cache_ca' : 'drip_cache_us';
        console.log(`📊 Using ${tableName} (standard ${taxPreferences.country} tax)`);
      } else {
        // Custom tax rate = no cache available, will need live calculation
        console.log(`⚠️ Custom tax rate ${(taxPreferences.rate * 100).toFixed(1)}% - no cache available`);
        return new Response(JSON.stringify({
          dripData: {},
          cached: 0,
          total: tickers.length,
          missing: tickers,
          useCache: false,
          reason: 'Custom tax rate requires live calculation'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    console.log(`🎯 Using DRIP cache table: ${tableName}`);
    const { data: cachedData, error } = await supabase
      .from(tableName)
      .select('*')
      .in('ticker', tickers)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // Process data to get most recent entry per ticker
    const dripData: Record<string, any> = {};
    const processed = new Set<string>();
    
    for (const row of cachedData || []) {
      if (!processed.has(row.ticker)) {
        dripData[row.ticker] = {
          '4w': row.period_4w,
          '13w': row.period_13w,
          '26w': row.period_26w,
          '52w': row.period_52w,
          lastUpdated: row.updated_at
        };
        processed.add(row.ticker);
      }
    }

    const cached = Object.keys(dripData).length;
    const total = tickers.length;
    const missing = tickers.filter(ticker => !processed.has(ticker));

    console.log(`✅ Found cached DRIP data from ${tableName} for ${cached}/${total} tickers`);
    if (missing.length > 0) {
      console.log(`⚠️ Missing DRIP data for: ${missing.join(', ')}`);
    }

    return new Response(JSON.stringify({
      dripData,
      cached,
      total,
      missing,
      useCache: true,
      tableName
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching cached DRIP data:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch cached DRIP data',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});