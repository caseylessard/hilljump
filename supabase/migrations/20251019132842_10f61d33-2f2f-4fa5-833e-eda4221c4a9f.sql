-- Consolidate homepage_content SELECT policies
DROP POLICY IF EXISTS "Admins manage homepage content" ON public.homepage_content;
DROP POLICY IF EXISTS "Public read homepage content" ON public.homepage_content;

CREATE POLICY "Homepage content readable by all"
ON public.homepage_content
FOR SELECT
USING (true);

-- Consolidate options_cache SELECT policies  
DROP POLICY IF EXISTS "Public read options cache" ON public.options_cache;
DROP POLICY IF EXISTS "Service manages options cache" ON public.options_cache;

CREATE POLICY "Options cache readable by all"
ON public.options_cache
FOR SELECT
USING (true);

-- Consolidate site_settings SELECT policies
DROP POLICY IF EXISTS "Admins manage site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public read site settings" ON public.site_settings;

CREATE POLICY "Site settings readable by all"
ON public.site_settings
FOR SELECT
USING (true);