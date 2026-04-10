-- Rollback: Remove Email Aliases Support
-- Use this to rollback the aliases feature
-- File: migrations/rollback_email_aliases.sql

BEGIN;

-- Remove from_alias_id from email_queue
ALTER TABLE email_queue
DROP COLUMN IF EXISTS from_alias_id;

-- Drop email_aliases table
DROP TABLE IF EXISTS email_aliases;

COMMIT;

SELECT 'Rollback completed!' as status;
