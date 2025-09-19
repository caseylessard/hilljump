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

    const { ticker, days = 365 } = await req.json()
    console.log(`📊 Auto-fetching dividends for ${ticker || 'all active ETFs'} (last ${days} days)...`)

    let etfsToProcess = []
    
    if (ticker) {
      // Fetch specific ticker
      const { data: etfData, error: etfError } = await supabaseClient
        .from('etfs')
        .select('id, ticker, eodhd_symbol, data_source')
        .eq('ticker', ticker)
        .eq('active', true)
        .single()
      
      if (etfError || !etfData) {
        throw new Error(`ETF ${ticker} not found or inactive`)
      }
      etfsToProcess = [etfData]
    } else {
      // Fetch all active ETFs
      const { data: etfData, error: etfError } = await supabaseClient
        .from('etfs')
        .select('id, ticker, eodhd_symbol, data_source')
        .eq('active', true)
        .order('ticker')
        .limit(100) // Process in batches to avoid timeout
      
      if (etfError) {
        throw new Error(`Failed to fetch ETF list: ${etfError.message}`)
      }
      etfsToProcess = etfData || []
    }

    console.log(`📈 Processing ${etfsToProcess.length} ETFs...`)

    const results = {
      processed: 0,
      inserted: 0,
      updated: 0,
      duplicates_found: 0,
      weekly_collisions: [] as any[],
      errors: 0,
      sample: [] as any[],
      errorDetails: [] as string[]
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)

    // Process ETFs in small batches to respect rate limits
    const batchSize = 5
    for (let i = 0; i < etfsToProcess.length; i += batchSize) {
      const batch = etfsToProcess.slice(i, i + batchSize)
      
      await Promise.all(batch.map(async (etf) => {
        try {
          console.log(`💰 Fetching dividends for ${etf.ticker}...`)
          
          // Fetch dividends using multiple sources with fallbacks
          const dividends = await fetchDividendsWithFallback(etf, startDate, endDate)
          
          if (dividends.length === 0) {
            console.log(`❌ No dividends found for ${etf.ticker}`)
            results.processed++
            return
          }

          console.log(`📊 Found ${dividends.length} dividend records for ${etf.ticker}`)

          // Check for weekly collisions before inserting
          const weeklyCollisions = detectWeeklyCollisions(dividends, etf.ticker)
          if (weeklyCollisions.length > 0) {
            results.weekly_collisions.push(...weeklyCollisions)
            console.warn(`⚠️ Weekly collisions detected for ${etf.ticker}:`, weeklyCollisions)
          }

          // Upsert dividends with duplicate detection
          for (const dividend of dividends) {
            const { error: upsertError } = await supabaseClient
              .from('dividends')
              .upsert({
                etf_id: etf.id,
                ticker: etf.ticker,
                ex_date: dividend.ex_date,
                pay_date: dividend.pay_date,
                amount: dividend.amount,
                cash_currency: dividend.currency || 'USD',
                cadence: dividend.cadence || null
              }, {
                onConflict: 'ticker,ex_date',
                ignoreDuplicates: false // We want to update existing records
              })

            if (upsertError) {
              console.error(`❌ Upsert error for ${etf.ticker}:`, upsertError)
              results.errors++
              results.errorDetails.push(`${etf.ticker}: ${upsertError.message}`)
            } else {
              results.inserted++
              if (results.sample.length < 10) {
                results.sample.push({
                  ticker: etf.ticker,
                  ex_date: dividend.ex_date,
                  amount: dividend.amount,
                  source: dividend.source
                })
              }
            }
          }

          // Calculate and update TTM yield
          await updateTTMYield(supabaseClient, etf, dividends)
          
          results.processed++
          
        } catch (error) {
          console.error(`❌ Error processing ${etf.ticker}:`, error)
          results.errors++
          results.errorDetails.push(`${etf.ticker}: ${error.message}`)
        }
      }))

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < etfsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    // Clean up obvious duplicates after processing
    await cleanupDuplicates(supabaseClient, results)

    console.log('📊 Auto dividend fetch summary:', results)

    return new Response(
      JSON.stringify({ 
        success: true,
        ...results,
        message: `Processed ${results.processed} ETFs, inserted ${results.inserted} dividend records`,
        warnings: results.weekly_collisions.length > 0 ? 
          `Found ${results.weekly_collisions.length} weekly collisions - review manually` : null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Auto dividend fetch failed:', error)
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

// Fetch dividends with multiple source fallbacks
async function fetchDividendsWithFallback(etf: any, startDate: Date, endDate: Date) {
  // Try EODHD first if configured
  if (etf.eodhd_symbol && etf.data_source === 'eodhd') {
    try {
      const eodhd = await fetchEODHDDividends(etf.ticker, etf.eodhd_symbol, startDate, endDate)
      if (eodhd.length > 0) {
        console.log(`✅ EODHD: Found ${eodhd.length} dividends for ${etf.ticker}`)
        return eodhd
      }
    } catch (error) {
      console.error(`❌ EODHD failed for ${etf.ticker}:`, error)
    }
  }

  // Try Yahoo Finance fallback
  try {
    const yahoo = await fetchYahooDividends(etf.ticker, startDate, endDate)
    if (yahoo.length > 0) {
      console.log(`✅ Yahoo Finance: Found ${yahoo.length} dividends for ${etf.ticker}`)
      return yahoo
    }
  } catch (error) {
    console.error(`❌ Yahoo Finance failed for ${etf.ticker}:`, error)
  }

  // Try Alpha Vantage as last resort
  try {
    const alpha = await fetchAlphaVantageDividends(etf.ticker, startDate, endDate)
    if (alpha.length > 0) {
      console.log(`✅ Alpha Vantage: Found ${alpha.length} dividends for ${etf.ticker}`)
      return alpha
    }
  } catch (error) {
    console.error(`❌ Alpha Vantage failed for ${etf.ticker}:`, error)
  }

  return []
}

// EODHD API implementation
async function fetchEODHDDividends(ticker: string, eodhd_symbol: string, startDate: Date, endDate: Date) {
  const EODHD_API_KEY = Deno.env.get('EODHD_API_KEY')
  if (!EODHD_API_KEY) {
    throw new Error('EODHD API key not configured')
  }

  const fromDate = startDate.toISOString().split('T')[0]
  const toDate = endDate.toISOString().split('T')[0]
  const url = `https://eodhd.com/api/div/${eodhd_symbol}?api_token=${EODHD_API_KEY}&fmt=json&from=${fromDate}&to=${toDate}`
  
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`EODHD API error: ${response.status}`)
  }
  
  const data = await response.json()
  if (!Array.isArray(data)) return []
  
  return data
    .filter(item => item.value && parseFloat(item.value) > 0)
    .map(item => ({
      ex_date: item.date,
      pay_date: item.paymentDate || null,
      amount: parseFloat(item.value),
      currency: item.currency || 'USD',
      source: 'eodhd'
    }))
}

// Yahoo Finance API implementation
async function fetchYahooDividends(ticker: string, startDate: Date, endDate: Date) {
  const startTimestamp = Math.floor(startDate.getTime() / 1000)
  const endTimestamp = Math.floor(endDate.getTime() / 1000)
  
  const url = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d&events=div`
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })
  
  if (!response.ok) {
    throw new Error(`Yahoo Finance API error: ${response.status}`)
  }
  
  const csvText = await response.text()
  const lines = csvText.trim().split('\n')
  
  if (lines.length <= 1) return []
  
  return lines.slice(1)
    .map(line => {
      const [date, amount] = line.split(',')
      const amountFloat = parseFloat(amount)
      
      if (isNaN(amountFloat) || amountFloat <= 0) return null
      
      return {
        ex_date: date,
        pay_date: null,
        amount: amountFloat,
        currency: 'USD',
        source: 'yahoo'
      }
    })
    .filter(item => item !== null)
}

// Alpha Vantage API implementation
async function fetchAlphaVantageDividends(ticker: string, startDate: Date, endDate: Date) {
  const ALPHA_VANTAGE_API_KEY = Deno.env.get('ALPHA_VANTAGE_API_KEY')
  if (!ALPHA_VANTAGE_API_KEY) {
    throw new Error('Alpha Vantage API key not configured')
  }

  const url = `https://www.alphavantage.co/query?function=DIVIDENDS&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })
  
  if (!response.ok) {
    throw new Error(`Alpha Vantage API error: ${response.status}`)
  }
  
  const data = await response.json()
  
  if (data['Error Message'] || data['Note']) {
    throw new Error(data['Error Message'] || data['Note'] || 'API limit reached')
  }

  const dividendData = data.data || []
  
  return dividendData
    .filter(dividend => {
      const exDate = new Date(dividend.ex_dividend_date)
      return exDate >= startDate && 
             exDate <= endDate && 
             dividend.amount && 
             parseFloat(dividend.amount) > 0
    })
    .map(dividend => ({
      ex_date: dividend.ex_dividend_date,
      pay_date: dividend.payment_date || null,
      amount: parseFloat(dividend.amount),
      currency: 'USD',
      source: 'alpha_vantage'
    }))
}

// Detect dividends within the same week (potential duplicates)
function detectWeeklyCollisions(dividends: any[], ticker: string) {
  const collisions = []
  const weekGroups: { [key: string]: any[] } = {}
  
  // Group dividends by week
  dividends.forEach(dividend => {
    const date = new Date(dividend.ex_date)
    const startOfWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay())
    const weekKey = startOfWeek.toISOString().split('T')[0]
    
    if (!weekGroups[weekKey]) {
      weekGroups[weekKey] = []
    }
    weekGroups[weekKey].push(dividend)
  })
  
  // Find weeks with multiple dividends
  Object.entries(weekGroups).forEach(([weekStart, weekDividends]) => {
    if (weekDividends.length > 1) {
      collisions.push({
        ticker,
        week_start: weekStart,
        dividend_count: weekDividends.length,
        dividends: weekDividends,
        total_amount: weekDividends.reduce((sum, d) => sum + d.amount, 0)
      })
    }
  })
  
  return collisions
}

// Update TTM yield calculation
async function updateTTMYield(supabaseClient: any, etf: any, dividends: any[]) {
  try {
    // Calculate TTM sum
    const ttmSum = dividends.reduce((sum, dividend) => sum + dividend.amount, 0)
    
    if (ttmSum <= 0) return
    
    // Get current price from Yahoo Finance
    const priceUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${etf.ticker}`
    const priceResponse = await fetch(priceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!priceResponse.ok) return
    
    const priceData = await priceResponse.json()
    const currentPrice = priceData?.chart?.result?.[0]?.meta?.regularMarketPrice
    
    if (!currentPrice || currentPrice <= 0) return
    
    const yieldTTM = (ttmSum / currentPrice) * 100
    
    // Update ETF with new yield
    const { error } = await supabaseClient
      .from('etfs')
      .update({ 
        yield_ttm: yieldTTM,
        updated_at: new Date().toISOString()
      })
      .eq('id', etf.id)
    
    if (error) {
      console.error(`Failed to update yield for ${etf.ticker}:`, error)
    } else {
      console.log(`✅ Updated ${etf.ticker} yield: ${yieldTTM.toFixed(2)}%`)
    }
  } catch (error) {
    console.error(`Error updating TTM yield for ${etf.ticker}:`, error)
  }
}

// Clean up obvious duplicates
async function cleanupDuplicates(supabaseClient: any, results: any) {
  try {
    // Find and remove exact duplicates (same ticker, ex_date, amount)
    const { data: duplicates, error } = await supabaseClient
      .rpc('find_dividend_duplicates') // We'll need to create this function
    
    if (error) {
      console.warn('Could not check for duplicates:', error)
      return
    }
    
    if (duplicates && duplicates.length > 0) {
      results.duplicates_found = duplicates.length
      console.log(`🧹 Found ${duplicates.length} potential duplicates to review`)
    }
  } catch (error) {
    console.error('Error during duplicate cleanup:', error)
  }
}