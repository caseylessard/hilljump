import { supabase } from "@/integrations/supabase/client";

export async function updateCanadianTickersWithoutPrices() {
  try {
    console.log('🇨🇦 Updating Canadian tickers without prices...');
    
    // Get Canadian tickers with null prices
    const { data: tickersNeedingUpdate, error } = await supabase
      .from('etfs')
      .select('ticker')
      .eq('country', 'CA')
      .is('current_price', null);
      
    if (error) throw error;
    
    if (tickersNeedingUpdate && tickersNeedingUpdate.length > 0) {
      const tickers = tickersNeedingUpdate.map(t => t.ticker);
      console.log(`Found ${tickers.length} Canadian tickers needing price updates:`, tickers);
      
      // Use the quotes function to fetch live prices
      const { data, error: quotesError } = await supabase.functions.invoke("quotes", {
        body: { tickers }
      });
      
      if (quotesError) throw quotesError;
      
      const prices = data?.prices || {};
      const updatedCount = Object.keys(prices).length;
      
      console.log(`✅ Successfully updated ${updatedCount} Canadian ticker prices`);
      return { success: true, updatedCount, tickers: Object.keys(prices) };
    } else {
      console.log('✅ All Canadian tickers already have prices');
      return { success: true, updatedCount: 0, tickers: [] };
    }
    
  } catch (error) {
    console.error('❌ Failed to update Canadian ticker prices:', error);
    return { success: false, error: error.message };
  }
}