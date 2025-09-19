import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    console.log('🌐 Configuring EODHD for all active ETFs...');

    // Get all active ETFs
    const { data: etfs, error: fetchError } = await supabaseClient
      .from('etfs')
      .select('ticker, country, exchange')
      .eq('active', true);

    if (fetchError) {
      throw new Error(`Failed to fetch ETFs: ${fetchError.message}`);
    }

    console.log(`📊 Found ${etfs.length} active ETFs to configure`);

    // Configure EODHD symbols based on country and exchange
    const results = {
      us_etfs: 0,
      canadian_tsx: 0,
      canadian_neo: 0,
      errors: 0,
      total_configured: 0
    };

    for (const etf of etfs) {
      let eodhd_symbol = '';
      
      // Determine EODHD symbol format based on country and exchange
      if (etf.country === 'US') {
        // US ETFs: TICKER.US
        eodhd_symbol = `${etf.ticker}.US`;
        results.us_etfs++;
      } else if (etf.country === 'CA') {
        if (etf.exchange === 'TSX') {
          // Canadian TSX: Already have .TO in ticker
          eodhd_symbol = etf.ticker;
          results.canadian_tsx++;
        } else if (etf.exchange === 'Cboe Canada') {
          // Canadian NEO exchange: Convert .NE to .NEO
          eodhd_symbol = etf.ticker.replace('.NE', '.NEO');
          results.canadian_neo++;
        } else {
          // Default for other Canadian exchanges
          eodhd_symbol = etf.ticker.includes('.') ? etf.ticker : `${etf.ticker}.TO`;
          results.canadian_tsx++;
        }
      } else {
        // Default case - use ticker as is
        eodhd_symbol = etf.ticker;
      }

      // Update the ETF with EODHD configuration
      const { error: updateError } = await supabaseClient
        .from('etfs')
        .update({
          eodhd_symbol: eodhd_symbol,
          data_source: 'eodhd',
          updated_at: new Date().toISOString()
        })
        .eq('ticker', etf.ticker);

      if (updateError) {
        console.error(`❌ Failed to update ${etf.ticker}:`, updateError);
        results.errors++;
      } else {
        console.log(`✅ Configured ${etf.ticker} → ${eodhd_symbol}`);
        results.total_configured++;
      }
    }

    // Summary
    const summary = {
      total_etfs: etfs.length,
      configured: results.total_configured,
      errors: results.errors,
      breakdown: {
        us_etfs: results.us_etfs,
        canadian_tsx: results.canadian_tsx,
        canadian_neo: results.canadian_neo
      }
    };

    console.log('📊 EODHD Configuration Summary:', summary);

    return new Response(
      JSON.stringify({ 
        success: true,
        summary,
        message: `Successfully configured ${results.total_configured}/${etfs.length} ETFs for EODHD`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ EODHD configuration failed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})