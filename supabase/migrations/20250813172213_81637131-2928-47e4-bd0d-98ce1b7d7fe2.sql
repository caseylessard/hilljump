-- These security settings need to be configured in Supabase Dashboard
-- since auth.config table doesn't exist in this project setup

-- For now, let's focus on improving data quality and adding helpful comments
-- Security settings to configure in Supabase Dashboard:
-- 1. Auth > Settings > OTP expiry should be set to 24 hours (86400 seconds)
-- 2. Auth > Settings > Enable password breach protection

-- Add a comment table for tracking security recommendations
CREATE TABLE IF NOT EXISTS public.security_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert security recommendations for manual configuration
INSERT INTO public.security_recommendations (recommendation, status) VALUES
('Configure OTP expiry to 24 hours in Supabase Dashboard > Auth > Settings', 'manual_config_required'),
('Enable password breach protection in Supabase Dashboard > Auth > Settings', 'manual_config_required')
ON CONFLICT DO NOTHING;