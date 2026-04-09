-- ============================================
-- TIMEZONE-AWARE EMAIL SCHEDULING MIGRATION
-- ============================================
-- This migration adds support for:
-- 1. Timezone detection and storage for contacts
-- 2. Dependency chain management for email sequences
-- 3. Timezone-aware scheduling with validation
-- 4. Weekend and business hours adjustment tracking

-- ============================================
-- STEP 1: Add timezone fields to contacts table
-- ============================================

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS country_code TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT,
ADD COLUMN IF NOT EXISTS region_data JSONB DEFAULT '{}';

-- Add index for timezone-based queries
CREATE INDEX IF NOT EXISTS idx_contacts_timezone ON contacts(timezone);
CREATE INDEX IF NOT EXISTS idx_contacts_country_code ON contacts(country_code);

-- Add comments for documentation
COMMENT ON COLUMN contacts.country_code IS 'ISO 3166-1 alpha-2 country code (e.g., US, IN, UK)';
COMMENT ON COLUMN contacts.timezone IS 'IANA timezone identifier (e.g., America/New_York, Asia/Kolkata)';
COMMENT ON COLUMN contacts.region_data IS 'Additional regional configuration data (business hours, weekend patterns)';

-- ============================================
-- STEP 2: Add dependency chain fields to email_queue
-- ============================================

