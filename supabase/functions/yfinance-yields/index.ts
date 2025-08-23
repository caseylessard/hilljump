import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

    console.log(`📊 Fetching yields for ${tickers.length} tickers from Yahoo Finance`)

    const yields: Record<string, number> = {}
    let successCount = 0

    // Process tickers in small batches to avoid rate limiting
    const batchSize = 5
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize)
      
      for (const ticker of batch) {
        try {
          console.log(`🔍 Fetching yield for ${ticker}`)
          
          // Yahoo Finance API endpoint
          const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail`
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json'
            }
          })
          
          if (response.ok) {
            const data = await response.json()
            const summaryDetail = data?.quoteSummary?.result?.[0]?.summaryDetail
            
            if (summaryDetail?.dividendYield?.raw && typeof summaryDetail.dividendYield.raw === 'number') {
              // Convert from decimal to percentage (e.g., 0.05 -> 5.0)
              const yieldValue = summaryDetail.dividendYield.raw * 100
              yields[ticker] = yieldValue
              successCount++
              console.log(`✅ ${ticker}: ${yieldValue.toFixed(2)}%`)
            } else {
              console.log(`❌ No yield data for ${ticker}`)
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
    console.error('❌ Yahoo Finance error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})