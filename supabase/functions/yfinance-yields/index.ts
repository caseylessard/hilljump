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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables")
    }
    
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    })

    const { tickers, updateDatabase = true } = await req.json()
    
    if (!tickers || !Array.isArray(tickers)) {
      return new Response(JSON.stringify({ error: 'Invalid tickers array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const yields: Record<string, number> = {}
    let dbUpdates = 0
    console.log(`📊 Fetching yields for ${tickers.length} tickers`)

    // Process in smaller batches to avoid overwhelming Yahoo Finance
    const batchSize = 10
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize)
      
      for (const ticker of batch) {
        try {
          console.log(`🔍 Fetching yield for ${ticker}`)
          
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
            const summaryDetail = data?.quoteSummary?.result?.[0]?.summaryDetail
            
            if (summaryDetail?.dividendYield?.raw) {
              // Convert from decimal to percentage (e.g., 0.05 -> 5.0)
              const yieldValue = summaryDetail.dividendYield.raw * 100
              yields[ticker] = yieldValue
              
              // Update database if requested
              if (updateDatabase) {
                const { error: updateError } = await supabase
                  .from('etfs')
                  .update({ 
                    yield_ttm: yieldValue,
                    price_updated_at: new Date().toISOString()
                  })
                  .eq('ticker', ticker)
                
                if (!updateError) {
                  dbUpdates++
                  console.log(`✅ Updated ${ticker}: ${yieldValue.toFixed(2)}%`)
                } else {
                  console.log(`❌ DB update failed for ${ticker}:`, updateError.message)
                }
              } else {
                console.log(`✅ Found yield for ${ticker}: ${yieldValue.toFixed(2)}%`)
              }
            } else {
              console.log(`❌ No dividend yield found for ${ticker}`)
            }
          } else {
            console.log(`❌ HTTP error for ${ticker}: ${response.status}`)
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))
          
        } catch (error) {
          console.log(`❌ Error fetching yield for ${ticker}:`, error.message)
          // Continue with other tickers
        }
      }
      
      // Pause between batches
      if (i + batchSize < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`📈 Yield fetch complete. Found yields for ${Object.keys(yields).length} tickers, updated ${dbUpdates} in database`)

    return new Response(JSON.stringify({ 
      yields, 
      dbUpdates,
      totalProcessed: tickers.length,
      success: true 
    }), {
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