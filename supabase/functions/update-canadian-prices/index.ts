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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get Canadian ETF tickers from database
    const { data: canadianETFs, error: fetchError } = await supabase
      .from('etfs')
      .select('id, ticker, name')
      .or('ticker.like.%.TO,ticker.like.%.NE')
      .eq('active', true)

    if (fetchError) {
      throw new Error(`Failed to fetch Canadian ETFs: ${fetchError.message}`)
    }

    if (!canadianETFs || canadianETFs.length === 0) {
      console.log('No Canadian ETFs found')
      return new Response(JSON.stringify({ 
        message: 'No Canadian ETFs found',
        updated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Found ${canadianETFs.length} Canadian ETFs to update`)
    const results = []
    let successCount = 0
    let errorCount = 0

    // Fetch prices from Yahoo Finance and update database
    for (const etf of canadianETFs) {
      try {
        console.log(`Fetching price for ${etf.ticker}...`)
        
        // Yahoo Finance API endpoint for real-time quotes
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${etf.ticker}?interval=1d&range=1d`
        const response = await fetch(yahooUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })

        if (!response.ok) {
          throw new Error(`Yahoo API returned ${response.status}`)
        }

        const data = await response.json()
        const result = data?.chart?.result?.[0]
        
        if (!result) {
          throw new Error('No chart data returned')
        }

        // Get current price from the most recent data point
        const currentPrice = result.meta?.regularMarketPrice || 
                           result.meta?.previousClose ||
                           (result.indicators?.quote?.[0]?.close?.slice(-1)[0])

        if (!currentPrice || currentPrice <= 0) {
          throw new Error('No valid price found')
        }

        // Get additional data if available
        const previousClose = result.meta?.previousClose
        const change = currentPrice && previousClose ? currentPrice - previousClose : null
        const changePercent = change && previousClose ? (change / previousClose) * 100 : null

        // Update database with fetched price
        const { error: updateError } = await supabase
          .from('etfs')
          .update({
            current_price: currentPrice,
            price_updated_at: new Date().toISOString()
          })
          .eq('id', etf.id)

        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`)
        }

        console.log(`✅ Updated ${etf.ticker}: $${currentPrice}`)
        results.push({
          ticker: etf.ticker,
          price: currentPrice,
          change: change,
          changePercent: changePercent,
          status: 'success'
        })
        successCount++

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (error) {
        console.error(`❌ Failed to update ${etf.ticker}:`, error.message)
        results.push({
          ticker: etf.ticker,
          error: error.message,
          status: 'error'
        })
        errorCount++
      }
    }

    console.log(`Price update complete: ${successCount} successful, ${errorCount} errors`)

    return new Response(JSON.stringify({
      message: `Updated ${successCount} Canadian ETF prices`,
      total: canadianETFs.length,
      successful: successCount,
      errors: errorCount,
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Canadian price update error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to update Canadian prices',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})