-- ============================================
-- APIFY EMAIL VERIFICATION SETTINGS MIGRATION
-- ============================================
-- This migration adds default Apify configuration
-- to the email_settings table

-- ============================================
-- STEP 1: Check if email_settings table exists
-- ============================================

-- Note: The email_settings table should already exist from previous migrations
-- This migration only inserts default Apify settings

-- ============================================
-- STEP 2: Insert default Apify settings
-- ============================================

INSERT INTO email_settings (key, value, label, description)
VALUES
  ('apify_api_key', '', 'Apify API Key', 'Your Apify API token for email verification'),
  ('apify_actor_id', 'streamlinehq/email-verifier', 'Apify Actor ID', 'The actor ID for email verification service'),
  ('apify_user_id', '', 'Apify User ID', 'Your Apify user ID (optional)'),
  ('apify_timeout_ms', '300000', 'API Timeout (ms)', 'Request timeout in milliseconds (default: 5 minutes)'),
  ('apify_max_retries', '3', 'Max Retries', 'Number of retry attempts for failed API calls'),
  ('apify_batch_size', '10', 'Batch Size', 'Number of emails to verify per batch'),
  ('apify_recheck_days', '30', 'Re-check Days', 'Days before re-verifying emails (default: 30)')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- STEP 3: Verify settings were inserted
-- ============================================

SELECT
  key,
  label,
  CASE
    WHEN key = 'apify_api_key' THEN '*** (hidden for security)'
    ELSE value
  END as value
FROM email_settings
WHERE key LIKE 'apify_%'
ORDER BY key;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Note: After running this migration, navigate to the Settings page
-- to enter your Apify API credentials:
-- - API Key: Required (get from https://console.apify.com/)
-- - User ID: Optional (your Apify username/ID)
-- - Other settings: Optional (have defaults)
