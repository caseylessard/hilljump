-- Create comment_flags table for flagging inappropriate content
CREATE TABLE IF NOT EXISTS public.comment_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(comment_id, user_id)
);

-- Enable RLS
ALTER TABLE public.comment_flags ENABLE ROW LEVEL SECURITY;

-- Users can flag comments
CREATE POLICY "Users can flag comments"
ON public.comment_flags
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own flags
CREATE POLICY "Users can view own flags"
ON public.comment_flags
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all flags
CREATE POLICY "Admins can view all flags"
ON public.comment_flags
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can resolve flags
CREATE POLICY "Admins can resolve flags"
ON public.comment_flags
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete flags
CREATE POLICY "Admins can delete flags"
ON public.comment_flags
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_comment_flags_comment_id ON public.comment_flags(comment_id);
CREATE INDEX idx_comment_flags_resolved ON public.comment_flags(resolved) WHERE NOT resolved;

-- Update profiles RLS to allow admins to view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admins to update user approval status
DROP POLICY IF EXISTS "Admins can update user approval" ON public.profiles;
CREATE POLICY "Admins can update user approval"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create a function to get user engagement stats
CREATE OR REPLACE FUNCTION public.get_user_engagement_stats(target_user_id UUID)
RETURNS TABLE (
  post_count BIGINT,
  comment_count BIGINT,
  flag_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT COUNT(*) FROM public.posts WHERE user_id = target_user_id), 0) as post_count,
    COALESCE((SELECT COUNT(*) FROM public.comments WHERE user_id = target_user_id), 0) as comment_count,
    COALESCE((SELECT COUNT(DISTINCT cf.id) 
              FROM public.comment_flags cf 
              JOIN public.comments c ON cf.comment_id = c.id 
              WHERE c.user_id = target_user_id AND cf.resolved = false), 0) as flag_count;
$$;