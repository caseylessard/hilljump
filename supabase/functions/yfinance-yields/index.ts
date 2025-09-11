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
    const apiKey = Deno.env.get('EODHD_API_KEY')
    
    if (!apiKey) {
      throw new Error('EODHD API key not found')
    }
    
    if (!tickers || !Array.isArray(tickers)) {
      return new Response(JSON.stringify({ error: 'Invalid tickers array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`📊 Fetching yields for ${tickers.length} tickers from EODHD`)

    const yields: Record<string, number> = {}
    let successCount = 0

    // Process tickers in batches
    const batchSize = 10 // EODHD allows higher rate limits
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize)
      
      for (const ticker of batch) {
        try {
          console.log(`🔍 Fetching yield for ${ticker}`)
          
          // Format ticker for EODHD (handle Canadian tickers)
          const eodhTicker = ticker.includes('.TO') 
            ? ticker.replace('.TO', '.TSE') 
            : ticker.includes('.') 
              ? ticker 
              : `${ticker}.US`;
          
          // EODHD Fundamentals API for dividend yield
          const url = `https://eodhd.com/api/fundamentals/${eodhTicker}?api_token=${apiKey}&filter=Highlights::DividendYield`
          const response = await fetch(url)
          
          if (response.ok) {
            const data = await response.json()
            const dividendYield = data?.Highlights?.DividendYield
            
            if (dividendYield && typeof dividendYield === 'number' && dividendYield > 0) {
              // EODHD returns yield as percentage (e.g., 5.2 for 5.2%)
              yields[ticker] = dividendYield
              successCount++
              console.log(`✅ ${ticker}: ${dividendYield.toFixed(2)}%`)
            } else {
              console.log(`❌ No yield data for ${ticker}`)
            }
          } else {
            console.log(`❌ HTTP ${response.status} for ${ticker}`)
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100))
          
        } catch (error) {
          console.log(`❌ Error fetching ${ticker}:`, error.message)
        }
      }
      
      // Pause between batches
      if (i + batchSize < tickers.length) {
        console.log(`⏸️ Pausing between batches...`)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    console.log(`📈 Completed: ${successCount}/${tickers.length} yields fetched`)

    return new Response(JSON.stringify({ 
      yields,
      success: true,
      totalProcessed: tickers.length,
      successfullyFetched: successCount
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ EODHD error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})