-- Remove system user profile
DELETE FROM public.profiles 
WHERE id = '00000000-0000-0000-0000-000000000001';