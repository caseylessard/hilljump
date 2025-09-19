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

    console.log('🔧 Starting ETF fixes...');

    // Step 1: Deactivate QDCC (appears delisted - 25 days stale with identical prices)
    console.log('❌ Deactivating QDCC (appears delisted)...');
    const { data: qdccResult, error: qdccError } = await supabaseClient
      .from('etfs')
      .update({ 
        active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('ticker', 'QDCC')
      .select('ticker, name, active');

    if (qdccError) {
      console.error('❌ Failed to deactivate QDCC:', qdccError);
    } else {
      console.log('✅ QDCC deactivated:', qdccResult);
    }

    // Step 2: Configure EODHD symbols for Canadian ETFs missing recent data
    console.log('🇨🇦 Configuring EODHD symbols for Canadian ETFs...');
    
    const canadianETFs = [
      { ticker: 'BNSY.NE', eodhd: 'BNSY.NEO' },
      { ticker: 'DOLY.NE', eodhd: 'DOLY.NEO' },
      { ticker: 'YAVG.NE', eodhd: 'YAVG.NEO' },
      { ticker: 'YNET.NE', eodhd: 'YNET.NEO' },
      { ticker: 'YTSL.NE', eodhd: 'YTSL.NEO' },
      { ticker: 'YUNH.NE', eodhd: 'YUNH.NEO' },
      { ticker: 'EACL.NE', eodhd: 'EACL.NEO' },
      { ticker: 'RSCL.NE', eodhd: 'RSCL.NEO' }
    ];

    const canadianResults = [];
    for (const etf of canadianETFs) {
      const { data, error } = await supabaseClient
        .from('etfs')
        .update({
          eodhd_symbol: etf.eodhd,
          data_source: 'eodhd',
          updated_at: new Date().toISOString()
        })
        .eq('ticker', etf.ticker)
        .select('ticker, name, eodhd_symbol, data_source');

      if (error) {
        console.error(`❌ Failed to update ${etf.ticker}:`, error);
      } else {
        console.log(`✅ Updated ${etf.ticker} with EODHD symbol:`, data);
        canadianResults.push(data[0]);
      }
    }

    // Step 3: Configure US SQY ETF
    console.log('🇺🇸 Configuring EODHD symbol for US SQY ETF...');
    const { data: sqyResult, error: sqyError } = await supabaseClient
      .from('etfs')
      .update({
        eodhd_symbol: 'SQY.US',
        data_source: 'eodhd',
        updated_at: new Date().toISOString()
      })
      .eq('ticker', 'SQY')
      .select('ticker, name, eodhd_symbol, data_source');

    if (sqyError) {
      console.error('❌ Failed to update SQY:', sqyError);
    } else {
      console.log('✅ Updated SQY with EODHD symbol:', sqyResult);
    }

    const summary = {
      qdcc_deactivated: qdccResult?.length > 0,
      canadian_etfs_configured: canadianResults.length,
      sqy_configured: sqyResult?.length > 0,
      total_fixes: (qdccResult?.length || 0) + canadianResults.length + (sqyResult?.length || 0)
    };

    console.log('📊 Summary:', summary);

    return new Response(
      JSON.stringify({ 
        success: true,
        summary,
        details: {
          qdcc_result: qdccResult,
          canadian_results: canadianResults,
          sqy_result: sqyResult
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ ETF fix failed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})