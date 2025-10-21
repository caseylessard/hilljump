import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { ticker } = await req.json();
    
    if (!ticker) {
      throw new Error('Ticker is required');
    }
    
    // Get API key from Supabase secrets
    const apiKey = Deno.env.get('EODHD_API_KEY');
    
    if (!apiKey) {
      throw new Error('EODHD_API_KEY not configured in Supabase');
    }

    console.log(`Fetching earnings for ${ticker}...`);
    
    // Fetch from EODHD API
    const url = `https://eodhd.com/api/fundamentals/${ticker}.US?api_token=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log(`✅ Successfully fetched earnings for ${ticker}`);
    
    // Return earnings data
    return new Response(
      JSON.stringify({ 
        ticker,
        earnings: data.Earnings || null 
      }), 
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in fetch-earnings-data:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred' 
      }), 
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 400,
      }
    );
  }
});
```

### Step 2: Set the API Key in Supabase

1. Go to your **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your **HillJump project**
3. Navigate to: **Project Settings** → **Edge Functions** (in the left sidebar)
4. Click **"Add secret"**
5. Add:
   - **Name:** `EODHD_API_KEY`
   - **Value:** `689cb5bd44e068.72742262`

### Step 3: Verify Deployment

After creating the file in Lovable:
- Lovable should **automatically deploy** the function
- Wait ~30 seconds for deployment to complete

### Step 4: Test Again

Run another **🧪 Test** scan and look for:

✅ **Success:**
```
📊 Enriching 4 signals...
✅ Successfully fetched earnings for AMD
✅ Successfully fetched earnings for NVDA
✅ Successfully enriched signals with earnings data