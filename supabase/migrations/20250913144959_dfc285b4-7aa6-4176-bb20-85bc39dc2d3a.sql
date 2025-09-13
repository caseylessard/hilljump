-- Fix Extension Versions Outdated security warning
-- Update all extensions to their latest recommended versions

-- Update pg_stat_statements to latest version
ALTER EXTENSION pg_stat_statements UPDATE;

-- Update pgcrypto to latest version  
ALTER EXTENSION pgcrypto UPDATE;

-- Update uuid-ossp to latest version
ALTER EXTENSION "uuid-ossp" UPDATE;

-- Update pgjwt to latest version (if present)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgjwt') THEN
        ALTER EXTENSION pgjwt UPDATE;
    END IF;
END $$;

-- Update http to latest version (if present)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
        ALTER EXTENSION http UPDATE;
    END IF;
END $$;

-- Update pg_net to latest version (if present)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        ALTER EXTENSION pg_net UPDATE;
    END IF;
END $$;

-- Verify all extensions are updated
SELECT extname, extversion 
FROM pg_extension 
WHERE extname IN ('pg_stat_statements', 'pgcrypto', 'uuid-ossp', 'pgjwt', 'http', 'pg_net')
ORDER BY extname;