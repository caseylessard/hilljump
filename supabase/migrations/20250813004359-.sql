-- 1) Extend profiles with username/last_name/approved and timestamp trigger
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false;

-- Unique index for username (allow nulls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON public.profiles (username) WHERE username IS NOT NULL;

-- Trigger to auto-update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 2) Roles
DO $$
begin
  -- create enum if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin','premium','subscriber','user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- helper function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- Policies for user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='select own or admin'
  ) THEN
    CREATE POLICY "select own or admin" ON public.user_roles
    FOR SELECT
    USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='insert own or admin'
  ) THEN
    CREATE POLICY "insert own or admin" ON public.user_roles
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='update own or admin'
  ) THEN
    CREATE POLICY "update own or admin" ON public.user_roles
    FOR UPDATE
    USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
    WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='delete own or admin'
  ) THEN
    CREATE POLICY "delete own or admin" ON public.user_roles
    FOR DELETE
    USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- 3) Subscribers table for Stripe status
CREATE TABLE IF NOT EXISTS public.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  stripe_customer_id TEXT,
  subscribed BOOLEAN NOT NULL DEFAULT false,
  subscription_tier TEXT,
  subscription_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- RLS: users can see their own record; admins can see all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscribers' AND policyname='select own or admin'
  ) THEN
    CREATE POLICY "select own or admin" ON public.subscribers
    FOR SELECT
    USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- Only service role can write (edge functions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscribers' AND policyname='service insert'
  ) THEN
    CREATE POLICY "service insert" ON public.subscribers
    FOR INSERT TO service_role
    WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscribers' AND policyname='service update'
  ) THEN
    CREATE POLICY "service update" ON public.subscribers
    FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- 4) User preferences for ranking sliders
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  return_weight INTEGER NOT NULL DEFAULT 60,
  yield_weight INTEGER NOT NULL DEFAULT 20,
  risk_weight INTEGER NOT NULL DEFAULT 20,
  dividend_stability INTEGER NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_preferences' AND policyname='select own prefs'
  ) THEN
    CREATE POLICY "select own prefs" ON public.user_preferences
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_preferences' AND policyname='insert own prefs'
  ) THEN
    CREATE POLICY "insert own prefs" ON public.user_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_preferences' AND policyname='update own prefs'
  ) THEN
    CREATE POLICY "update own prefs" ON public.user_preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_preferences_updated_at'
  ) THEN
    CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 5) Seed: make Casey admin and set username if user exists
DO $$
DECLARE
  u_id uuid;
BEGIN
  SELECT id INTO u_id FROM auth.users WHERE email = 'caseylessard@gmail.com' ORDER BY created_at DESC LIMIT 1;
  IF u_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, username, first_name, country, approved)
    VALUES (u_id, 'caseylessard', 'Casey', 'CA', true)
    ON CONFLICT (id) DO UPDATE
      SET username = EXCLUDED.username,
          approved = true;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (u_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;