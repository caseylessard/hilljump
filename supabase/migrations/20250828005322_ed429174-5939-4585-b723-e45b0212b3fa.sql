-- Enable leaked password protection properly
UPDATE auth.config 
SET encrypted_value = crypt('true', gen_salt('bf'))
WHERE name = 'password_leak_protection';