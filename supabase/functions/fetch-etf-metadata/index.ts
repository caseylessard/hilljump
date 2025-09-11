import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ETFMetadata {
  ticker: string;
  name?: string;
  category?: string;
  summary?: string;
  manager?: string;
  strategy?: string;
  industry?: string;
  aum?: number;
  distribution_frequency?: string;
  provider_group?: string;
  underlying?: string;
  fund?: string;
}

// Fetch comprehensive ETF metadata from EODHD
async function fetchEODHDETFMetadata(ticker: string, apiKey: string): Promise<Partial<ETFMetadata>> {
  try {
    console.log(`📊 Fetching metadata for ${ticker} from EODHD`);
    
    // Format ticker for EODHD
    const eodhTicker = ticker.includes('.TO') 
      ? ticker.replace('.TO', '.TSE') 
      : ticker.includes('.') 
        ? ticker 
        : `${ticker}.US`;

    const result: Partial<ETFMetadata> = { ticker };
    
    // Get comprehensive ETF fundamentals
    const fundUrl = `https://eodhd.com/api/fundamentals/${eodhTicker}?api_token=${apiKey}`;
    const response = await fetch(fundUrl);
    
    if (!response.ok) {
      console.warn(`EODHD failed for ${ticker}: ${response.status}`);
      return result;
    }
    
    const data = await response.json();
    
    // Extract ETF metadata from EODHD response
    const general = data?.General;
    const highlights = data?.Highlights;
    
    if (general) {
      result.name = general.Name;
      result.category = general.Category;
      result.summary = general.Description;
      result.manager = general.Company;
      result.industry = general.Sector;
      
      // Parse provider from company name or ticker patterns
      if (general.Company) {
        const company = general.Company.toLowerCase();
        if (company.includes('ishares') || company.includes('blackrock')) {
          result.provider_group = 'BlackRock';
        } else if (company.includes('vanguard')) {
          result.provider_group = 'Vanguard';
        } else if (company.includes('spdr') || company.includes('state street')) {
          result.provider_group = 'State Street';
        } else if (company.includes('invesco')) {
          result.provider_group = 'Invesco';
        } else {
          result.provider_group = general.Company;
        }
      }
    }
    
    if (highlights) {
      if (highlights.SharesOutstanding && highlights.MarketCapitalization) {
        result.aum = highlights.MarketCapitalization * 1000000; // Convert to actual value
      }
    }

    console.log(`✅ EODHD metadata for ${ticker}:`, {
      name: result.name,
      category: result.category,
      manager: result.manager,
      aum: result.aum
    });

    return result;

  } catch (error) {
    console.error(`Error fetching EODHD metadata for ${ticker}:`, error);
    return { ticker };
  }
}

// Fetch ETF metadata from Yahoo Finance
async function fetchYahooETFMetadata(ticker: string): Promise<Partial<ETFMetadata>> {
  try {
    console.log(`📊 Fetching Yahoo metadata for ${ticker}`);
    
    // This would be implemented if Yahoo Finance API was available
    // For now, return empty metadata
    return { ticker };
    
  } catch (error) {
    console.error(`Error fetching Yahoo metadata for ${ticker}:`, error);
    return { ticker };
  }
}

