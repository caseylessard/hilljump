-- Phase 2: Enhanced audit logging and subscriber security

-- Update audit_role_change function with better security
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

-- Enhanced subscribers table security
DROP POLICY IF EXISTS "users_can_view_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "Admins can manage all subscribers" ON public.subscribers;

-- Create more granular subscriber policies
CREATE POLICY "Users can view own subscription status" 
ON public.subscribers 
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all subscribers" 
ON public.subscribers 
FOR ALL 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add security monitoring function
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