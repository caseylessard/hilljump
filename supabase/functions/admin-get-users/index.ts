import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, username, first_name, last_name, country, approved, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) throw profilesError;

    // Fetch all auth users (emails)
    const { data: authData, error: authListError } = await supabaseClient.auth.admin.listUsers();
    if (authListError) throw authListError;

    // Create email map
    const emailMap = new Map<string, string>();
    authData.users.forEach(u => {
      if (u.id && u.email) {
        emailMap.set(u.id, u.email);
      }
    });

    // Fetch roles for all users
    const { data: rolesData } = await supabaseClient
      .from('user_roles')
      .select('user_id, role');

    const rolesMap = new Map<string, string[]>();
    rolesData?.forEach(r => {
      if (!rolesMap.has(r.user_id)) {
        rolesMap.set(r.user_id, []);
      }
      rolesMap.get(r.user_id)!.push(r.role);
    });

    // Fetch subscription status
    const { data: subsData } = await supabaseClient
      .from('subscribers')
      .select('user_id, subscribed, subscription_tier');

    const subsMap = new Map<string, { subscribed: boolean; tier: string | null }>();
    subsData?.forEach(s => {
      subsMap.set(s.user_id, { 
        subscribed: s.subscribed, 
        tier: s.subscription_tier 
      });
    });

    // Get engagement stats for each user
    const usersWithData = await Promise.all(
      (profiles || []).map(async (profile) => {
        const { data: stats } = await supabaseClient
          .rpc('get_user_engagement_stats', { target_user_id: profile.id });

        return {
          ...profile,
          email: emailMap.get(profile.id) || null,
          roles: rolesMap.get(profile.id) || [],
          subscription: subsMap.get(profile.id) || { subscribed: false, tier: null },
          post_count: stats?.[0]?.post_count || 0,
          comment_count: stats?.[0]?.comment_count || 0,
          flag_count: stats?.[0]?.flag_count || 0,
        };
      })
    );

    return new Response(
      JSON.stringify({ users: usersWithData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in admin-get-users:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
