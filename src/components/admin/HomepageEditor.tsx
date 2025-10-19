import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, Edit2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface HomepageContent {
  hero_badge_text: string;
  hero_title: string;
  hero_description: string;
  hero_image_url: string;
  features_title: string;
  features_description: string;
}

export const HomepageEditor = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState<HomepageContent>({
    hero_badge_text: '',
    hero_title: '',
    hero_description: '',
    hero_image_url: '',
    features_title: '',
    features_description: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadHomepageContent();
  }, []);

  const loadHomepageContent = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('homepage_content')
        .select('content_key, content_value');
      
      if (error) throw error;
      
      const contentMap: any = {};
      data?.forEach(item => {
        contentMap[item.content_key] = item.content_value;
      });
      
      setContent(contentMap);
    } catch (error: any) {
      toast({
        title: 'Failed to load content',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveContent = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(content).map(([key, value]) => ({
        content_key: key,
        content_value: value,
        content_type: key.includes('image') ? 'image' : 'text'
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('homepage_content')
          .upsert(update, { onConflict: 'content_key' });
        
        if (error) throw error;
      }

      // Invalidate cache to force refresh
      await queryClient.invalidateQueries({ queryKey: ['homepage-content'] });

      toast({
        title: 'Content saved successfully',
        description: 'Homepage content has been updated'
      });
    } catch (error: any) {
      toast({
        title: 'Failed to save content',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Edit2 className="h-5 w-5" />
          Homepage Content Editor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hero Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Hero Section</h3>
          
          <div>
            <label className="block text-sm font-medium mb-1">Badge Text</label>
            <Input
              value={content.hero_badge_text}
              onChange={(e) => setContent({ ...content, hero_badge_text: e.target.value })}
              placeholder="Welcome to HillJump"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Main Title</label>
            <Input
              value={content.hero_title}
              onChange={(e) => setContent({ ...content, hero_title: e.target.value })}
              placeholder="Smart ETF Analysis for Income Investors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Textarea
              value={content.hero_description}
              onChange={(e) => setContent({ ...content, hero_description: e.target.value })}
              placeholder="Make informed investment decisions..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Hero Image URL</label>
            <Input
              value={content.hero_image_url}
              onChange={(e) => setContent({ ...content, hero_image_url: e.target.value })}
              placeholder="/lovable-uploads/hero-image.png"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Upload images by dragging them into the Lovable chat and asking me to copy them to the public folder, then update this URL field.
            </p>
          </div>
        </div>

        {/* Features Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Features Section</h3>
          
          <div>
            <label className="block text-sm font-medium mb-1">Features Title</label>
            <Input
              value={content.features_title}
              onChange={(e) => setContent({ ...content, features_title: e.target.value })}
              placeholder="Everything You Need for Smart Investing"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Features Description</label>
            <Textarea
              value={content.features_description}
              onChange={(e) => setContent({ ...content, features_description: e.target.value })}
              placeholder="Our platform combines cutting-edge analysis..."
              rows={3}
            />
          </div>
        </div>

        {/* Preview */}
        {content.hero_image_url && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Image Preview</label>
            <img
              src={content.hero_image_url}
              alt="Hero preview"
              className="w-full max-w-md h-48 object-cover rounded-lg border"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={saveContent} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="outline" onClick={loadHomepageContent}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};