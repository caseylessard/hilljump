-- Add new weighting fields for time periods and home-country bias
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS period_4w_weight integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS period_52w_weight integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS home_country_bias integer NOT NULL DEFAULT 0;