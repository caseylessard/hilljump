import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface HomepageContent {
  hero_badge_text: string;
  hero_title: string;
  hero_description: string;
  hero_image_url: string;
  features_title: string;
  features_description: string;
}

const defaultContent: HomepageContent = {
  hero_badge_text: 'Welcome to HillJump',
  hero_title: 'Smart ETF Analysis for Income Investors',
  hero_description: 'Make informed investment decisions with our comprehensive ETF rankings, real-time market data, and advanced portfolio analysis tools.',
  hero_image_url: '/lovable-uploads/hilljumpbanner.png',
  features_title: 'Everything You Need for Smart Investing',
  features_description: 'Our platform combines cutting-edge analysis with intuitive tools to help you build a winning income portfolio.'
};

export const useHomepageContent = () => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['homepage-content'],
    queryFn: async () => {
      console.log('🔄 Loading homepage content from database');
      
      const { data, error } = await supabase
        .from('homepage_content')
        .select('content_key, content_value');
      
      if (error) {
        console.error('Error loading homepage content:', error);
        throw error;
      }
      
      const contentMap: HomepageContent = { ...defaultContent };
      data?.forEach(item => {
        contentMap[item.content_key as keyof HomepageContent] = item.content_value;
      });
      
      console.log('✅ Homepage content loaded:', Object.keys(contentMap));
      return contentMap;
    },
    staleTime: 1000 * 60 * 60, // 1 hour - content rarely changes
    gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep in cache
    initialData: defaultContent, // Start with defaults for instant render
  });

  return { 
    content: data || defaultContent, 
    loading: isLoading, 
    refresh: refetch,
    forceRefresh: refetch 
  };
};