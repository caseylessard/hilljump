-- Enable leaked password protection for enhanced security
-- This helps prevent users from using passwords that have been compromised in data breaches

-- Update auth configuration to enable leaked password protection
UPDATE auth.config 
SET leaked_password_protection = true 
WHERE key = 'leaked_password_protection' OR NOT EXISTS (
    SELECT 1 FROM auth.config WHERE key = 'leaked_password_protection'
);

-- If the config entry doesn't exist, insert it
INSERT INTO auth.config (key, value)
SELECT 'leaked_password_protection', 'true'
WHERE NOT EXISTS (
    SELECT 1 FROM auth.config WHERE key = 'leaked_password_protection'
);