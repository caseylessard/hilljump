-- Create HillJump system user profile
-- Using a fixed UUID for the HillJump system user
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'system@hilljump.com',
  crypt('hilljump_system_user_no_login', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"HillJump","avatar_url":"/lovable-uploads/hilljump.png"}'::jsonb,
  false,
  '',
  '',
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- Create profile for HillJump system user
INSERT INTO public.profiles (id, username, first_name, last_name, approved, country)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'HillJump',
  'HillJump',
  'Capital',
  true,
  'US'
)
ON CONFLICT (id) DO NOTHING;

-- Update RLS policies to allow admins to manage any post
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;

CREATE POLICY "Users can delete own posts or admins can delete any"
ON public.posts
FOR DELETE
USING (
  auth.uid() = user_id OR 
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update own posts or admins can update any"
ON public.posts
FOR UPDATE
USING (
  auth.uid() = user_id OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Allow service role to create posts as HillJump
CREATE POLICY "Service can create posts as HillJump"
ON public.posts
FOR INSERT
WITH CHECK (
  user_id = '00000000-0000-0000-0000-000000000001'::uuid
);