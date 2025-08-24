import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

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

    console.log(`📊 Fetching prices for ${tickers.length} tickers from Yahoo Finance`)

    const prices: Record<string, number> = {}
    let successCount = 0

    // Process tickers in small batches to avoid rate limiting
    const batchSize = 5
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize)
      
      for (const ticker of batch) {
        try {
          console.log(`🔍 Fetching price for ${ticker}`)
          
          // Yahoo Finance API endpoint for current price
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json'
            }
          })
          
          if (response.ok) {
            const data = await response.json()
            const result = data?.chart?.result?.[0]
            
            if (result?.meta?.regularMarketPrice && typeof result.meta.regularMarketPrice === 'number') {
              const price = result.meta.regularMarketPrice
              prices[ticker] = price
              successCount++
              console.log(`✅ ${ticker}: $${price.toFixed(2)}`)
            } else {
              console.log(`❌ No price data for ${ticker}`)
            }
          } else {
            console.log(`❌ HTTP ${response.status} for ${ticker}`)
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 200))
          
        } catch (error) {
          console.log(`❌ Error fetching ${ticker}:`, error.message)
        }
      }
      
      // Pause between batches
      if (i + batchSize < tickers.length) {
        console.log(`⏸️ Pausing between batches...`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`📈 Completed: ${successCount}/${tickers.length} prices fetched`)

    return new Response(JSON.stringify({ 
      prices,
      success: true,
      totalProcessed: tickers.length,
      successfullyFetched: successCount
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Yahoo Finance prices error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})