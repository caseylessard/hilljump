import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🧹 Starting dividend duplicate cleanup...');

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('✅ Supabase client initialized');

    let totalCleaned = 0;

    // Get all dividends for problematic tickers
    const { data: dividends, error: fetchError } = await supabase
      .from('dividends')
      .select('*')
      .in('ticker', ['MSTY', 'NVYY', 'QQQY', 'CONY', 'TSLY'])
      .gte('ex_date', '2024-07-01')
      .order('ticker')
      .order('ex_date');

    if (fetchError) {
      throw new Error(`Failed to fetch dividends: ${fetchError.message}`);
    }

    console.log(`📊 Found ${dividends?.length || 0} dividend records to analyze`);

    // Group by ticker and month to identify duplicates/near-duplicates
    const tickerGroups = new Map();
    
    for (const dividend of dividends || []) {
      const ticker = dividend.ticker;
      const date = new Date(dividend.ex_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!tickerGroups.has(ticker)) {
        tickerGroups.set(ticker, new Map());
      }
      
      if (!tickerGroups.get(ticker).has(monthKey)) {
        tickerGroups.get(ticker).set(monthKey, []);
      }
      
      tickerGroups.get(ticker).get(monthKey).push(dividend);
    }

    // Process each ticker's monthly groups
    for (const [ticker, monthGroups] of tickerGroups) {
      console.log(`🔍 Processing ${ticker}...`);
      
      for (const [monthKey, monthDividends] of monthGroups) {
        if (monthDividends.length > 1) {
          console.log(`📅 ${ticker} ${monthKey}: Found ${monthDividends.length} dividends`);
          
          // Sort by ex_date
          monthDividends.sort((a, b) => new Date(a.ex_date).getTime() - new Date(b.ex_date).getTime());
          
          // For monthly ETFs like MSTY, keep only the latest one in the month
          if (['MSTY', 'CONY', 'QQQY'].includes(ticker)) {
            const keepDividend = monthDividends[monthDividends.length - 1]; // Keep the latest
            const toDelete = monthDividends.slice(0, -1); // Delete all but the latest
            
            console.log(`📌 Keeping ${ticker} ${keepDividend.ex_date} (${keepDividend.amount})`);
            
            for (const dividend of toDelete) {
              console.log(`🗑️ Deleting ${ticker} ${dividend.ex_date} (${dividend.amount})`);
              
              const { error: deleteError } = await supabase
                .from('dividends')
                .delete()
                .eq('id', dividend.id);
                
              if (deleteError) {
                console.error(`❌ Failed to delete ${ticker} ${dividend.ex_date}:`, deleteError);
              } else {
                totalCleaned++;
              }
            }
          }
          
          // For weekly ETFs like NVYY, consolidate into monthly payments
          else if (['NVYY'].includes(ticker)) {
            const totalAmount = monthDividends.reduce((sum, d) => sum + Number(d.amount), 0);
            const latestDate = monthDividends[monthDividends.length - 1].ex_date;
            const keepDividend = monthDividends[monthDividends.length - 1];
            
            console.log(`📌 Consolidating ${ticker} ${monthKey}: ${monthDividends.length} payments = $${totalAmount.toFixed(3)}`);
            
            // Update the latest dividend with the consolidated amount
            const { error: updateError } = await supabase
              .from('dividends')
              .update({ 
                amount: totalAmount.toFixed(3),
                cadence: 'monthly' 
              })
              .eq('id', keepDividend.id);
              
            if (updateError) {
              console.error(`❌ Failed to update consolidated ${ticker}:`, updateError);
            }
            
            // Delete the other dividends
            const toDelete = monthDividends.slice(0, -1);
            for (const dividend of toDelete) {
              const { error: deleteError } = await supabase
                .from('dividends')
                .delete()
                .eq('id', dividend.id);
                
              if (deleteError) {
                console.error(`❌ Failed to delete ${ticker} ${dividend.ex_date}:`, deleteError);
              } else {
                totalCleaned++;
              }
            }
          }
        }
      }
    }

    // Clear DRIP cache to force recalculation
    const { error: cacheError1 } = await supabase.from('drip_cache_us').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error: cacheError2 } = await supabase.from('drip_cache_ca').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (cacheError1 || cacheError2) {
      console.warn('⚠️ Warning: Failed to clear DRIP cache completely');
    } else {
      console.log('🗑️ DRIP cache cleared');
    }

    const result = {
      success: true,
      message: `Successfully cleaned up ${totalCleaned} duplicate dividend records`,
      records_cleaned: totalCleaned
    };

    console.log('🎉 Cleanup completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('💥 Error in dividend cleanup:', error);
    
    const errorResult = {
      success: false,
      error: error.message || 'Unknown error occurred',
      message: 'Failed to clean up dividend duplicates'
    };

    return new Response(JSON.stringify(errorResult), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
