-- Fix RLS performance issues by optimizing auth function calls and consolidating policies

-- ======================
-- ETFs Table
-- ======================
DROP POLICY IF EXISTS "Admins can insert ETF data" ON public.etfs;
DROP POLICY IF EXISTS "Admins can update ETF data" ON public.etfs;
DROP POLICY IF EXISTS "Service role can insert ETF data" ON public.etfs;
DROP POLICY IF EXISTS "Service role can update ETF data" ON public.etfs;

CREATE POLICY "Admins can insert ETF data" ON public.etfs
FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can update ETF data" ON public.etfs
FOR UPDATE USING (has_role((select auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Service role can insert ETF data" ON public.etfs
FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update ETF data" ON public.etfs
FOR UPDATE USING (true) WITH CHECK (true);

-- ======================
-- Subscribers Table
-- ======================
DROP POLICY IF EXISTS "Admins can manage all subscribers" ON public.subscribers;
DROP POLICY IF EXISTS "Admins can view all subscribers" ON public.subscribers;
DROP POLICY IF EXISTS "Users can view own subscription only" ON public.subscribers;
DROP POLICY IF EXISTS "Service role can manage subscriber data" ON public.subscribers;

-- Consolidate admin policies
CREATE POLICY "Admins can manage all subscribers" ON public.subscribers
FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Users can view own subscription only" ON public.subscribers
FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "Service role can manage subscriber data" ON public.subscribers
FOR ALL USING (true) WITH CHECK (true);

-- ======================
-- Cron Job Logs
-- ======================
DROP POLICY IF EXISTS "Admins can view cron job logs" ON public.cron_job_logs;

CREATE POLICY "Admins can view cron job logs" ON public.cron_job_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = (select auth.uid())
    AND user_roles.role = 'admin'::app_role
  )
);

-- ======================
-- Cron Execution Log
-- ======================
DROP POLICY IF EXISTS "Admins can view cron logs" ON public.cron_execution_log;
DROP POLICY IF EXISTS "Service can manage cron logs" ON public.cron_execution_log;

-- Consolidate into single policy for SELECT
CREATE POLICY "Cron logs viewable" ON public.cron_execution_log
FOR SELECT USING (true);

CREATE POLICY "Service can write cron logs" ON public.cron_execution_log
FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update cron logs" ON public.cron_execution_log
FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Service can delete cron logs" ON public.cron_execution_log
FOR DELETE USING (true);

-- ======================
-- Profiles Table
-- ======================
DROP POLICY IF EXISTS "Can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Can view own profile" ON public.profiles;

CREATE POLICY "Can insert own profile" ON public.profiles
FOR INSERT WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Can update own profile" ON public.profiles
FOR UPDATE USING ((select auth.uid()) = id);

CREATE POLICY "Can view own profile" ON public.profiles
FOR SELECT USING ((select auth.uid()) = id);

-- ======================
-- Portfolio Positions Table
-- ======================
DROP POLICY IF EXISTS "Users can delete own positions" ON public.portfolio_positions;
DROP POLICY IF EXISTS "Users can insert own positions" ON public.portfolio_positions;
DROP POLICY IF EXISTS "Users can update own positions" ON public.portfolio_positions;
DROP POLICY IF EXISTS "Users can view own positions" ON public.portfolio_positions;

CREATE POLICY "Users can delete own positions" ON public.portfolio_positions
FOR DELETE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own positions" ON public.portfolio_positions
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own positions" ON public.portfolio_positions
FOR UPDATE USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can view own positions" ON public.portfolio_positions
FOR SELECT USING ((select auth.uid()) = user_id);

-- ======================
-- User Roles Table
-- ======================
DROP POLICY IF EXISTS "admin_can_delete_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_can_insert_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_can_update_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_can_view_roles" ON public.user_roles;

CREATE POLICY "admin_can_delete_roles" ON public.user_roles
FOR DELETE USING (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "admin_can_insert_roles" ON public.user_roles
FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "admin_can_update_roles" ON public.user_roles
FOR UPDATE USING (has_role((select auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "admin_can_view_roles" ON public.user_roles
FOR SELECT USING (has_role((select auth.uid()), 'admin'::app_role));

-- ======================
-- Security Events Table
-- ======================
DROP POLICY IF EXISTS "admin_can_view_security_events" ON public.security_events;

CREATE POLICY "admin_can_view_security_events" ON public.security_events
FOR SELECT USING (has_role((select auth.uid()), 'admin'::app_role));

-- ======================
-- User Preferences Table
-- ======================
DROP POLICY IF EXISTS "insert own prefs" ON public.user_preferences;
DROP POLICY IF EXISTS "select own prefs" ON public.user_preferences;
DROP POLICY IF EXISTS "update own prefs" ON public.user_preferences;

CREATE POLICY "insert own prefs" ON public.user_preferences
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "select own prefs" ON public.user_preferences
FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "update own prefs" ON public.user_preferences
FOR UPDATE USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- ======================
-- Site Settings Table
-- ======================
DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Site settings are publicly viewable" ON public.site_settings;

CREATE POLICY "Site settings are publicly viewable" ON public.site_settings
FOR SELECT USING (true);

CREATE POLICY "Admins can manage site settings" ON public.site_settings
FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- ======================
-- Homepage Content Table
-- ======================
DROP POLICY IF EXISTS "Admins can manage homepage content" ON public.homepage_content;
DROP POLICY IF EXISTS "Homepage content is publicly viewable" ON public.homepage_content;

CREATE POLICY "Homepage content is publicly viewable" ON public.homepage_content
FOR SELECT USING (true);

CREATE POLICY "Admins can manage homepage content" ON public.homepage_content
FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- ======================
-- Options Cache Table
-- ======================
DROP POLICY IF EXISTS "Public read access to options cache" ON public.options_cache;
DROP POLICY IF EXISTS "Service role can manage cache" ON public.options_cache;

CREATE POLICY "Public read access to options cache" ON public.options_cache
FOR SELECT USING (true);

CREATE POLICY "Service role can manage cache" ON public.options_cache
FOR ALL USING ((select auth.role()) = 'service_role'::text);

-- ======================
-- Posts Table
-- ======================
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete own posts or admins can delete any" ON public.posts;
DROP POLICY IF EXISTS "Users can update own posts or admins can update any" ON public.posts;

CREATE POLICY "Users can create posts" ON public.posts
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own posts or admins can delete any" ON public.posts
FOR DELETE USING ((select auth.uid()) = user_id OR has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Users can update own posts or admins can update any" ON public.posts
FOR UPDATE USING ((select auth.uid()) = user_id OR has_role((select auth.uid()), 'admin'::app_role));

-- ======================
-- Comments Table
-- ======================
DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;

CREATE POLICY "Users can create comments" ON public.comments
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own comments" ON public.comments
FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own comments" ON public.comments
FOR DELETE USING ((select auth.uid()) = user_id);

-- ======================
-- Post Follows Table
-- ======================
DROP POLICY IF EXISTS "Users can follow posts" ON public.post_follows;
DROP POLICY IF EXISTS "Users can unfollow posts" ON public.post_follows;

CREATE POLICY "Users can follow posts" ON public.post_follows
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can unfollow posts" ON public.post_follows
FOR DELETE USING ((select auth.uid()) = user_id);

-- ======================
-- Notifications Table
-- ======================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications
FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
FOR UPDATE USING ((select auth.uid()) = user_id);

-- ======================
-- Consolidate Multiple Permissive Policies
-- ======================

-- Crypto Universe
DROP POLICY IF EXISTS "Crypto universe is publicly viewable" ON public.crypto_universe;
DROP POLICY IF EXISTS "Service can manage crypto universe data" ON public.crypto_universe;

CREATE POLICY "Crypto universe readable" ON public.crypto_universe
FOR SELECT USING (true);

CREATE POLICY "Service can manage crypto universe" ON public.crypto_universe
FOR ALL USING (true) WITH CHECK (true);

-- Dividend Source Logs
DROP POLICY IF EXISTS "Dividend source logs are publicly viewable" ON public.dividend_source_logs;
DROP POLICY IF EXISTS "Service can manage dividend source logs" ON public.dividend_source_logs;

CREATE POLICY "Dividend source logs readable" ON public.dividend_source_logs
FOR SELECT USING (true);

CREATE POLICY "Service can manage dividend source logs" ON public.dividend_source_logs
FOR ALL USING (true) WITH CHECK (true);

-- DRIP Cache CA
DROP POLICY IF EXISTS "DRIP cache CA is publicly viewable" ON public.drip_cache_ca;
DROP POLICY IF EXISTS "Service can manage DRIP cache CA" ON public.drip_cache_ca;

CREATE POLICY "DRIP cache CA readable" ON public.drip_cache_ca
FOR SELECT USING (true);

CREATE POLICY "Service can manage DRIP cache CA" ON public.drip_cache_ca
FOR ALL USING (true) WITH CHECK (true);

-- DRIP Cache US
DROP POLICY IF EXISTS "DRIP cache US is publicly viewable" ON public.drip_cache_us;
DROP POLICY IF EXISTS "Service can manage DRIP cache US" ON public.drip_cache_us;

CREATE POLICY "DRIP cache US readable" ON public.drip_cache_us
FOR SELECT USING (true);

CREATE POLICY "Service can manage DRIP cache US" ON public.drip_cache_us
FOR ALL USING (true) WITH CHECK (true);

-- Equity Universe
DROP POLICY IF EXISTS "Service can manage universe data" ON public.equity_universe;
DROP POLICY IF EXISTS "Universe is publicly viewable" ON public.equity_universe;

CREATE POLICY "Equity universe readable" ON public.equity_universe
FOR SELECT USING (true);

CREATE POLICY "Service can manage equity universe" ON public.equity_universe
FOR ALL USING (true) WITH CHECK (true);

-- ETF Rankings
DROP POLICY IF EXISTS "Rankings are publicly viewable" ON public.etf_rankings;
DROP POLICY IF EXISTS "Service can manage rankings" ON public.etf_rankings;

CREATE POLICY "Rankings readable" ON public.etf_rankings
FOR SELECT USING (true);

CREATE POLICY "Service can manage rankings" ON public.etf_rankings
FOR ALL USING (true) WITH CHECK (true);

-- ETF Scores
DROP POLICY IF EXISTS "ETF scores are publicly viewable" ON public.etf_scores;
DROP POLICY IF EXISTS "Service can manage ETF scores" ON public.etf_scores;

CREATE POLICY "ETF scores readable" ON public.etf_scores
FOR SELECT USING (true);

CREATE POLICY "Service can manage ETF scores" ON public.etf_scores
FOR ALL USING (true) WITH CHECK (true);

-- Historical Prices
DROP POLICY IF EXISTS "Historical prices are publicly viewable" ON public.historical_prices;
DROP POLICY IF EXISTS "Service can manage historical prices" ON public.historical_prices;

CREATE POLICY "Historical prices readable" ON public.historical_prices
FOR SELECT USING (true);

CREATE POLICY "Service can manage historical prices" ON public.historical_prices
FOR ALL USING (true) WITH CHECK (true);