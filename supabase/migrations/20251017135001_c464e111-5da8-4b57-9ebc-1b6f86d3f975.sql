-- Link profiles to posts for better querying
-- Note: profiles.id should match auth.users.id which is what posts.user_id references

-- We don't need to add a foreign key since posts.user_id already references auth.users(id)
-- and profiles.id is the same as auth.users.id
-- This is just documentation that the relationship exists through auth.users

-- Add helpful comment
COMMENT ON COLUMN posts.user_id IS 'References auth.users.id, which matches profiles.id';
COMMENT ON COLUMN comments.user_id IS 'References auth.users.id, which matches profiles.id';