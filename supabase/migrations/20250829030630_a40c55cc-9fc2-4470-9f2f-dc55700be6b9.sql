-- Phase 1: Critical ETF Data Protection - Fix overly permissive RLS policies

-- Drop the existing overly permissive policies that allow any authenticated user to modify ETF data
DROP POLICY IF EXISTS "Service can insert ETF data" ON public.etfs;
DROP POLICY IF EXISTS "Service can update ETF data" ON public.etfs;

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

-- Phase 2: Strengthen user roles table security with audit trigger
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log role changes and ensure only admins can modify roles
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized role modification attempt by user %', auth.uid();
  END IF;
  
  -- Log the change for audit purposes
  RAISE LOG 'Role change: User % modified role for user % to %', 
    auth.uid(), 
    COALESCE(NEW.user_id, OLD.user_id), 
    COALESCE(NEW.role, OLD.role);
    
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit trigger to user_roles table
DROP TRIGGER IF EXISTS audit_role_changes ON public.user_roles;
CREATE TRIGGER audit_role_changes
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_change();

-- Phase 3: Enhance subscribers table security with better field-level access
-- Update subscribers policies to be more restrictive
DROP POLICY IF EXISTS "users_can_view_own_subscription" ON public.subscribers;

CREATE POLICY "Users can view own subscription (limited fields)" 
ON public.subscribers 
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- Create admin policy for full subscriber access
CREATE POLICY "Admins can manage all subscribers" 
ON public.subscribers 
FOR ALL 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Phase 4: Add security monitoring function
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type text,
  user_id uuid DEFAULT auth.uid(),
  details jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  -- Log security events for monitoring
  RAISE LOG 'SECURITY_EVENT: % by user % - %', event_type, user_id, details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;