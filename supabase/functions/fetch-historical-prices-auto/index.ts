import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { ticker, days = 90 } = await req.json()

    console.log(`📈 Fetching ${days} days of historical data for ${ticker || 'all active ETFs'}...`)

    let etfsToProcess = []
    
    if (ticker) {
      // Fetch specific ticker
      const { data: etfData, error: etfError } = await supabaseClient
        .from('etfs')
        .select('ticker, eodhd_symbol, data_source')
        .eq('ticker', ticker)
        .eq('active', true)
        .single()
      
      if (etfError || !etfData) {
        throw new Error(`ETF ${ticker} not found or inactive`)
      }
      etfsToProcess = [etfData]
    } else {
      // Fetch all active ETFs with EODHD symbols
      const { data: etfData, error: etfError } = await supabaseClient
        .from('etfs')
        .select('ticker, eodhd_symbol, data_source')
        .eq('active', true)
        .not('eodhd_symbol', 'is', null)
        .limit(50) // Limit to avoid timeout
      
      if (etfError) {
        throw new Error(`Failed to fetch ETF list: ${etfError.message}`)
      }
      etfsToProcess = etfData || []
    }

    console.log(`📊 Processing ${etfsToProcess.length} ETFs...`)

    const results = {
      processed: 0,
      inserted: 0,
      updated: 0,
      errors: 0,
      sample: [] as any[],
      errorDetails: [] as string[]
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)

    for (const etf of etfsToProcess) {
      try {
        console.log(`📈 Fetching data for ${etf.ticker} (${etf.eodhd_symbol})...`)
        
        // Use EODHD API if symbol exists, otherwise fall back to Yahoo Finance
        let historicalData = []
        
        if (etf.eodhd_symbol && etf.data_source === 'eodhd') {
          // Fetch from EODHD
          const eodhdApiKey = Deno.env.get('EODHD_API_KEY')
          if (!eodhdApiKey) {
            throw new Error('EODHD API key not configured')
          }

          const eodhdUrl = `https://eodhd.com/api/eod/${etf.eodhd_symbol}?api_token=${eodhdApiKey}&from=${startDate.toISOString().split('T')[0]}&to=${endDate.toISOString().split('T')[0]}&fmt=json`
          
          const eodhdResponse = await fetch(eodhdUrl)
          if (!eodhdResponse.ok) {
            throw new Error(`EODHD API error: ${eodhdResponse.status}`)
          }
          
          const eodhdData = await eodhdResponse.json()
          historicalData = eodhdData.map((item: any) => ({
            ticker: etf.ticker,
            date: item.date,
            open_price: parseFloat(item.open),
            high_price: parseFloat(item.high),  
            low_price: parseFloat(item.low),
            close_price: parseFloat(item.close),
            adjusted_close: parseFloat(item.adjusted_close),
            volume: parseInt(item.volume) || null
          }))
        } else {
          // Fall back to Yahoo Finance (free)
          const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${etf.ticker}?period1=${Math.floor(startDate.getTime() / 1000)}&period2=${Math.floor(endDate.getTime() / 1000)}&interval=1d`
          
          const yahooResponse = await fetch(yahooUrl)
          if (!yahooResponse.ok) {
            throw new Error(`Yahoo Finance API error: ${yahooResponse.status}`)
          }
          
          const yahooData = await yahooResponse.json()
          const result = yahooData.chart?.result?.[0]
          
          if (!result || !result.timestamp) {
            throw new Error('No data returned from Yahoo Finance')
          }
          
          const timestamps = result.timestamp
          const quotes = result.indicators?.quote?.[0]
          const adjClose = result.indicators?.adjclose?.[0]?.adjclose
          
          historicalData = timestamps.map((timestamp: number, index: number) => ({
            ticker: etf.ticker,
            date: new Date(timestamp * 1000).toISOString().split('T')[0],
            open_price: quotes?.open?.[index] || null,
            high_price: quotes?.high?.[index] || null,
            low_price: quotes?.low?.[index] || null,
            close_price: quotes?.close?.[index] || null,
            adjusted_close: adjClose?.[index] || null,
            volume: quotes?.volume?.[index] || null
          })).filter(item => item.close_price !== null)
        }

        console.log(`📊 Found ${historicalData.length} price records for ${etf.ticker}`)
        
        // Insert/update historical data
        if (historicalData.length > 0) {
          const { data: insertData, error: insertError } = await supabaseClient
            .from('historical_prices')
            .upsert(historicalData, {
              onConflict: 'ticker,date',
              ignoreDuplicates: false
            })
          
          if (insertError) {
            console.error(`Insert error for ${etf.ticker}:`, insertError)
            results.errors++
            results.errorDetails.push(`${etf.ticker}: ${insertError.message}`)
          } else {
            results.inserted += historicalData.length
            if (results.sample.length < 5) {
              results.sample.push(...historicalData.slice(0, 2))
            }
          }
        }
        
        results.processed++
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`Error processing ${etf.ticker}:`, error)
        results.errors++
        results.errorDetails.push(`${etf.ticker}: ${error.message}`)
      }
    }

    console.log('📊 Historical price fetch summary:', results)

    return new Response(
      JSON.stringify({ 
        success: true,
        ...results,
        message: `Processed ${results.processed} ETFs, inserted ${results.inserted} price records`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Historical price fetch failed:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})