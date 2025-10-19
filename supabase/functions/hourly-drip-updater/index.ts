import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authentication check for cron jobs
  const cronSecret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('X-Cron-Secret');
  
  if (!cronSecret || providedSecret !== cronSecret) {
    console.error('❌ Unauthorized access attempt to hourly-drip-updater');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('🔄 Starting hourly DRIP cache update...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get active ETFs
    const { data: etfs, error: etfsError } = await supabase
      .from('etfs')
      .select('ticker')
      .eq('active', true);

    if (etfsError) {
      throw new Error(`Failed to fetch ETFs: ${etfsError.message}`);
    }

    const tickers = etfs?.map(e => e.ticker) || [];
    console.log(`📊 Processing DRIP for ${tickers.length} ETFs...`);

    // Process in batches of 50 to avoid timeout
    const batchSize = 50;
    let processedCount = 0;

    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(tickers.length/batchSize)} (${batch.length} ETFs)...`);

      // Calculate DRIP for US users (no tax)
      const { error: usDripError } = await supabase.functions.invoke('daily-drip-calculator', {
        body: { 
          tickers: batch,
          taxPrefs: {
            country: 'US',
            withholdingTax: false,
            taxRate: 0
          }
        }
      });

      if (usDripError) {
        console.error('❌ US DRIP calculation failed for batch:', usDripError);
      } else {
        console.log('✅ US DRIP calculation completed for batch');
      }

      // Calculate DRIP for CA users (15% tax)
      const { error: caDripError } = await supabase.functions.invoke('daily-drip-calculator', {
        body: { 
          tickers: batch,
          taxPrefs: {
            country: 'CA',
            withholdingTax: true,
            taxRate: 15
          }
        }
      });

      if (caDripError) {
        console.error('❌ CA DRIP calculation failed for batch:', caDripError);
      } else {
        console.log('✅ CA DRIP calculation completed for batch');
      }

      processedCount += batch.length;
      console.log(`📈 Progress: ${processedCount}/${tickers.length} ETFs processed`);
    }

    console.log('✅ Hourly DRIP cache update completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'DRIP cache updated successfully',
        processedETFs: processedCount
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ Hourly DRIP update failed:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 500 
      }
    );
  }
});