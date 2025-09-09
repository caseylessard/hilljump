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

// Fetch comprehensive ETF metadata from Yahoo Finance
async function fetchYahooETFMetadata(ticker: string): Promise<Partial<ETFMetadata>> {
  try {
    console.log(`📊 Fetching metadata for ${ticker} from Yahoo Finance`);
    
    // Get comprehensive ETF data including fund profile
    const quoteUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=assetProfile,fundProfile,summaryProfile,topHoldings,defaultKeyStatistics,price`;
    const response = await fetch(quoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.warn(`Yahoo Finance failed for ${ticker}: ${response.status}`);
      return {};
    }
    
    const data = await response.json();
    const result = data?.quoteSummary?.result?.[0];
    
    if (!result) return {};
    
    const assetProfile = result.assetProfile;
    const fundProfile = result.fundProfile;
    const summaryProfile = result.summaryProfile;
    const keyStats = result.defaultKeyStatistics;
    const price = result.price;
    
    // Extract and clean the data
    const metadata: Partial<ETFMetadata> = { ticker };
    
    // Basic info
    if (price?.shortName) metadata.name = price.shortName;
    if (price?.longName && !metadata.name) metadata.name = price.longName;
    
    // Fund profile data
    if (fundProfile) {
      if (fundProfile.categoryName) metadata.category = fundProfile.categoryName;
      if (fundProfile.fundFamily) metadata.manager = fundProfile.fundFamily;
      if (fundProfile.legalType) metadata.fund = fundProfile.legalType;
    }
    
    // Asset profile (more detailed for some ETFs)
    if (assetProfile) {
      if (assetProfile.longBusinessSummary) {
        metadata.summary = assetProfile.longBusinessSummary.slice(0, 500); // Limit length
      }
      if (assetProfile.industry) metadata.industry = assetProfile.industry;
      if (assetProfile.sector && !metadata.category) metadata.category = assetProfile.sector;
    }
    
    // Summary profile
    if (summaryProfile?.longBusinessSummary && !metadata.summary) {
      metadata.summary = summaryProfile.longBusinessSummary.slice(0, 500);
    }
    
    // Key statistics for AUM
    if (keyStats?.totalAssets?.raw) {
      metadata.aum = keyStats.totalAssets.raw;
    }
    
    // Infer provider from ticker patterns and fund family
    if (metadata.manager) {
      const manager = metadata.manager.toLowerCase();
      if (manager.includes('vanguard')) metadata.provider_group = 'Vanguard';
      else if (manager.includes('ishares') || manager.includes('blackrock')) metadata.provider_group = 'iShares';
      else if (manager.includes('spdr') || manager.includes('state street')) metadata.provider_group = 'SPDR';
      else if (manager.includes('invesco')) metadata.provider_group = 'Invesco';
      else if (manager.includes('schwab')) metadata.provider_group = 'Schwab';
      else if (manager.includes('fidelity')) metadata.provider_group = 'Fidelity';
      else if (manager.includes('direxion')) metadata.provider_group = 'Direxion';
      else if (manager.includes('proshares')) metadata.provider_group = 'ProShares';
    }
    
    // Try to infer strategy from name and category
    if (metadata.name && metadata.category) {
      const name = metadata.name.toLowerCase();
      const category = metadata.category.toLowerCase();
      
      if (name.includes('dividend') || category.includes('dividend')) {
        metadata.strategy = 'Dividend Focused';
      } else if (name.includes('growth') || category.includes('growth')) {
        metadata.strategy = 'Growth';
      } else if (name.includes('value') || category.includes('value')) {
        metadata.strategy = 'Value';
      } else if (name.includes('sector') || name.includes('technology') || name.includes('healthcare')) {
        metadata.strategy = 'Sector/Thematic';
      } else if (name.includes('international') || name.includes('emerging')) {
        metadata.strategy = 'International';
      } else if (name.includes('bond') || name.includes('fixed')) {
        metadata.strategy = 'Fixed Income';
      } else if (name.includes('commodity') || name.includes('gold') || name.includes('oil')) {
        metadata.strategy = 'Commodity';
      } else {
        metadata.strategy = 'Broad Market';
      }
    }
    
    console.log(`✅ Metadata found for ${ticker}:`, {
      name: metadata.name,
      category: metadata.category,
      manager: metadata.manager,
      strategy: metadata.strategy,
      hasSummary: !!metadata.summary
    });
    
    return metadata;
    
  } catch (error) {
    console.error(`Error fetching metadata for ${ticker}:`, error);
    return {};
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
          // Start with Yahoo Finance
          let metadata = await fetchYahooETFMetadata(etf.ticker);
          
          // If still missing key data, try Alpha Vantage
          if (alphaVantageKey && (!metadata.name || !metadata.category)) {
            const alphaData = await fetchAlphaVantageMetadata(etf.ticker, alphaVantageKey);
            metadata = { ...alphaData, ...metadata }; // Yahoo takes precedence
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