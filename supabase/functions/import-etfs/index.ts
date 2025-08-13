import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, details?: unknown) => console.log(`[IMPORT-ETFS] ${msg}`, details ?? "");

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((s) => s.replace(/^\"|\"$/g, ''));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) throw new Error(`Auth error: ${userErr.message}`);
    const user = userData.user;
    if (!user) throw new Error('No user');

    // Verify admin role
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = Array.isArray(roles) && roles.some((r: any) => String(r.role).toLowerCase() === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const csv: string = body.csv || '';
    if (!csv.trim()) throw new Error('No CSV provided');

    const lines = csv.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
    if (lines.length < 2) throw new Error('CSV has no data');

    const headers = splitCSVLine(lines[0]).map((h) => h.trim());
    const rows = lines.slice(1).map((ln) => splitCSVLine(ln));

    const idx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());

    let inserted = 0;
    let updated = 0;

    for (const row of rows) {
      const get = (name: string) => {
        const i = idx(name);
        return i >= 0 ? row[i] : '';
      };
      const parseNum = (v: string) => {
        const s = (v ?? '').trim();
        if (!s) return null;
        const n = Number(s.replace(/[, ]/g, ''));
        return Number.isFinite(n) ? n : null;
      };

      const ticker = (get('ticker') || '').toUpperCase().trim();
      if (!ticker) continue;

      const etf: Record<string, any> = {
        ticker,
        name: (get('name') || '').trim() || null,
        exchange: (get('exchange') || '').trim() || null,
        category: (get('category') || '').trim() || null,
        yield_ttm: parseNum(get('yield_ttm')),
        total_return_1y: parseNum(get('total_return_1y')),
        avg_volume: parseNum(get('avg_volume')),
        expense_ratio: parseNum(get('expense_ratio')),
        volatility_1y: parseNum(get('volatility_1y')),
        max_drawdown_1y: parseNum(get('max_drawdown_1y')),
        aum: parseNum(get('aum')),
        manager: (get('manager') || '').trim() || null,
        strategy_label: (get('strategy_label') || '').trim() || null,
        logo_key: (get('logo_key') || '').trim() || null,
        country: (get('country') || '').trim() || null,
      };

      // Determine if exists
      const { data: existing } = await supabase
        .from('etfs')
        .select('id')
        .eq('ticker', ticker)
        .maybeSingle();

      if (existing?.id) {
        const { error: upErr } = await supabase.from('etfs').update(etf).eq('id', existing.id);
        if (upErr) throw upErr;
        updated++;
      } else {
        const { error: inErr } = await supabase.from('etfs').insert(etf);
        if (inErr) throw inErr;
        inserted++;
      }
    }

    log('Import finished', { inserted, updated });
    return new Response(JSON.stringify({ inserted, updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('ERROR', msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
