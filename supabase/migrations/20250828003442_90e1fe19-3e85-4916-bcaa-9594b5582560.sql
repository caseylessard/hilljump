-- Fix critical security vulnerability in subscribers table
-- Remove overly permissive RLS policies that allow any user to insert/update subscriber data

-- Drop the dangerous policies with 'true' conditions
DROP POLICY IF EXISTS "service insert" ON public.subscribers;
DROP POLICY IF EXISTS "service update" ON public.subscribers;

-- The subscribers table should only allow:
-- 1. Admins to view all subscribers (existing policy)  
-- 2. Users to view their own subscription (existing policy)
-- 3. Edge functions using service role key bypass RLS automatically

-- No additional policies needed since:
-- - Edge functions use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS
-- - Regular users should never directly insert/update subscription data
-- - All subscription management goes through Stripe webhooks and edge functions