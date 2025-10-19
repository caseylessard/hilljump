-- Update audit trigger to allow service role (NULL auth.uid()) to make changes
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service role (migrations) or admin users
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized role modification attempt by user %', auth.uid();
  END IF;
  
  -- Log the change for audit purposes
  RAISE LOG 'Role change: User % modified role for user % to %', 
    COALESCE(auth.uid()::text, 'SERVICE_ROLE'), 
    COALESCE(NEW.user_id, OLD.user_id), 
    COALESCE(NEW.role, OLD.role);
    
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Now create/update the HillJump profile
INSERT INTO public.profiles (id, username, first_name, last_name, country, approved)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'HillJump',
  'HillJump',
  'Official',
  'US',
  true
)
ON CONFLICT (id) DO UPDATE SET
  username = 'HillJump',
  first_name = 'HillJump',
  last_name = 'Official',
  approved = true;

-- Grant admin role to the HillJump user
INSERT INTO public.user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;