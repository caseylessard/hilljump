-- Phase 1: Critical ETF Data Protection - Fix overly permissive RLS policies

-- Drop ALL existing ETF policies to start fresh
DROP POLICY IF EXISTS "Service can insert ETF data" ON public.etfs;
DROP POLICY IF EXISTS "Service can update ETF data" ON public.etfs;
DROP POLICY IF EXISTS "Admins can insert ETF data" ON public.etfs;
DROP POLICY IF EXISTS "Admins can update ETF data" ON public.etfs;
DROP POLICY IF EXISTS "Service role can insert ETF data" ON public.etfs;
DROP POLICY IF EXISTS "Service role can update ETF data" ON public.etfs;

-- Create secure admin-only policies for ETF data modification
CREATE POLICY "Admins can insert ETF data" 
ON public.etfs 
FOR INSERT 
TO authenticated 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update ETF data" 
ON public.etfs 
FOR UPDATE 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create service role policies for automated edge function updates
CREATE POLICY "Service role can insert ETF data" 
ON public.etfs 
FOR INSERT 
TO service_role 
WITH CHECK (true);

CREATE POLICY "Service role can update ETF data" 
ON public.etfs 
FOR UPDATE 
TO service_role 
USING (true)
WITH CHECK (true);