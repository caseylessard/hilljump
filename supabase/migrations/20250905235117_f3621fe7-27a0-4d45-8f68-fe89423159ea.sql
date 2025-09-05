-- Fix critical security issue: Remove public access to subscribers table
-- and strengthen role-based access control

-- First, drop the problematic public policy that allows unrestricted access
DROP POLICY IF EXISTS "admin_can_view_all_subscribers" ON public.subscribers;

-- Recreate the policy to only allow authenticated admin users
CREATE POLICY "admin_can_view_all_subscribers" 
ON public.subscribers 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Drop existing trigger if it exists and recreate with proper function
DROP TRIGGER IF EXISTS audit_role_changes ON public.user_roles;

CREATE TRIGGER audit_role_changes
    BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_role_change();

-- Create security event logging for failed authentication attempts
CREATE TABLE IF NOT EXISTS public.security_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    user_id uuid,
    ip_address text,
    user_agent text,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on security events (admin only)
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_can_view_security_events" 
ON public.security_events 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "system_can_insert_security_events" 
ON public.security_events 
FOR INSERT 
WITH CHECK (true);

-- Add function to prevent self-role escalation
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent users from modifying their own roles
  IF NEW.user_id = auth.uid() AND OLD.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Users cannot modify their own roles';
  END IF;
  
  -- Log the role change attempt
  PERFORM public.log_security_event(
    'role_modification_attempt',
    auth.uid(),
    jsonb_build_object(
      'target_user_id', NEW.user_id,
      'role', NEW.role,
      'action', TG_OP
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add trigger to prevent self-role escalation
DROP TRIGGER IF EXISTS prevent_self_role_escalation ON public.user_roles;
CREATE TRIGGER prevent_self_role_escalation
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_self_role_escalation();