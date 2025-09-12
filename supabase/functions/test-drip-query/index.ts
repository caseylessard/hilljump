import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🧪 Testing exact DRIP query that frontend uses');

    const testTickers = ['AAPW', 'MSTY', 'TSLY'];
    
    // Exact same query as frontend
    const { data, error } = await supabase
      .from('drip_cache_us')
      .select('ticker, period_4w, period_13w, period_26w, period_52w, updated_at')
      .in('ticker', testTickers);
    
    if (error) {
      console.error('❌ Query error:', error);
      throw error;
    }

    console.log(`📊 Query returned ${data?.length || 0} records`);
    
    // Test validation logic
    const hasValidData = data?.some(row => {
      const parseField = (field: any) => {
        if (!field) return null;
        if (typeof field === 'string') {
          try { return JSON.parse(field); } catch { return null; }
        }
        return field;
      };
      
      const parsed4w = parseField(row.period_4w);
      const parsed13w = parseField(row.period_13w);
      const parsed26w = parseField(row.period_26w);
      const parsed52w = parseField(row.period_52w);
      
      const hasValid = (parsed4w && parsed4w.growthPercent !== undefined) ||
                      (parsed13w && parsed13w.growthPercent !== undefined) ||
                      (parsed26w && parsed26w.growthPercent !== undefined) ||
                      (parsed52w && parsed52w.growthPercent !== undefined);
      
      console.log(`🔍 ${row.ticker} validation:`, {
        period_4w_type: typeof row.period_4w,
        period_4w_value: row.period_4w,
        parsed4w_growthPercent: parsed4w?.growthPercent,
        hasValid
      });
      
      return hasValid;
    });

    console.log(`📊 Has valid data: ${hasValidData}`);

    // Test the parsing logic
    const result: Record<string, any> = {};
    data?.forEach(row => {
      const parseToLegacyFormat = (periodData: any) => {
        if (!periodData) return null;
        
        let parsedData = periodData;
        if (typeof periodData === 'string') {
          try {
            parsedData = JSON.parse(periodData);
          } catch (e) {
            console.warn('Failed to parse DRIP JSON:', periodData);
            return null;
          }
        }
        
        if (!parsedData || typeof parsedData !== 'object') return null;
        
        const growthPercent = parsedData.growthPercent || 0;
        const totalDividends = parsedData.totalDividends || 0;
        const startPrice = parsedData.startPrice || 1;
        const dollarAmount = (growthPercent / 100) * startPrice;
        
        return {
          percent: growthPercent,
          dollar: dollarAmount
        };
      };
      
      const parsed4w = parseToLegacyFormat(row.period_4w);
      
      result[row.ticker] = {
        drip4wPercent: parsed4w?.percent || 0,
        drip4wDollar: parsed4w?.dollar || 0,
        raw4w: row.period_4w
      };
      
      console.log(`📊 ${row.ticker} result:`, {
        drip4wPercent: result[row.ticker].drip4wPercent,
        raw_period_4w: row.period_4w
      });
    });

    return new Response(JSON.stringify({
      success: true,
      rawData: data,
      hasValidData,
      parsedResult: result
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});