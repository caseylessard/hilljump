import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TiingoFundamentals {
  ticker: string;
  divYield?: number;
  marketCap?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting Tiingo yield update process - basic test');
    
    // Basic environment check
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const tiingoApiKey = Deno.env.get('TIINGO_API_KEY');

    console.log('📊 Environment variables check:');
    console.log(`- SUPABASE_URL: ${supabaseUrl ? 'Found' : 'Missing'}`);
    console.log(`- SUPABASE_SERVICE_ROLE_KEY: ${supabaseKey ? 'Found' : 'Missing'}`);
    console.log(`- TIINGO_API_KEY: ${tiingoApiKey ? 'Found' : 'Missing'}`);

    if (!supabaseUrl || !supabaseKey || !tiingoApiKey) {
      const missingVars = [];
      if (!supabaseUrl) missingVars.push('SUPABASE_URL');
      if (!supabaseKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
      if (!tiingoApiKey) missingVars.push('TIINGO_API_KEY');
      
      console.error(`❌ Missing environment variables: ${missingVars.join(', ')}`);
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    console.log('✅ All environment variables found');
    console.log(`🔑 Tiingo API key preview: ${tiingoApiKey.substring(0, 8)}...`);

    // Simple success response for testing
    const testResult = {
      success: true,
      message: 'Function is working - environment variables are properly configured',
      timestamp: new Date().toISOString(),
      environmentCheck: {
        supabaseUrl: supabaseUrl ? 'Found' : 'Missing',
        supabaseKey: supabaseKey ? 'Found' : 'Missing', 
        tiingoApiKey: tiingoApiKey ? 'Found' : 'Missing'
      }
    };

    console.log('🎉 Basic function test completed successfully');

    return new Response(
      JSON.stringify(testResult),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: any) {
    console.error('❌ Error in Tiingo yields function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});