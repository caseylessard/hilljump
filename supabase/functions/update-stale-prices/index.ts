import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Finding ETFs with stale prices (>24 hours old)...');

    // Get ETFs with prices older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: staleETFs, error: queryError } = await supabase
      .from('etfs')
      .select('ticker, current_price, price_updated_at, exchange')
      .eq('active', true)
      .lt('price_updated_at', oneDayAgo);

    if (queryError) {
      throw new Error(`Failed to query stale ETFs: ${queryError.message}`);
    }

    if (!staleETFs || staleETFs.length === 0) {
      console.log('✅ No stale prices found - all ETFs are up to date!');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All ETF prices are current', 
          count: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staleTickers = staleETFs.map(etf => etf.ticker);
    console.log(`📊 Found ${staleTickers.length} ETFs with stale prices:`);
    console.log(`   NEO Exchange (.NE): ${staleTickers.filter(t => t.endsWith('.NE')).length}`);
    console.log(`   Toronto (.TO): ${staleTickers.filter(t => t.endsWith('.TO')).length}`);
    console.log(`   US: ${staleTickers.filter(t => !t.includes('.')).length}`);

    // Call the quotes function to update these specific tickers
    // Process in batches of 25 to avoid overwhelming the API
    const batchSize = 25;
    const batches = [];
    for (let i = 0; i < staleTickers.length; i += batchSize) {
      batches.push(staleTickers.slice(i, i + batchSize));
    }

    let totalUpdated = 0;
    const priceResults: Record<string, number> = {};

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} tickers)...`);

      const { data, error } = await supabase.functions.invoke('quotes', {
        body: { tickers: batch }
      });

      if (error) {
        console.error(`⚠️ Batch ${i + 1} error:`, error);
        continue;
      }

      if (data?.prices) {
        const batchCount = Object.keys(data.prices).length;
        totalUpdated += batchCount;
        Object.assign(priceResults, data.prices);
        console.log(`✅ Batch ${i + 1}: Updated ${batchCount}/${batch.length} prices`);
      }

      // Small delay between batches to respect rate limits
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`🎉 Price update complete: ${totalUpdated}/${staleTickers.length} prices updated`);

    return new Response(
      JSON.stringify({
        success: true,
        stale_count: staleTickers.length,
        updated_count: totalUpdated,
        stale_tickers: staleTickers,
        prices: priceResults,
        breakdown: {
          neo_exchange: staleTickers.filter(t => t.endsWith('.NE')).length,
          toronto: staleTickers.filter(t => t.endsWith('.TO')).length,
          us: staleTickers.filter(t => !t.includes('.')).length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Stale price update failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});