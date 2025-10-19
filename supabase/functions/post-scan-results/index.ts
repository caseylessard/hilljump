import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HILLJUMP_USER_ID = '34abc915-397a-47f1-a137-397af4f93f7e';

interface ScanResult {
  ticker: string;
  conviction: number;
  rr: number;
  direction: 'CALL' | 'PUT';
  entry: number;
  target: number;
  stop: number;
}

interface ScanSummary {
  totalAnalyzed: number;
  qualifiedSignals: number;
  signals: ScanResult[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authentication check
  const apiSecret = Deno.env.get('INTERNAL_API_SECRET');
  const providedSecret = req.headers.get('X-API-Secret');
  
  if (!apiSecret || providedSecret !== apiSecret) {
    console.error('❌ Unauthorized access attempt to post-scan-results');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { scanResults } = await req.json() as { scanResults: ScanSummary };

    // Generate post content
    const postContent = formatScanResults(scanResults);

    // Create post from HillJump user
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: HILLJUMP_USER_ID,
        content: postContent,
      })
      .select()
      .single();

    if (postError) {
      console.error('Error creating post:', postError);
      throw postError;
    }

    console.log('✅ Created scan results post:', post.id);

    // Get all users to notify
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .neq('id', HILLJUMP_USER_ID);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    } else if (profiles && profiles.length > 0) {
      // Create notifications for all users
      const notifications = profiles.map(profile => ({
        user_id: profile.id,
        post_id: post.id,
        type: 'new_signal',
      }));

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notificationError) {
        console.error('Error creating notifications:', notificationError);
      } else {
        console.log(`✅ Created ${notifications.length} notifications`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, postId: post.id }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in post-scan-results:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

function formatScanResults(results: ScanSummary): string {
  const { totalAnalyzed, qualifiedSignals, signals } = results;
  
  if (qualifiedSignals === 0) {
    return `🔍 **New Signals:** Scanner completed analysis of ${totalAnalyzed} tickers. No high-conviction signals found in this scan.`;
  }

  let content = `🔍 **New Signals:** Found ${qualifiedSignals} high-conviction ${qualifiedSignals === 1 ? 'signal' : 'signals'} from ${totalAnalyzed} tickers analyzed.\n\n`;
  
  const topSignals = signals.slice(0, 5);
  
  topSignals.forEach((signal, index) => {
    const emoji = signal.direction === 'CALL' ? '📈' : '📉';
    content += `${emoji} **${signal.ticker}** (${signal.conviction.toFixed(0)}% conviction)\n`;
    content += `   ${signal.direction} | Entry: $${signal.entry.toFixed(2)} | Target: $${signal.target.toFixed(2)} | R/R: ${signal.rr.toFixed(1)}:1\n\n`;
  });

  if (qualifiedSignals > 5) {
    content += `... and ${qualifiedSignals - 5} more ${qualifiedSignals - 5 === 1 ? 'signal' : 'signals'}. Check the Scanner for full details.`;
  }

  return content;
}
