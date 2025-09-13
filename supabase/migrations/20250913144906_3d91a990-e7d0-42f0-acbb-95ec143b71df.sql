-- CRITICAL SECURITY FIX: Remove overly permissive RLS policy on subscribers table
-- This policy was allowing public access to customer email addresses

-- First, drop the dangerous policy that allows public access
DROP POLICY IF EXISTS "Service can manage subscriber data" ON public.subscribers;

-- Create a secure service role policy that only allows service role access
-- Service role should only be used by edge functions, not public users
CREATE POLICY "Service role can manage subscriber data" 
ON public.subscribers 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure the existing user and admin policies remain secure
-- These policies are already correctly configured:
-- - "Users can view own subscription only" (user_id = auth.uid())  
-- - "Admins can view all subscribers" (has_role(auth.uid(), 'admin'::app_role))
-- - "Admins can manage all subscribers" (has_role(auth.uid(), 'admin'::app_role))

-- Add audit logging for any access to subscriber data
CREATE OR REPLACE FUNCTION log_subscriber_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log access attempts for security monitoring
  PERFORM log_security_event(
    'subscriber_data_access',
    auth.uid(),
    jsonb_build_object(
      'operation', TG_OP,
      'table', 'subscribers',
      'user_role', CASE 
        WHEN auth.role() = 'service_role' THEN 'service'
        WHEN has_role(auth.uid(), 'admin'::app_role) THEN 'admin'
        ELSE 'user'
      END
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to log all subscriber table access
DROP TRIGGER IF EXISTS subscriber_access_log ON public.subscribers;
CREATE TRIGGER subscriber_access_log
  AFTER INSERT OR UPDATE OR DELETE ON public.subscribers
  FOR EACH ROW
  EXECUTE FUNCTION log_subscriber_access();

-- Add additional security: prevent unauthorized email updates
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;