// Fallback to Alpha Vantage for additional data
async function fetchAlphaVantageMetadata(ticker: string, apiKey: string): Promise<Partial<ETFMetadata>> {
  try {
    console.log(`📊 Fetching Alpha Vantage metadata for ${ticker}`);
    
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.Symbol && !data.Note && !data.Information) {
      const metadata: Partial<ETFMetadata> = { ticker };
      
      if (data.Name) metadata.name = data.Name;
      if (data.Description) metadata.summary = data.Description.slice(0, 500);
      if (data.Sector) metadata.category = data.Sector;
      if (data.Industry) metadata.industry = data.Industry;
      if (data.AssetType) metadata.fund = data.AssetType;
      
      return metadata;
    }
    
    return {};
  } catch (error) {
    console.error(`Alpha Vantage error for ${ticker}:`, error);
    return {};
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting ETF metadata collection');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const alphaVantageKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get ETFs that need metadata (missing name, category, or summary)
    console.log('📊 Finding ETFs that need metadata');
    const { data: etfs, error: etfError } = await supabase
      .from('etfs')
      .select('id, ticker, name, category, summary, manager')
      .eq('active', true)
      .or('name.is.null,category.is.null,summary.is.null,manager.is.null')
      .order('ticker')
      .limit(50); // Process in reasonable batches

    if (etfError) {
      throw new Error(`Failed to fetch ETFs: ${etfError.message}`);
    }

    console.log(`📈 Found ${etfs?.length || 0} ETFs needing metadata`);

    if (!etfs || etfs.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'All ETFs have complete metadata',
          updated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalUpdated = 0;
    const batchSize = 3; // Small batches to respect rate limits

    // Process ETFs in batches
    for (let i = 0; i < etfs.length; i += batchSize) {
      const batch = etfs.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(etfs.length / batchSize)}`);

      const updatePromises = batch.map(async (etf) => {
        try {
          // Start with EODHD
          const eodhApiKey = Deno.env.get('EODHD_API_KEY');
          let metadata = {};
          
          if (eodhApiKey) {
            metadata = await fetchEODHDETFMetadata(etf.ticker, eodhApiKey);
          }
          
          // If still missing key data, try Alpha Vantage
          if (alphaVantageKey && (!metadata.name || !metadata.category)) {
            const alphaData = await fetchAlphaVantageMetadata(etf.ticker, alphaVantageKey);
            metadata = { ...alphaData, ...metadata }; // EODHD takes precedence
          }
          
          // Only update if we found new data
          const hasNewData = Object.keys(metadata).length > 1 && (
            (metadata.name && metadata.name !== etf.name) ||
            (metadata.category && metadata.category !== etf.category) ||
            (metadata.summary && metadata.summary !== etf.summary) ||
            (metadata.manager && metadata.manager !== etf.manager)
          );
          
          if (hasNewData) {
            const updateData: any = {};
            
            if (metadata.name) updateData.name = metadata.name;
            if (metadata.category) updateData.category = metadata.category;
            if (metadata.summary) updateData.summary = metadata.summary;
            if (metadata.manager) updateData.manager = metadata.manager;
            if (metadata.strategy) updateData.strategy = metadata.strategy;
            if (metadata.industry) updateData.industry = metadata.industry;
            if (metadata.aum) updateData.aum = metadata.aum;
            if (metadata.provider_group) updateData.provider_group = metadata.provider_group;
            if (metadata.underlying) updateData.underlying = metadata.underlying;
            if (metadata.fund) updateData.fund = metadata.fund;
            
            updateData.updated_at = new Date().toISOString();

            const { error: updateError } = await supabase
              .from('etfs')
              .update(updateData)
              .eq('id', etf.id);

            if (updateError) {
              console.error(`❌ Failed to update ${etf.ticker}:`, updateError);
              return false;
            }

            console.log(`✅ Updated metadata for ${etf.ticker}`, Object.keys(updateData));
            return true;
          }
          
          console.log(`ℹ️ No new metadata found for ${etf.ticker}`);
          return false;
        } catch (error) {
          console.error(`❌ Error processing ${etf.ticker}:`, error);
          return false;
        }
      });

      const batchResults = await Promise.all(updatePromises);
      totalUpdated += batchResults.filter(Boolean).length;

      // Rate limiting delay between batches
      if (i + batchSize < etfs.length) {
        console.log('⏸️ Pausing between batches...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const result = {
      success: true,
      message: 'ETF metadata collection completed',
      timestamp: new Date().toISOString(),
      summary: {
        totalChecked: etfs.length,
        metadataUpdated: totalUpdated,
        skipped: etfs.length - totalUpdated
      }
    };

    console.log('🎉 ETF metadata collection completed');
    console.log(`📊 Updated: ${totalUpdated}/${etfs.length} ETFs`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in ETF metadata fetcher:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});