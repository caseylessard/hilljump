-- Fix critical security vulnerabilities

-- 1. Fix subscribers table SELECT policy to prevent data exposure
DROP POLICY IF EXISTS "View subscribers" ON public.subscribers;

CREATE POLICY "Users can view own subscription"
ON public.subscribers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all subscriptions"
ON public.subscribers
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Fix security_events INSERT policy to prevent log poisoning
DROP POLICY IF EXISTS "system_can_insert_security_events" ON public.security_events;

CREATE POLICY "Service role can insert security events"
ON public.security_events
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- 3. Add input validation constraints for posts and comments
ALTER TABLE public.posts 
ADD CONSTRAINT posts_content_length 
CHECK (length(content) > 0 AND length(content) <= 10000);

ALTER TABLE public.comments 
ADD CONSTRAINT comments_content_length 
CHECK (length(content) > 0 AND length(content) <= 5000);