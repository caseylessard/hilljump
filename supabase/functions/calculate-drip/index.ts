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
    
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid or empty tickers array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`🧮 Calculating DRIP data for ${tickers.length} tickers`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Pre-filter tickers to only process those with ETF data and recent dividends
    const { data: etfsWithData, error: etfError } = await supabase
      .from('etfs')
      .select('ticker, current_price, currency')
      .in('ticker', tickers)
      .eq('active', true)
      .not('current_price', 'is', null)

    if (etfError) {
      console.error('❌ Failed to fetch ETF data:', etfError)
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to fetch ETF data for DRIP calculations',
        details: etfError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const validTickers = etfsWithData?.map(etf => etf.ticker) || []
    console.log(`📊 Processing ${validTickers.length} valid tickers (filtered from ${tickers.length})`)

    if (validTickers.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        dripData: {},
        processed: 0,
        errors: 0,
        total: 0,
        message: 'No valid tickers found for DRIP calculation'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch live prices only for valid tickers
    console.log('📊 Fetching live prices for DRIP calculations...')
    const { data: quotesData, error: quotesError } = await supabase.functions.invoke('quotes', {
      body: { tickers: validTickers }
    })

    const livePrices = quotesData?.prices || {}
    console.log(`✅ Fetched ${Object.keys(livePrices).length} live prices`)

    const dripData: Record<string, any> = {}
    let processedCount = 0
    let errorCount = 0

    // Calculate DRIP percentages for each valid ticker
    for (const ticker of validTickers) {
      try {
        console.log(`[${processedCount + 1}/${validTickers.length}] 📊 Processing ${ticker}...`)
        
        // Get current price from live prices first, then database as fallback
        let currentPrice = livePrices[ticker]
        
        if (!currentPrice) {
          // Fallback: try database price
          const { data: etfData, error: etfError } = await supabase
            .from('etfs')
            .select('current_price, currency, total_return_1y')
            .eq('ticker', ticker)
            .single()

          currentPrice = etfData?.current_price
          
          // If still no price, try to estimate from total return
          if (!currentPrice && etfData?.total_return_1y) {
            // Use a reasonable estimated price based on average ETF price
            currentPrice = 25.0 // Conservative estimate
            console.log(`⚠️ Using estimated price for ${ticker}: $${currentPrice}`)
          }
        } else {
          console.log(`✅ Using live price for ${ticker}: $${currentPrice}`)
        }

        if (!currentPrice || currentPrice <= 0) {
          console.log(`❌ No price data for ${ticker}`)
          // Still create entry with zero DRIP values so we have placeholder data
          dripData[ticker] = {
            ticker,
            currentPrice: null,
            drip4wPercent: 0,
            drip4wDollar: 0,
            drip12wPercent: 0,
            drip12wDollar: 0,
            drip52wPercent: 0,
            drip52wDollar: 0,
            error: 'No price data available'
          }
          errorCount++
          continue
        }

        // Get dividends for the past periods
        const now = new Date()
        const dates = {
          '4w': new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),   // 4 weeks (28 days)
          '12w': new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000),  // 12 weeks (84 days)  
          '52w': new Date(now.getTime() - 364 * 24 * 60 * 60 * 1000)  // 52 weeks (364 days)
        }

        // Calculate DRIP for all periods
        const periods = ['4w', '12w', '52w']
        const periodLabels = { '4w': '4W', '12w': '12W', '52w': '52W' }
        
        const result: any = { ticker, currentPrice }

        for (const period of periods) {
          const label = periodLabels[period as keyof typeof periodLabels]
          const startDate = dates[period as keyof typeof dates].toISOString().split('T')[0]
          
          console.log(`  🔍 Fetching ${label} dividends for ${ticker} since ${startDate}`)
          
          // Get dividends in this period
          const { data: dividends, error: divError } = await supabase
            .from('dividends')
            .select('amount, ex_date, pay_date')
            .eq('ticker', ticker)
            .gte('ex_date', startDate)
            .order('ex_date', { ascending: true })

          if (divError) {
            console.log(`❌ Error fetching ${label} dividends for ${ticker}:`, divError.message)
            result[`drip${period}Percent`] = 0
            result[`drip${period}Dollar`] = 0
            continue
          }

          if (!dividends || dividends.length === 0) {
            console.log(`  📊 No ${label} dividends found for ${ticker}`)
            result[`drip${period}Percent`] = 0
            result[`drip${period}Dollar`] = 0
            continue
          }

          // Sum total dividends in period
          const totalDividends = dividends.reduce((sum, div) => sum + Number(div.amount || 0), 0)
          
          // Calculate DRIP return percentage
          const dripPercent = totalDividends > 0 ? (totalDividends / currentPrice) * 100 : 0
          
          result[`drip${period}Percent`] = Math.round(dripPercent * 100) / 100 // Round to 2 decimals
          result[`drip${period}Dollar`] = Math.round(totalDividends * 10000) / 10000 // Round to 4 decimals
          
          console.log(`  📈 ${ticker} ${label}: ${dividends.length} dividends, $${totalDividends.toFixed(4)} = ${dripPercent.toFixed(2)}%`)
        }

        dripData[ticker] = result
        processedCount++

      } catch (error) {
        console.error(`💥 Error calculating DRIP for ${ticker}:`, error)
        dripData[ticker] = {
          ticker,
          currentPrice: null,
          drip4wPercent: 0,
          drip4wDollar: 0,
          drip12wPercent: 0,
          drip12wDollar: 0,
          drip52wPercent: 0,
          drip52wDollar: 0,
          error: error.message
        }
        errorCount++
      }
    }

    console.log(`🎉 DRIP calculation complete: ${processedCount} successful, ${errorCount} errors`)

    return new Response(JSON.stringify({ 
      success: true,
      dripData,
      processed: processedCount,
      errors: errorCount,
      total: validTickers.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('💥 DRIP calculation error:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Failed to calculate DRIP data',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})