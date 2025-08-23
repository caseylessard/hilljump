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

    // Process each row
    for (let i = 0; i < dataRows.length; i++) {
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

        // Try to find matching ETF for etf_id
        const { data: etfMatch } = await supabase
          .from('etfs')
          .select('id')
          .eq('ticker', dividend.ticker)
          .limit(1)

        const dividendData = {
          ...dividend,
          etf_id: etfMatch?.[0]?.id || null
        }

        // Check for duplicate (same ticker, ex_date, amount)
        const { data: existing } = await supabase
          .from('dividends')
          .select('id')
          .eq('ticker', dividendData.ticker)
          .eq('ex_date', dividendData.ex_date)
          .eq('amount', dividendData.amount)
          .limit(1)

        if (existing && existing.length > 0) {
          // Skip duplicate
          continue
        }

        // Insert the dividend
        const { error: insertError } = await supabase
          .from('dividends')
          .insert(dividendData)

        if (insertError) {
          log(`Error inserting ${dividend.ticker} ${dividend.ex_date}: ${insertError.message}`)
          errorCount++
        } else {
          insertedCount++
          if (insertedCount % 100 === 0) {
            log(`Inserted ${insertedCount} dividends...`)
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