-- Consolidate multiple permissive RLS policies for optimal performance
-- Each table/role/action should have only ONE policy

-- ==============================================
-- PUBLIC DATA TABLES (readable by everyone)
-- ==============================================

-- Crypto Universe: consolidate public + service into single policy
DROP POLICY IF EXISTS "Crypto universe readable" ON public.crypto_universe;
DROP POLICY IF EXISTS "Service can manage crypto universe" ON public.crypto_universe;

CREATE POLICY "Public read, service write crypto universe" ON public.crypto_universe
FOR ALL USING (true) WITH CHECK (true);

-- Dividend Source Logs
DROP POLICY IF EXISTS "Dividend source logs readable" ON public.dividend_source_logs;
DROP POLICY IF EXISTS "Service can manage dividend source logs" ON public.dividend_source_logs;

CREATE POLICY "Public read, service write dividend logs" ON public.dividend_source_logs
FOR ALL USING (true) WITH CHECK (true);

-- DRIP Cache CA
DROP POLICY IF EXISTS "DRIP cache CA readable" ON public.drip_cache_ca;
DROP POLICY IF EXISTS "Service can manage DRIP cache CA" ON public.drip_cache_ca;

CREATE POLICY "Public read, service write DRIP CA" ON public.drip_cache_ca
FOR ALL USING (true) WITH CHECK (true);

-- DRIP Cache US
DROP POLICY IF EXISTS "DRIP cache US readable" ON public.drip_cache_us;
DROP POLICY IF EXISTS "Service can manage DRIP cache US" ON public.drip_cache_us;

CREATE POLICY "Public read, service write DRIP US" ON public.drip_cache_us
FOR ALL USING (true) WITH CHECK (true);

-- Equity Universe
DROP POLICY IF EXISTS "Equity universe readable" ON public.equity_universe;
DROP POLICY IF EXISTS "Service can manage equity universe" ON public.equity_universe;

CREATE POLICY "Public read, service write equity universe" ON public.equity_universe
FOR ALL USING (true) WITH CHECK (true);

-- ETF Rankings
DROP POLICY IF EXISTS "Rankings readable" ON public.etf_rankings;
DROP POLICY IF EXISTS "Service can manage rankings" ON public.etf_rankings;

CREATE POLICY "Public read, service write rankings" ON public.etf_rankings
FOR ALL USING (true) WITH CHECK (true);

-- ETF Scores
DROP POLICY IF EXISTS "ETF scores readable" ON public.etf_scores;
DROP POLICY IF EXISTS "Service can manage ETF scores" ON public.etf_scores;

CREATE POLICY "Public read, service write scores" ON public.etf_scores
FOR ALL USING (true) WITH CHECK (true);

-- Historical Prices
DROP POLICY IF EXISTS "Historical prices readable" ON public.historical_prices;
DROP POLICY IF EXISTS "Service can manage historical prices" ON public.historical_prices;

CREATE POLICY "Public read, service write prices" ON public.historical_prices
FOR ALL USING (true) WITH CHECK (true);

-- Homepage Content
DROP POLICY IF EXISTS "Homepage content is publicly viewable" ON public.homepage_content;
DROP POLICY IF EXISTS "Admins can manage homepage content" ON public.homepage_content;

CREATE POLICY "Public read homepage content" ON public.homepage_content
FOR SELECT USING (true);

CREATE POLICY "Admins manage homepage content" ON public.homepage_content
FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- Options Cache
DROP POLICY IF EXISTS "Public read access to options cache" ON public.options_cache;
DROP POLICY IF EXISTS "Service role can manage cache" ON public.options_cache;

CREATE POLICY "Public read options cache" ON public.options_cache
FOR SELECT USING (true);

CREATE POLICY "Service manages options cache" ON public.options_cache
FOR ALL USING ((select auth.role()) = 'service_role'::text);

-- Price Cache
DROP POLICY IF EXISTS "Price cache is publicly viewable" ON public.price_cache;
DROP POLICY IF EXISTS "Service can manage price cache" ON public.price_cache;

CREATE POLICY "Public read, service write price cache" ON public.price_cache
FOR ALL USING (true) WITH CHECK (true);

-- Site Settings
DROP POLICY IF EXISTS "Site settings are publicly viewable" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;

CREATE POLICY "Public read site settings" ON public.site_settings
FOR SELECT USING (true);

CREATE POLICY "Admins manage site settings" ON public.site_settings
FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- ==============================================
-- ETFs TABLE (admin OR service can write)
-- ==============================================

DROP POLICY IF EXISTS "Admins can insert ETF data" ON public.etfs;
DROP POLICY IF EXISTS "Service role can insert ETF data" ON public.etfs;
DROP POLICY IF EXISTS "Admins can update ETF data" ON public.etfs;
DROP POLICY IF EXISTS "Service role can update ETF data" ON public.etfs;

-- Single policy for INSERT: admin OR service role
CREATE POLICY "Admin or service can insert ETFs" ON public.etfs
FOR INSERT WITH CHECK (
  has_role((select auth.uid()), 'admin'::app_role) OR 
  (select auth.role()) = 'service_role'::text
);

-- Single policy for UPDATE: admin OR service role  
CREATE POLICY "Admin or service can update ETFs" ON public.etfs
FOR UPDATE USING (
  has_role((select auth.uid()), 'admin'::app_role) OR 
  (select auth.role()) = 'service_role'::text
)
WITH CHECK (
  has_role((select auth.uid()), 'admin'::app_role) OR 
  (select auth.role()) = 'service_role'::text
);

-- ==============================================
-- POSTS TABLE (users OR service can create)
-- ==============================================

DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Service can create posts as HillJump" ON public.posts;

-- Single policy for INSERT: authenticated user OR service (for HillJump posts)
CREATE POLICY "Users or service can create posts" ON public.posts
FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id OR 
  (user_id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- ==============================================
-- SUBSCRIBERS TABLE (3 policies → 1 per action)
-- ==============================================

DROP POLICY IF EXISTS "Admins can manage all subscribers" ON public.subscribers;
DROP POLICY IF EXISTS "Service role can manage subscriber data" ON public.subscribers;
DROP POLICY IF EXISTS "Users can view own subscription only" ON public.subscribers;

-- Single SELECT policy: users see own, admins see all, service sees all
CREATE POLICY "View subscribers" ON public.subscribers
FOR SELECT USING (
  user_id = (select auth.uid()) OR 
  has_role((select auth.uid()), 'admin'::app_role) OR
  (select auth.role()) = 'service_role'::text
);

-- Single INSERT policy: admin OR service
CREATE POLICY "Admin or service insert subscribers" ON public.subscribers
FOR INSERT WITH CHECK (
  has_role((select auth.uid()), 'admin'::app_role) OR
  (select auth.role()) = 'service_role'::text
);

-- Single UPDATE policy: admin OR service
CREATE POLICY "Admin or service update subscribers" ON public.subscribers
FOR UPDATE USING (
  has_role((select auth.uid()), 'admin'::app_role) OR
  (select auth.role()) = 'service_role'::text
)
WITH CHECK (
  has_role((select auth.uid()), 'admin'::app_role) OR
  (select auth.role()) = 'service_role'::text
);

-- Single DELETE policy: admin OR service
CREATE POLICY "Admin or service delete subscribers" ON public.subscribers
FOR DELETE USING (
  has_role((select auth.uid()), 'admin'::app_role) OR
  (select auth.role()) = 'service_role'::text
);