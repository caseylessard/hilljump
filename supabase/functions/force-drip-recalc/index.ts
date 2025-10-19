import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized - Missing token' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('❌ Invalid token');
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid token' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.error('❌ Non-admin access attempt by user:', user.id);
      return new Response(JSON.stringify({ error: 'Unauthorized - Admin access required' }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Admin verified:', user.email);

    console.log('🚀 Forcing DRIP recalculation for all ETFs');

    // Clear existing DRIP cache to force fresh calculations
    console.log('🗑️ Clearing existing DRIP cache...');
    
    await Promise.all([
      supabase.from('drip_cache_us').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('drip_cache_ca').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    ]);

    console.log('✅ Cache cleared, triggering fresh DRIP calculations...');

    // Trigger fresh DRIP calculation
    const { data: calcResult, error: calcError } = await supabase.functions.invoke('daily-drip-calculator', {
      body: { forceRecalc: true }
    });

    if (calcError) {
      console.error('❌ DRIP calculation error:', calcError);
      throw calcError;
    }

    console.log('✅ DRIP recalculation completed:', calcResult);

    return new Response(JSON.stringify({
      success: true,
      message: 'DRIP cache cleared and recalculation triggered',
      result: calcResult,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in force DRIP recalculation:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});