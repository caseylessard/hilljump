import { supabase } from "@/integrations/supabase/client";

export async function updateCanadianPrices(): Promise<{
  success: boolean;
  message: string;
  results?: any;
}> {
  try {
    console.log('🇨🇦 Calling update-canadian-prices function...');
    const { data, error } = await supabase.functions.invoke('update-canadian-prices');
    
    if (error) {
      console.error('❌ Function invocation error:', error);
      throw new Error(error.message);
    }
    
    console.log('✅ Canadian prices response:', data);
    return {
      success: data?.success !== false,
      message: data?.message || 'Canadian prices updated successfully',
      results: data
    };
    
  } catch (error) {
    console.error('❌ Failed to update Canadian prices:', error);
    return {
      success: false,
      message: `Failed to update Canadian prices: ${error.message}`
    };
  }
}