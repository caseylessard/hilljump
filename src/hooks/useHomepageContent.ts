import { useState, useEffect } from "react";
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
  hero_image_url: '/lovable-uploads/4dff6720-7418-49b2-a73f-7417a6feb921.png',
  features_title: 'Everything You Need for Smart Investing',
  features_description: 'Our platform combines cutting-edge analysis with intuitive tools to help you build a winning income portfolio.'
};

export const useHomepageContent = () => {
  const [content, setContent] = useState<HomepageContent>(defaultContent);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async (forceRefresh = false) => {
    try {
      console.log(`🔄 Loading homepage content ${forceRefresh ? '(forced refresh)' : ''}`);
      
      const { data, error } = await supabase
        .from('homepage_content')
        .select('content_key, content_value');
      
      if (error) {
        console.error('Error loading homepage content:', error);
        setLoading(false);
        return;
      }
      
      const contentMap: any = { ...defaultContent };
      data?.forEach(item => {
        contentMap[item.content_key] = item.content_value;
      });
      
      console.log('✅ Homepage content loaded:', Object.keys(contentMap));
      setContent(contentMap);
    } catch (error) {
      console.error('Error loading homepage content:', error);
    } finally {
      setLoading(false);
    }
  };

  const forceRefresh = () => loadContent(true);

  return { content, loading, refresh: loadContent, forceRefresh };
};