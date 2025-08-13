-- Fix security issues identified by the linter

-- 1. Set OTP expiry to recommended threshold (24 hours = 86400 seconds)
UPDATE auth.config 
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb), 
  '{OTP_EXPIRY}', 
  '86400'
) 
WHERE key = 'OTP_EXPIRY' OR NOT EXISTS (
  SELECT 1 FROM auth.config WHERE key = 'OTP_EXPIRY'
);

-- Insert OTP_EXPIRY config if it doesn't exist
INSERT INTO auth.config (key, config) 
SELECT 'OTP_EXPIRY', '{"OTP_EXPIRY": 86400}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM auth.config WHERE key = 'OTP_EXPIRY');

-- 2. Enable leaked password protection
UPDATE auth.config 
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb), 
  '{SECURITY_LEAKED_PASSWORD_PROTECTION}', 
  'true'
) 
WHERE key = 'SECURITY_LEAKED_PASSWORD_PROTECTION' OR NOT EXISTS (
  SELECT 1 FROM auth.config WHERE key = 'SECURITY_LEAKED_PASSWORD_PROTECTION'
);

-- Insert leaked password protection config if it doesn't exist
INSERT INTO auth.config (key, config) 
SELECT 'SECURITY_LEAKED_PASSWORD_PROTECTION', '{"SECURITY_LEAKED_PASSWORD_PROTECTION": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM auth.config WHERE key = 'SECURITY_LEAKED_PASSWORD_PROTECTION');