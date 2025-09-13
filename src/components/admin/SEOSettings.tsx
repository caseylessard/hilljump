import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Globe, Save } from "lucide-react";

interface SEOSettings {
  site_title: string;
  site_description: string;
  favicon_url: string;
}

export const SEOSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SEOSettings>({
    site_title: '',
    site_description: '',
    favicon_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSEOSettings();
  }, []);

  const loadSEOSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('setting_key, setting_value');
      
      if (error) throw error;
      
      const settingsMap: any = {};
      data?.forEach(item => {
        settingsMap[item.setting_key] = item.setting_value;
      });
      
      setSettings(settingsMap);
    } catch (error: any) {
      toast({
        title: 'Failed to load SEO settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('site_settings')
          .upsert(update, { onConflict: 'setting_key' });
        
        if (error) throw error;
      }

      // Update document title and meta description immediately
      updatePageSEO();

      toast({
        title: 'SEO settings saved successfully',
        description: 'Site title and meta description have been updated'
      });
    } catch (error: any) {
      toast({
        title: 'Failed to save SEO settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePageSEO = () => {
    // Update document title
    if (settings.site_title) {
      document.title = settings.site_title;
    }

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (metaDescription && settings.site_description) {
      metaDescription.setAttribute('content', settings.site_description);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading SEO settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          SEO Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Site Title</label>
          <Input
            value={settings.site_title}
            onChange={(e) => setSettings({ ...settings, site_title: e.target.value })}
            placeholder="HillJump — Smart ETF Analysis & Income Investing"
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Appears in browser tab and search results (max 60 characters)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Site Description</label>
          <Textarea
            value={settings.site_description}
            onChange={(e) => setSettings({ ...settings, site_description: e.target.value })}
            placeholder="HillJump provides advanced ETF analysis tools, income-focused rankings, portfolio tracking, and market insights for smarter investing decisions."
            rows={3}
            maxLength={160}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Appears in search results and social media previews (max 160 characters)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Favicon URL</label>
          <Input
            value={settings.favicon_url}
            onChange={(e) => setSettings({ ...settings, favicon_url: e.target.value })}
            placeholder="/favicon.ico"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Upload favicon by dragging it into the Lovable chat and asking me to copy it to the public folder, then update this URL field.
          </p>
        </div>

        {/* Preview */}
        <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">Search Result Preview:</p>
          <div className="space-y-1">
            <div className="text-blue-600 text-sm hover:underline cursor-pointer">
              {settings.site_title || 'Your Site Title'}
            </div>
            <div className="text-green-600 text-xs">
              https://hilljump.com
            </div>
            <div className="text-gray-600 text-sm">
              {settings.site_description || 'Your site description will appear here...'}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save SEO Settings'}
          </Button>
          <Button variant="outline" onClick={loadSEOSettings}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};