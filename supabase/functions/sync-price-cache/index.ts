import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting price cache synchronization...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all ETFs with current prices
    const { data: etfs, error: etfError } = await supabase
      .from('etfs')
      .select('ticker, current_price, price_updated_at')
      .not('current_price', 'is', null)
      .gt('current_price', 0)
      .eq('active', true);

    if (etfError) {
      throw new Error(`Failed to fetch ETFs: ${etfError.message}`);
    }

    if (!etfs || etfs.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No ETF prices found to sync',
        synced: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Found ${etfs.length} ETFs with prices to sync`);

    // Batch upsert to price cache
    const cacheEntries = etfs.map(etf => ({
      ticker: etf.ticker,
      price: etf.current_price,
      source: 'database_sync',
      updated_at: etf.price_updated_at || new Date().toISOString()
    }));

    // Split into batches of 100 to avoid query size limits
    const batchSize = 100;
    let syncedCount = 0;
    
    for (let i = 0; i < cacheEntries.length; i += batchSize) {
      const batch = cacheEntries.slice(i, i + batchSize);
      
      const { error: syncError } = await supabase
        .from('price_cache')
        .upsert(batch, { 
          onConflict: 'ticker' 
        });

      if (syncError) {
        console.error(`Failed to sync batch ${Math.floor(i / batchSize) + 1}:`, syncError);
      } else {
        syncedCount += batch.length;
        console.log(`✅ Synced batch ${Math.floor(i / batchSize) + 1}: ${batch.length} prices`);
      }
    }

    // Also update historical prices for EOD sync (optional parameter)
    const { force_historical } = await req.json().catch(() => ({}));
    
    if (force_historical) {
      console.log('📈 Syncing current prices to historical prices table...');
      
      const historicalEntries = etfs.map(etf => ({
        ticker: etf.ticker,
        date: new Date().toISOString().split('T')[0], // Today's date
        close_price: etf.current_price,
        open_price: etf.current_price, // Use same price for open
        high_price: etf.current_price,
        low_price: etf.current_price,
        adjusted_close: etf.current_price
      }));

      // Batch upsert to historical prices (prevent duplicates)
      for (let i = 0; i < historicalEntries.length; i += batchSize) {
        const batch = historicalEntries.slice(i, i + batchSize);
        
        const { error: histError } = await supabase
          .from('historical_prices')
          .upsert(batch, { 
            onConflict: 'ticker,date',
            ignoreDuplicates: true
          });

        if (histError) {
          console.error(`Failed to sync historical batch ${Math.floor(i / batchSize) + 1}:`, histError);
        }
      }
      
      console.log('✅ Historical prices sync completed');
    }

    return new Response(JSON.stringify({ 
      message: `Successfully synced ${syncedCount} prices to cache`,
      synced: syncedCount,
      total_etfs: etfs.length,
      historical_synced: force_historical ? etfs.length : 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Price cache sync error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});