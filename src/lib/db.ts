// Database utilities - fetch ETFs from Supabase
import { supabase } from "@/integrations/supabase/client";

export const getETFs = async () => {
  console.log('📊 Fetching ETFs from database...');
  
  try {
    const { data, error } = await supabase
      .from('etfs')
      .select('*')
      .eq('active', true)
      .order('ticker', { ascending: true });
    
    if (error) {
      console.error('❌ Error fetching ETFs:', error);
      throw error;
    }
    
    console.log('✅ Fetched', data?.length || 0, 'ETFs from database');
    return data || [];
  } catch (error) {
    console.error('❌ Failed to fetch ETFs:', error);
    return [];
  }
};

export const updateETFData = async (data: any) => {
  return { success: true };
};