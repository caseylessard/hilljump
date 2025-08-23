import { supabase } from "@/integrations/supabase/client";

export async function updateCanadianPrices(): Promise<{
  success: boolean;
  message: string;
  results?: any;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('update-canadian-prices');
    
    if (error) {
      throw new Error(error.message);
    }
    
    console.log('Canadian prices updated:', data);
    return {
      success: true,
      message: data.message || 'Canadian prices updated successfully',
      results: data
    };
    
  } catch (error) {
    console.error('Failed to update Canadian prices:', error);
    return {
      success: false,
      message: `Failed to update Canadian prices: ${error.message}`
    };
  }
}