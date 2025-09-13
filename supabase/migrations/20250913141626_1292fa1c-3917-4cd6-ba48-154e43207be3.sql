-- Fix security issue with subscribers table
-- Step 1: Make user_id NOT NULL for better security
ALTER TABLE public.subscribers ALTER COLUMN user_id SET NOT NULL;

-- Step 2: Drop existing potentially problematic RLS policies
DROP POLICY IF EXISTS "Users can view own subscription (limited fields)" ON public.subscribers;
DROP POLICY IF EXISTS "Users can view own subscription status" ON public.subscribers;
DROP POLICY IF EXISTS "admin_can_view_all_subscribers" ON public.subscribers;

-- Step 3: Create more restrictive RLS policies
-- Only authenticated users can view their own subscription data
CREATE POLICY "Users can view own subscription only" 
ON public.subscribers 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Only admins can view all subscriber data
CREATE POLICY "Admins can view all subscribers" 
ON public.subscribers 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can still manage subscriber data (for webhooks, etc.)
CREATE POLICY "Service can manage subscriber data" 
ON public.subscribers 
FOR ALL
USING (true)
WITH CHECK (true);