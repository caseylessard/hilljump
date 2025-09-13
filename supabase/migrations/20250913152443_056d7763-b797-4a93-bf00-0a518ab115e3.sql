-- Create table for site settings (SEO settings like favicon, browser title)
CREATE TABLE public.site_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for editable homepage content  
CREATE TABLE public.homepage_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_key TEXT NOT NULL UNIQUE,
  content_value TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'image', 'html'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_content ENABLE ROW LEVEL SECURITY;

-- Create policies for site_settings table
CREATE POLICY "Site settings are publicly viewable" 
ON public.site_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage site settings" 
ON public.site_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create policies for homepage_content table
CREATE POLICY "Homepage content is publicly viewable" 
ON public.homepage_content 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage homepage content" 
ON public.homepage_content 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default values for homepage content
INSERT INTO public.homepage_content (content_key, content_value, content_type) VALUES
('hero_badge_text', 'Welcome to HillJump', 'text'),
('hero_title', 'Smart ETF Analysis for Income Investors', 'text'),
('hero_description', 'Make informed investment decisions with our comprehensive ETF rankings, real-time market data, and advanced portfolio analysis tools.', 'text'),
('hero_image_url', '/lovable-uploads/4dff6720-7418-49b2-a73f-7417a6feb921.png', 'image'),
('features_title', 'Everything You Need for Smart Investing', 'text'),
('features_description', 'Our platform combines cutting-edge analysis with intuitive tools to help you build a winning income portfolio.', 'text');

-- Insert default values for site settings
INSERT INTO public.site_settings (setting_key, setting_value) VALUES
('site_title', 'HillJump — Smart ETF Analysis & Income Investing'),
('site_description', 'HillJump provides advanced ETF analysis tools, income-focused rankings, portfolio tracking, and market insights for smarter investing decisions.'),
('favicon_url', '/favicon.ico');

-- Create triggers for updating timestamps
CREATE TRIGGER update_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_homepage_content_updated_at
BEFORE UPDATE ON public.homepage_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();