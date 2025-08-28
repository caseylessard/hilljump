import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { rankings } = await req.json()
    
    if (!Array.isArray(rankings)) {
      throw new Error('Rankings must be an array')
    }

    // Get current week date (Monday of current week)
    const now = new Date()
    const currentWeekDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1)
    const weekDateStr = currentWeekDate.toISOString().split('T')[0]

    // Delete existing rankings for this week (if any)
    await supabaseClient
      .from('etf_rankings')
      .delete()
      .eq('week_date', weekDateStr)

    // Insert new rankings
    const rankingData = rankings.map((etf: any, index: number) => ({
      ticker: etf.ticker,
      rank_position: index + 1,
      composite_score: etf.compositeScore || etf.dripSumScore || 0,
      week_date: weekDateStr
    }))

    const { error } = await supabaseClient
      .from('etf_rankings')
      .insert(rankingData)

    if (error) {
      throw error
    }

    console.log(`Saved rankings for ${rankings.length} ETFs for week ${weekDateStr}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        week_date: weekDateStr,
        count: rankings.length 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error saving rankings:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})