import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SEOSettings {
  site_title: string;
  site_description: string;
  favicon_url: string;
}

const defaultSettings: SEOSettings = {
  site_title: 'HillJump — Smart ETF Analysis & Income Investing',
  site_description: 'HillJump provides advanced ETF analysis tools, income-focused rankings, portfolio tracking, and market insights for smarter investing decisions.',
  favicon_url: '/favicon.ico'
};

export const useSEOSettings = () => {
  const [settings, setSettings] = useState<SEOSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('setting_key, setting_value');
      
      if (error) {
        console.error('Error loading SEO settings:', error);
        setLoading(false);
        return;
      }
      
      const settingsMap: any = { ...defaultSettings };
      data?.forEach(item => {
        settingsMap[item.setting_key] = item.setting_value;
      });
      
      setSettings(settingsMap);
      
      // Update document head with loaded settings
      updateDocumentSEO(settingsMap);
    } catch (error) {
      console.error('Error loading SEO settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDocumentSEO = (seoSettings: SEOSettings) => {
    // Update document title
    document.title = seoSettings.site_title;

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (metaDescription) {
      metaDescription.setAttribute('content', seoSettings.site_description);
    } else {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      meta.setAttribute('content', seoSettings.site_description);
      document.head.appendChild(meta);
    }

    // Update favicon
    let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (favicon) {
      favicon.setAttribute('href', seoSettings.favicon_url);
    } else {
      favicon = document.createElement('link');
      favicon.setAttribute('rel', 'icon');
      favicon.setAttribute('href', seoSettings.favicon_url);
      document.head.appendChild(favicon);
    }
  };

  return { settings, loading, refresh: loadSettings };
};