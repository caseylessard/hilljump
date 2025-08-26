-- Fix critical privilege escalation vulnerability in user_roles table
-- Remove dangerous policy that allows users to grant themselves any role
DROP POLICY IF EXISTS "insert own or admin" ON public.user_roles;
DROP POLICY IF EXISTS "update own or admin" ON public.user_roles;

-- Create secure admin-only policies for role management
CREATE POLICY "admin_can_insert_roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_can_update_roles" 
ON public.user_roles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Keep existing select and delete policies but make them admin-only for safety
DROP POLICY IF EXISTS "select own or admin" ON public.user_roles;
DROP POLICY IF EXISTS "delete own or admin" ON public.user_roles;

CREATE POLICY "admin_can_view_roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_can_delete_roles" 
ON public.user_roles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix subscribers table - remove overly permissive policies
DROP POLICY IF EXISTS "select own or admin" ON public.subscribers;

-- Create more restrictive subscriber access
CREATE POLICY "users_can_view_own_subscription" 
ON public.subscribers 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "admin_can_view_all_subscribers" 
ON public.subscribers 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add audit function for sensitive operations (optional but recommended)
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log role changes to a separate audit table if it exists
  -- For now, just ensure the change is by an admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized role modification attempt';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger for role change auditing
DROP TRIGGER IF EXISTS audit_user_roles_changes ON public.user_roles;
CREATE TRIGGER audit_user_roles_changes
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_change();