ALTER TABLE email_queue
ADD COLUMN IF NOT EXISTS depends_on_email_id UUID REFERENCES email_queue(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS dependency_satisfied BOOLEAN DEFAULT FALSE;

-- Add index for dependency lookups
CREATE INDEX IF NOT EXISTS idx_email_queue_dependency ON email_queue(depends_on_email_id, dependency_satisfied);
CREATE INDEX IF NOT EXISTS idx_email_queue_chain ON email_queue(campaign_id, contact_id, sequence_position);

-- Add comments for documentation
COMMENT ON COLUMN email_queue.depends_on_email_id IS 'Previous email in sequence (NULL for first email)';
COMMENT ON COLUMN email_queue.dependency_satisfied IS 'Whether the previous email has been sent';

-- ============================================
-- STEP 3: Add timezone scheduling fields to email_queue
-- ============================================

ALTER TABLE email_queue
ADD COLUMN IF NOT EXISTS recipient_timezone TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS original_scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS adjustment_reason JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS passed_weekend_check BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS passed_business_hours_check BOOLEAN DEFAULT FALSE;

-- Make adjusted_scheduled_at required (was nullable)
ALTER TABLE email_queue ALTER COLUMN adjusted_scheduled_at SET NOT NULL;
ALTER TABLE email_queue ALTER COLUMN adjusted_scheduled_at SET DEFAULT NOW();

-- Add index for timezone-based queries
CREATE INDEX IF NOT EXISTS idx_email_queue_timezone ON email_queue(recipient_timezone);
CREATE INDEX IF NOT EXISTS idx_email_queue_validation_flags ON email_queue(passed_weekend_check, passed_business_hours_check);

-- Add comments for documentation
COMMENT ON COLUMN email_queue.recipient_timezone IS 'IANA timezone of recipient (e.g., America/New_York)';
COMMENT ON COLUMN email_queue.original_scheduled_at IS 'Initial calculated time before adjustments';
COMMENT ON COLUMN email_queue.adjustment_reason IS 'JSON array of adjustments made (weekend, business hours, etc.)';
COMMENT ON COLUMN email_queue.passed_weekend_check IS 'Whether weekend validation was performed and passed';
COMMENT ON COLUMN email_queue.passed_business_hours_check IS 'Whether business hours validation was performed and passed';

-- ============================================
-- STEP 4: Update queue status enum to include dependency states
-- ============================================

-- Add check constraint for valid statuses including dependency states
ALTER TABLE email_queue DROP CONSTRAINT IF EXISTS email_queue_status_check;

ALTER TABLE email_queue
ADD CONSTRAINT email_queue_status_check
CHECK (status IN (
  'pending',           -- Initial state
  'dependency_pending',-- Waiting for previous email
  'ready_to_send',     -- Dependencies satisfied, time to send
  'scheduled',         -- Scheduled for future
  'sending',           -- Currently sending
  'sent',              -- Successfully sent
  'failed',            -- Failed after retries
  'cancelled',         -- Cancelled due to upstream failure
  'paused'             -- Manually paused
));

-- ============================================
-- STEP 5: Create country_timezones table if not exists
-- ============================================

CREATE TABLE IF NOT EXISTS country_timezones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL UNIQUE,
  country_name TEXT NOT NULL,
  default_timezone TEXT NOT NULL,
  business_hours_start TIME DEFAULT '09:00',
  business_hours_end TIME DEFAULT '18:00',
  weekend_days TEXT[] DEFAULT ARRAY['Saturday', 'Sunday'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for quick country lookup
CREATE INDEX IF NOT EXISTS idx_country_timezones_code ON country_timezones(country_code);

-- Add comments for documentation
COMMENT ON TABLE country_timezones IS 'Regional timezone and business hours configuration by country';
COMMENT ON COLUMN country_timezones.country_code IS 'ISO 3166-1 alpha-2 country code';
COMMENT ON COLUMN country_timezones.default_timezone IS 'IANA timezone identifier (e.g., America/New_York)';
COMMENT ON COLUMN country_timezones.weekend_days IS 'Array of weekend day names (varies by region)';

-- ============================================
-- STEP 6: Create trigger for updated_at
-- ============================================

-- Create or replace trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to country_timezones
DROP TRIGGER IF EXISTS update_country_timezones_updated_at ON country_timezones;
CREATE TRIGGER update_country_timezones_updated_at
  BEFORE UPDATE ON country_timezones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 7: Backfill existing data
-- ============================================

-- Set default timezone for existing contacts
UPDATE contacts
SET timezone = 'UTC',
    country_code = 'UNKNOWN'
WHERE timezone IS NULL;

-- Set default timezone for existing queue items
UPDATE email_queue
SET recipient_timezone = 'UTC',
    passed_weekend_check = TRUE,
    passed_business_hours_check = TRUE
WHERE recipient_timezone IS NULL OR recipient_timezone = '';

-- Set dependency satisfied for existing sent emails
UPDATE email_queue
SET dependency_satisfied = TRUE
WHERE status IN ('sent', 'failed', 'cancelled');

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify migration
DO $$
DECLARE
  contact_columns INTEGER;
  queue_columns INTEGER;
  country_table_exists BOOLEAN;
BEGIN
  -- Check contacts table
  SELECT COUNT(*) INTO contact_columns
  FROM information_schema.columns
  WHERE table_name = 'contacts'
  AND column_name IN ('country_code', 'timezone', 'region_data');

  -- Check email_queue table
  SELECT COUNT(*) INTO queue_columns
  FROM information_schema.columns
  WHERE table_name = 'email_queue'
  AND column_name IN ('depends_on_email_id', 'dependency_satisfied', 'recipient_timezone',
                      'original_scheduled_at', 'adjustment_reason', 'passed_weekend_check',
                      'passed_business_hours_check');

  -- Check country_timezones table
  SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'country_timezones')
  INTO country_table_exists;

  RAISE NOTICE 'Migration verification:';
  RAISE NOTICE '- Contacts timezone columns: % (expected: 3)', contact_columns;
  RAISE NOTICE '- Queue dependency columns: % (expected: 7)', queue_columns;
  RAISE NOTICE '- Country_timezones table exists: % (expected: true)', country_table_exists;

  IF contact_columns = 3 AND queue_columns = 7 AND country_table_exists THEN
    RAISE NOTICE '✅ MIGRATION SUCCESSFUL';
  ELSE
    RAISE EXCEPTION ' MIGRATION INCOMPLETE - Some columns or tables are missing';
  END IF;
END $$;
