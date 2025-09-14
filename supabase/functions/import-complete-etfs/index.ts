import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const log = (msg: string) => console.log(`[import-complete-etfs] ${msg}`)

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
    const csvData = body.csvData

    if (!csvData) {
      return new Response(JSON.stringify({ error: 'No CSV data provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    log('Starting complete ETF data replacement...')

    // Parse CSV
    const lines = csvData.trim().split('\n')
    const headers = splitCSVLine(lines[0])
    const dataRows = lines.slice(1)

    log(`Found ${headers.length} columns in header: [${headers.join(', ')}]`)
    log(`Processing ${dataRows.length} ETF records`)
    
    // Debug: show first few rows structure
    for (let i = 0; i < Math.min(3, dataRows.length); i++) {
      const row = splitCSVLine(dataRows[i])
      log(`Row ${i + 1} sample: ${row.length} columns - [${row.slice(0, 3).join(', ')}...]`)
    }

    // First, clear all existing data
    const { error: deleteError } = await supabase
      .from('etfs')
      .delete()
      .neq('ticker', 'NONEXISTENT') // Delete all records

    if (deleteError) {
      log(`Error clearing existing data: ${deleteError.message}`)
      return new Response(JSON.stringify({ error: `Failed to clear existing data: ${deleteError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    log('Cleared existing ETF data')

    let insertedCount = 0
    let errorCount = 0

    // Process each row
    for (let i = 0; i < dataRows.length; i++) {
      try {
        const row = splitCSVLine(dataRows[i])
        if (row.length !== headers.length) {
          log(`Row ${i + 1}: Column count mismatch. Expected ${headers.length}, got ${row.length}`)
          errorCount++
          continue
        }

        // Get column indices (case-insensitive)
        const getColumnIndex = (columnName: string) => {
          const index = headers.findIndex(h => h.toLowerCase().trim() === columnName.toLowerCase())
          return index >= 0 ? index : -1
        }

        const tickerIndex = getColumnIndex('ticker')
        const fundIndex = getColumnIndex('fund')
        const exchangeIndex = getColumnIndex('exchange')
        
        // Validate required fields
        if (tickerIndex === -1) {
          log(`Row ${i + 1}: Missing required 'ticker' column`)
          errorCount++
          continue
        }

        const ticker = row[tickerIndex]?.trim()
        if (!ticker) {
          log(`Row ${i + 1}: Empty ticker value`)
          errorCount++
          continue
        }

        // Map CSV columns to database columns
        const etf = {
          ticker: ticker,
          provider_group: row[getColumnIndex('provider')] || null,
          manager: row[getColumnIndex('manager')] || null,
          exchange: row[getColumnIndex('exchange')] || 'US', // Default to US if missing
          country: row[getColumnIndex('country')] || null,
          currency: row[getColumnIndex('currency')] || 'USD',
          underlying: row[getColumnIndex('underlying')] || null,
          active: row[getColumnIndex('active')] === '1' || row[getColumnIndex('active')]?.toLowerCase() === 'true',
          name: row[fundIndex] || ticker, // Use fund as name, fallback to ticker
          fund: row[fundIndex] || null,
          strategy: row[getColumnIndex('strategy')] || null,
          industry: row[getColumnIndex('industry')] || null,
          // Set default values for required fields
          expense_ratio: 0.01, // Default 1%
          volatility_1y: 15, // Default 15%
          max_drawdown_1y: -10 // Default -10%
        }

        // Insert the ETF
        const { error: insertError } = await supabase
          .from('etfs')
          .insert(etf)

        if (insertError) {
          log(`Error inserting ${etf.ticker}: ${insertError.message}`)
          errorCount++
        } else {
          insertedCount++
          if (insertedCount % 10 === 0) {
            log(`Inserted ${insertedCount} ETFs...`)
          }
        }

      } catch (error) {
        log(`Error processing row ${i + 1}: ${error.message}`)
        errorCount++
      }
    }

    log(`Import completed: ${insertedCount} inserted, ${errorCount} errors`)

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully replaced ETF data: ${insertedCount} records inserted, ${errorCount} errors`,
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