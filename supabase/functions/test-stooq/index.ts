import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function testStooqFormat(symbol: string): Promise<any> {
  const formats = [
    symbol.toLowerCase(),
    symbol.toUpperCase(),
    symbol.toLowerCase().replace('.to', ''),
    symbol.toLowerCase().replace('.to', '.wa'),
    symbol.toLowerCase() + '.us'
  ];
  
  const results: any[] = [];
  
  for (const format of formats) {
    try {
      const url = `https://stooq.com/q/l/?s=${encodeURIComponent(format)}&f=sd2t2ohlcv&h&e=csv`;
      const res = await fetch(url);
      const csv = await res.text();
      const lines = csv.trim().split("\n");
      
      let price = null;
      if (lines.length >= 2) {
        const headers = lines[0].split(",");
        const values = lines[1].split(",");
        const iClose = headers.findIndex((h) => h.toLowerCase() === "close");
        if (iClose !== -1) {
          const close = parseFloat(values[iClose]);
          if (Number.isFinite(close)) {
            price = close;
          }
        }
      }
      
      results.push({
        format,
        url,
        price,
        csvLines: lines.length,
        success: price !== null
      });
    } catch (err) {
      results.push({
        format,
        error: err.message,
        success: false
      });
    }
  }
  
  return results;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { symbol } = await req.json();
    if (!symbol) throw new Error("symbol is required");
    
    console.log(`Testing Stooq formats for: ${symbol}`);
    const results = await testStooqFormat(symbol);
    
    console.log(`Test results for ${symbol}:`, JSON.stringify(results, null, 2));
    
    return new Response(JSON.stringify({ symbol, results }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
    
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});