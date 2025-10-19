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

    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized - Missing token' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('❌ Invalid token');
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid token' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.error('❌ Non-admin access attempt by user:', user.id);
      return new Response(JSON.stringify({ error: 'Unauthorized - Admin access required' }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Admin verified:', user.email);

    const { csvData } = await req.json()
    
    if (!csvData || typeof csvData !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid CSV data provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('📊 Starting historical price import...')

    // Parse CSV data
    const lines = csvData.trim().split('\n')
    if (lines.length < 2) {
      return new Response(JSON.stringify({ error: 'CSV must have header and at least one data row' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const header = lines[0].toLowerCase()
    console.log('📊 CSV header:', header)

    // Validate CSV format - expect: ticker,date,close (minimum) plus optional OHLCV fields
    const headerColumns = header.split(',').map(col => col.trim())
    
    // Find column indices (flexible column order)
    const columnIndices = {
      ticker: -1,
      date: -1,
      open: -1,
      high: -1,
      low: -1,
      close: -1,
      adj_close: -1,
      volume: -1
    }

    for (let i = 0; i < headerColumns.length; i++) {
      const col = headerColumns[i].toLowerCase()
      if (col.includes('ticker') || col === 'symbol') columnIndices.ticker = i
      else if (col.includes('date')) columnIndices.date = i
      else if (col === 'open') columnIndices.open = i
      else if (col === 'high') columnIndices.high = i
      else if (col === 'low') columnIndices.low = i
      else if (col === 'close' && !col.includes('adj')) columnIndices.close = i
      else if (col.includes('adj') && col.includes('close')) columnIndices.adj_close = i
      else if (col.includes('volume')) columnIndices.volume = i
      else if (col.includes('price') && !col.includes('adj')) columnIndices.close = i
    }

    // Check if we found required columns (ticker, date, close are mandatory)
    const requiredColumns = ['ticker', 'date', 'close']
    const missingColumns = requiredColumns.filter(col => columnIndices[col] === -1)

    if (missingColumns.length > 0) {
      return new Response(JSON.stringify({ 
        error: `Missing required columns: ${missingColumns.join(', ')}. Expected: ticker, date, close. Optional: open, high, low, adj close, volume`,
        foundColumns: headerColumns
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('📊 Column mapping:', columnIndices)

    let processed = 0
    let inserted = 0
    let updated = 0
    let errors = 0
    const sample: any[] = []
    const batchSize = 100
    let batch: any[] = []

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i].trim()
        if (!line) continue

        // Simple CSV parsing (handles basic cases)
        const columns = line.split(',').map(col => col.trim().replace(/^"(.*)"$/, '$1'))
        
        if (columns.length < 3) {
          console.warn(`⚠️ Skipping malformed line ${i + 1}: ${line}`)
          errors++
          continue
        }

        const ticker = columns[columnIndices.ticker]?.toUpperCase()
        const dateStr = columns[columnIndices.date]
        const closeStr = columns[columnIndices.close]
        const openStr = columnIndices.open >= 0 ? columns[columnIndices.open] : null
        const highStr = columnIndices.high >= 0 ? columns[columnIndices.high] : null
        const lowStr = columnIndices.low >= 0 ? columns[columnIndices.low] : null
        const adjCloseStr = columnIndices.adj_close >= 0 ? columns[columnIndices.adj_close] : null
        const volumeStr = columnIndices.volume >= 0 ? columns[columnIndices.volume] : null

        if (!ticker || !dateStr || !closeStr) {
          console.warn(`⚠️ Skipping line ${i + 1} - missing required data: ${line}`)
          errors++
          continue
        }

        // Validate and parse date
        let date: string
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          date = dateStr // Already in YYYY-MM-DD format
        } else {
          // Try to parse other date formats
          const parsedDate = new Date(dateStr)
          if (isNaN(parsedDate.getTime())) {
            console.warn(`⚠️ Invalid date format on line ${i + 1}: ${dateStr}`)
            errors++
            continue
          }
          date = parsedDate.toISOString().slice(0, 10)
        }

        // Validate and parse prices
        const closePrice = parseFloat(closeStr)
        if (isNaN(closePrice) || closePrice <= 0) {
          console.warn(`⚠️ Invalid close price on line ${i + 1}: ${closeStr}`)
          errors++
          continue
        }

        // Parse optional fields
        const openPrice = openStr ? parseFloat(openStr) : null
        const highPrice = highStr ? parseFloat(highStr) : null
        const lowPrice = lowStr ? parseFloat(lowStr) : null
        const adjClose = adjCloseStr ? parseFloat(adjCloseStr) : null
        const volume = volumeStr ? parseInt(volumeStr) : null

        // Validate optional numeric fields
        if (openStr && (isNaN(openPrice) || openPrice <= 0)) {
          console.warn(`⚠️ Invalid open price on line ${i + 1}: ${openStr}`)
        }
        if (highStr && (isNaN(highPrice) || highPrice <= 0)) {
          console.warn(`⚠️ Invalid high price on line ${i + 1}: ${highStr}`)
        }
        if (lowStr && (isNaN(lowPrice) || lowPrice <= 0)) {
          console.warn(`⚠️ Invalid low price on line ${i + 1}: ${lowStr}`)
        }
        if (adjCloseStr && (isNaN(adjClose) || adjClose <= 0)) {
          console.warn(`⚠️ Invalid adjusted close on line ${i + 1}: ${adjCloseStr}`)
        }
        if (volumeStr && (isNaN(volume) || volume < 0)) {
          console.warn(`⚠️ Invalid volume on line ${i + 1}: ${volumeStr}`)
        }

        const record = {
          ticker,
          date,
          close_price: closePrice,
          open_price: openPrice && !isNaN(openPrice) && openPrice > 0 ? openPrice : null,
          high_price: highPrice && !isNaN(highPrice) && highPrice > 0 ? highPrice : null,
          low_price: lowPrice && !isNaN(lowPrice) && lowPrice > 0 ? lowPrice : null,
          volume: volume && !isNaN(volume) && volume >= 0 ? volume : null,
          adjusted_close: adjClose && !isNaN(adjClose) && adjClose > 0 ? adjClose : null
        }

        batch.push(record)
        processed++

        // Keep sample for response
        if (sample.length < 10) {
          sample.push({ ticker, date, close: closePrice })
        }

        // Process batch when it's full
        if (batch.length >= batchSize) {
          await processBatch(supabase, batch)
          inserted += batch.length
          batch = []
        }

      } catch (error) {
        console.error(`❌ Error processing line ${i + 1}:`, error)
        errors++
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      await processBatch(supabase, batch)
      inserted += batch.length
    }

    console.log(`✅ Historical price import complete:`)
    console.log(`   📊 Processed: ${processed}`)
    console.log(`   ✅ Inserted: ${inserted}`)
    console.log(`   ❌ Errors: ${errors}`)

    return new Response(JSON.stringify({
      success: true,
      processed,
      inserted,
      updated: 0, // We're using upsert, so technically all are inserts/updates
      errors,
      sample
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('💥 Historical price import error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to import historical prices',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function processBatch(supabase: any, batch: any[]) {
  const { error } = await supabase
    .from('historical_prices')
    .upsert(batch, { 
      onConflict: 'ticker,date',
      ignoreDuplicates: false 
    })

  if (error) {
    console.error('❌ Batch insert error:', error)
    throw error
  }

  console.log(`✅ Inserted batch of ${batch.length} records`)
}
