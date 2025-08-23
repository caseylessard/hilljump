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

    const yields: Record<string, number> = {}
    console.log(`Fetching yields for ${tickers.length} tickers`)

    // Fetch yields from Yahoo Finance for each ticker
    for (const ticker of tickers) {
      try {
        console.log(`Fetching yield for ${ticker}`)
        
        // Yahoo Finance API endpoint for key statistics
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail`
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log(`Response for ${ticker}:`, JSON.stringify(data, null, 2))
          
          const summaryDetail = data?.quoteSummary?.result?.[0]?.summaryDetail
          
          if (summaryDetail?.dividendYield?.raw) {
            // Convert from decimal to percentage (e.g., 0.05 -> 5.0)
            const yieldValue = summaryDetail.dividendYield.raw * 100
            yields[ticker] = yieldValue
            console.log(`✅ Found yield for ${ticker}: ${yieldValue.toFixed(2)}%`)
          } else {
            console.log(`❌ No dividend yield found for ${ticker}`)
          }
        } else {
          console.log(`❌ HTTP error for ${ticker}: ${response.status}`)
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150))
        
      } catch (error) {
        console.log(`❌ Error fetching yield for ${ticker}:`, error.message)
        // Continue with other tickers
      }
    }

    console.log(`Yield fetch complete. Found yields for ${Object.keys(yields).length} tickers:`, yields)

    return new Response(JSON.stringify({ yields }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Yahoo Finance yields error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})