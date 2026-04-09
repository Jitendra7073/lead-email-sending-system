/**
 * Migration script to ensure email_queue and email_senders have proper primary keys
 * This prevents duplicate IDs in the future
 *
 * Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
 */

-- First, let's check the current table structures
SELECT
  table_name,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name IN ('email_queue', 'email_senders')
  AND constraint_type = 'PRIMARY KEY';

-- If email_queue doesn't have a primary key on 'id', add it:
-- ALTER TABLE email_queue ADD PRIMARY KEY (id);

-- If email_senders doesn't have a primary key on 'id', add it:
-- ALTER TABLE email_senders ADD PRIMARY KEY (id);

-- For production, first check for and remove any duplicates before adding the PK:
-- This query finds duplicates in email_queue:
-- SELECT id, COUNT(*) as count
-- FROM email_queue
-- GROUP BY id
-- HAVING COUNT(*) > 1;

-- Clean up duplicates (keep the earliest created, delete newer ones):
-- DELETE FROM email_queue
-- WHERE ctid NOT IN (
--   SELECT MIN(ctid)
--   FROM email_queue
--   GROUP BY id
-- );

-- Then add the primary key:
-- ALTER TABLE email_queue ADD PRIMARY KEY (id);

console.log(`
Run these SQL commands in your Supabase SQL Editor to fix the schema:

1. Check current constraints:
SELECT table_name, constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name IN ('email_queue', 'email_senders')
  AND constraint_type = 'PRIMARY KEY';

2. Find and remove duplicates (if any):
DELETE FROM email_queue
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM email_queue
  GROUP BY id
);

3. Add primary keys (if missing):
ALTER TABLE email_queue ADD PRIMARY KEY (id);
ALTER TABLE email_senders ADD PRIMARY KEY (id);
`);
