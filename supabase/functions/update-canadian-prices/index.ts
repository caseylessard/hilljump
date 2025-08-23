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
    console.log('🇨🇦 Starting Canadian ETF price update...')
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials')
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get Canadian ETF tickers from database
    console.log('📊 Fetching Canadian ETF tickers...')
    const { data: canadianETFs, error: fetchError } = await supabase
      .from('etfs')
      .select('id, ticker, name, active')
      .or('ticker.like.%.TO,ticker.like.%.NE')
      .eq('active', true)

    if (fetchError) {
      console.error('❌ Failed to fetch Canadian ETFs:', fetchError)
      throw new Error(`Failed to fetch Canadian ETFs: ${fetchError.message}`)
    }

    if (!canadianETFs || canadianETFs.length === 0) {
      console.log('⚠️ No Canadian ETFs found in database')
      return new Response(JSON.stringify({ 
        message: 'No Canadian ETFs found',
        updated: 0,
        total: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`📈 Found ${canadianETFs.length} Canadian ETFs to update`)
    const results = []
    let successCount = 0
    let errorCount = 0

    // Process each ETF with proper error handling
    for (let i = 0; i < canadianETFs.length; i++) {
      const etf = canadianETFs[i]
      
      try {
        console.log(`[${i+1}/${canadianETFs.length}] 💰 Fetching ${etf.ticker}...`)
        
        // Yahoo Finance API endpoint for real-time quotes
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${etf.ticker}?interval=1d&range=2d`
        const response = await fetch(yahooUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache'
          },
          timeout: 5000
        })

        if (!response.ok) {
          throw new Error(`Yahoo Finance API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        
        if (!data || !data.chart || !data.chart.result || data.chart.result.length === 0) {
          throw new Error('No chart data in response')
        }

        const result = data.chart.result[0]
        
        if (data.chart.error) {
          throw new Error(`Yahoo Finance error: ${data.chart.error.description}`)
        }

        // Get current price from the most recent data point
        let currentPrice = result.meta?.regularMarketPrice || 
                          result.meta?.previousClose

        // Fallback to last close price if regular market price not available
        if (!currentPrice || currentPrice <= 0) {
          const quotes = result.indicators?.quote?.[0]
          if (quotes?.close?.length > 0) {
            // Get the most recent non-null close price
            const closes = quotes.close.filter(c => c != null && c > 0)
            if (closes.length > 0) {
              currentPrice = closes[closes.length - 1]
            }
          }
        }

        if (!currentPrice || currentPrice <= 0) {
          throw new Error(`No valid price found. Meta: ${JSON.stringify(result.meta)}`)
        }

        // Update database with fetched price
        console.log(`💾 Updating ${etf.ticker} with price $${currentPrice}...`)
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

        console.log(`✅ ${etf.ticker}: $${currentPrice.toFixed(4)}`)
        results.push({
          ticker: etf.ticker,
          price: currentPrice,
          status: 'success'
        })
        successCount++

      } catch (error) {
        console.error(`❌ ${etf.ticker}: ${error.message}`)
        results.push({
          ticker: etf.ticker,
          error: error.message,
          status: 'error'
        })
        errorCount++
      }

      // Rate limiting: small delay between requests
      if (i < canadianETFs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 150))
      }
    }

    const message = `Updated ${successCount}/${canadianETFs.length} Canadian ETF prices`
    console.log(`🎉 ${message}. Errors: ${errorCount}`)

    return new Response(JSON.stringify({
      success: true,
      message,
      total: canadianETFs.length,
      successful: successCount,
      errors: errorCount,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('💥 Canadian price update failed:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Failed to update Canadian prices',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})