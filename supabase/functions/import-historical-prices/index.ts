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
    const { csvData } = await req.json()
    
    if (!csvData || typeof csvData !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid CSV data provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('📊 Starting historical price import...')

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

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

    // Validate CSV format - expect: ticker,date,close
    const expectedColumns = ['ticker', 'date', 'close']
    const headerColumns = header.split(',').map(col => col.trim())
    
    // Find column indices (flexible column order)
    const columnIndices = {
      ticker: -1,
      date: -1,
      close: -1
    }

    for (let i = 0; i < headerColumns.length; i++) {
      const col = headerColumns[i]
      if (col.includes('ticker') || col === 'symbol') columnIndices.ticker = i
      else if (col.includes('date')) columnIndices.date = i
      else if (col.includes('close') && !col.includes('adj')) columnIndices.close = i
      else if (col.includes('price')) columnIndices.close = i
    }

    // Check if we found all required columns
    const missingColumns = Object.entries(columnIndices)
      .filter(([_, index]) => index === -1)
      .map(([col, _]) => col)

    if (missingColumns.length > 0) {
      return new Response(JSON.stringify({ 
        error: `Missing required columns: ${missingColumns.join(', ')}. Expected: ticker, date, close (or price)`,
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

        if (!ticker || !dateStr || !closeStr) {
          console.warn(`⚠️ Skipping line ${i + 1} - missing data: ${line}`)
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

        // Validate and parse price
        const closePrice = parseFloat(closeStr)
        if (isNaN(closePrice) || closePrice <= 0) {
          console.warn(`⚠️ Invalid price on line ${i + 1}: ${closeStr}`)
          errors++
          continue
        }

        const record = {
          ticker,
          date,
          close_price: closePrice,
          open_price: null,
          high_price: null,
          low_price: null,
          volume: null,
          adjusted_close: null
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
