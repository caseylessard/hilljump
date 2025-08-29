-- Fix function search path security warnings

-- Update audit_role_change function with proper search_path
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
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public';

-- Update log_security_event function with proper search_path
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
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public';