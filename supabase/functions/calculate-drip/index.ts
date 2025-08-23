import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { tickers } = await req.json()
    
    if (!tickers || !Array.isArray(tickers)) {
      return new Response(JSON.stringify({ error: 'Invalid tickers array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const dripData: Record<string, any> = {}

    // Calculate DRIP percentages for each ticker
    for (const ticker of tickers) {
      try {
        // Get current price from database
        const { data: etfData, error: etfError } = await supabase
          .from('etfs')
          .select('current_price, currency')
          .eq('ticker', ticker)
          .single()

        if (etfError || !etfData?.current_price) {
          console.log(`No price data for ${ticker}`)
          continue
        }

        const currentPrice = etfData.current_price

        // Get dividends for the past periods
        const now = new Date()
        const dates = {
          '4w': new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),  // 4 weeks
          '12w': new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000), // 12 weeks  
          '52w': new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) // 52 weeks
        }

        const periods = ['4w', '12w', '52w']
        const result: any = { ticker, currentPrice }

        for (const period of periods) {
          const startDate = dates[period as keyof typeof dates].toISOString().split('T')[0]
          
          // Get dividends in this period
          const { data: dividends, error: divError } = await supabase
            .from('dividends')
            .select('amount, ex_date')
            .eq('ticker', ticker)
            .gte('ex_date', startDate)
            .order('ex_date', { ascending: true })

          if (divError) {
            console.log(`Error fetching dividends for ${ticker}:`, divError.message)
            continue
          }

          if (!dividends || dividends.length === 0) {
            // No dividends in this period
            result[`drip${period}Percent`] = 0
            result[`drip${period}Dollar`] = 0
            continue
          }

          // Sum total dividends in period
          const totalDividends = dividends.reduce((sum, div) => sum + Number(div.amount), 0)
          
          // Calculate DRIP return percentage
          const dripPercent = (totalDividends / currentPrice) * 100
          
          result[`drip${period}Percent`] = dripPercent
          result[`drip${period}Dollar`] = totalDividends
          
          console.log(`${ticker} ${period}: $${totalDividends.toFixed(4)} dividends = ${dripPercent.toFixed(2)}%`)
        }

        dripData[ticker] = result

      } catch (error) {
        console.error(`Error calculating DRIP for ${ticker}:`, error)
      }
    }

    return new Response(JSON.stringify({ dripData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('DRIP calculation error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to calculate DRIP data',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})