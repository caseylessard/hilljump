import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const log = (msg: string) => console.log(`[import-dividends] ${msg}`)

// Helper function to parse a single CSV line correctly
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current.trim());
  return result;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from auth header and verify admin role
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user has admin role
    const { data: hasAdminRole, error: roleError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' })

    if (roleError || !hasAdminRole) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request body
    const body = await req.json()
    const { csvData, replaceAll = false } = body

    if (!csvData) {
      return new Response(JSON.stringify({ error: 'No CSV data provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    log('Starting dividend data import...')

    // Parse CSV
    const lines = csvData.trim().split('\n')
    const headers = splitCSVLine(lines[0])
    const dataRows = lines.slice(1)

    log(`Processing ${dataRows.length} dividend records`)

    // If replaceAll is true, clear existing data
    if (replaceAll) {
      const { error: deleteError } = await supabase
        .from('dividends')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all records
      
      if (deleteError) {
        log(`Error clearing existing data: ${deleteError.message}`)
        return new Response(JSON.stringify({ error: `Failed to clear existing data: ${deleteError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      log('Cleared existing dividend data')
    }

    let insertedCount = 0
    let errorCount = 0
    const BATCH_SIZE = 100
    const processed = new Set<string>()

    // Get all ETFs upfront for ticker lookup
    const { data: allETFs } = await supabase
      .from('etfs')
      .select('id, ticker')
    
    const etfMap = new Map<string, string>()
    allETFs?.forEach(etf => etfMap.set(etf.ticker, etf.id))

    // Process rows in batches
    for (let batchStart = 0; batchStart < dataRows.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, dataRows.length)
      const batch: any[] = []
      
      log(`Processing batch ${Math.floor(batchStart/BATCH_SIZE) + 1}/${Math.ceil(dataRows.length/BATCH_SIZE)}...`)

      // Prepare batch records
      for (let i = batchStart; i < batchEnd; i++) {
        try {
          const row = splitCSVLine(dataRows[i])
          if (row.length !== headers.length) {
            log(`Row ${i + 1}: Column count mismatch. Expected ${headers.length}, got ${row.length}`)
            errorCount++
            continue
          }

          // Map CSV columns to database columns
          const dividend = {
            ticker: row[headers.indexOf('ticker')],
            ex_date: row[headers.indexOf('ex_date')],
            amount: parseFloat(row[headers.indexOf('amount')]) || 0,
            cash_currency: row[headers.indexOf('currency')] || 'USD',
            cadence: row[headers.indexOf('cadence')] || null,
            created_at: new Date().toISOString()
          }

          // Validate required fields
          if (!dividend.ticker || !dividend.ex_date || dividend.amount <= 0) {
            log(`Row ${i + 1}: Missing required fields (ticker: ${dividend.ticker}, ex_date: ${dividend.ex_date}, amount: ${dividend.amount})`)
            errorCount++
            continue
          }

          // Create unique key for deduplication
          const uniqueKey = `${dividend.ticker}-${dividend.ex_date}-${dividend.amount}`
          if (processed.has(uniqueKey)) {
            continue // Skip duplicate
          }
          processed.add(uniqueKey)

          // Add etf_id from lookup map
          const dividendData = {
            ...dividend,
            etf_id: etfMap.get(dividend.ticker) || null
          }

          batch.push(dividendData)

        } catch (error) {
          log(`Error processing row ${i + 1}: ${error.message}`)
          errorCount++
        }
      }

      // Insert batch if not empty
      if (batch.length > 0) {
        const { data, error: insertError } = await supabase
          .from('dividends')
          .insert(batch)
          .select('id')

        if (insertError) {
          log(`Batch insert error: ${insertError.message}`)
          errorCount += batch.length
        } else {
          insertedCount += batch.length
          log(`Inserted ${insertedCount} dividends so far...`)
        }
      }
    }

    log(`Import completed: ${insertedCount} inserted, ${errorCount} errors`)

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully imported dividend data: ${insertedCount} records inserted, ${errorCount} errors`,
      inserted: insertedCount,
      errors: errorCount
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    log(`Unexpected error: ${error.message}`)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})