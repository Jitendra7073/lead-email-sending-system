-- ============================================
-- EMAIL VERIFICATION SYSTEM MIGRATION
-- ============================================
-- This migration adds support for:
-- 1. Email verification results from Apify
-- 2. Mapping between contacts and verification results
-- 3. Re-verification scheduling
-- 4. Proper indexing for performance

-- ============================================
-- STEP 1: Create email_verifications table
-- ============================================

CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('valid', 'invalid', 'risky', 'unknown')),
  reason TEXT,
  details JSONB DEFAULT '{}',
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  recheck_after TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_status ON email_verifications(status);
CREATE INDEX IF NOT EXISTS idx_email_verifications_recheck_after ON email_verifications(recheck_after)
  WHERE status IN ('valid', 'risky');

-- Add comments for documentation
COMMENT ON TABLE email_verifications IS 'Stores email verification results from Apify API';
COMMENT ON COLUMN email_verifications.email IS 'Normalized email address (lowercase, trimmed)';
COMMENT ON COLUMN email_verifications.status IS 'Verification status: valid, invalid, risky, unknown';
COMMENT ON COLUMN email_verifications.reason IS 'Human-readable reason from Apify (e.g., "Deliverable", "Invalid domain")';
COMMENT ON COLUMN email_verifications.details IS 'Full Apify API response as JSON for debugging';
COMMENT ON COLUMN email_verifications.checked_at IS 'When this verification was performed';
COMMENT ON COLUMN email_verifications.recheck_after IS 'When this verification should be re-checked (30 days default)';

-- ============================================
-- STEP 2: Create contact_email_verifications mapping table
-- ============================================

CREATE TABLE IF NOT EXISTS contact_email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email_verification_id UUID NOT NULL REFERENCES email_verifications(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, email_verification_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_email_verifications_contact_id ON contact_email_verifications(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_email_verifications_verification_id ON contact_email_verifications(email_verification_id);

-- Add comments for documentation
COMMENT ON TABLE contact_email_verifications IS 'Maps contacts to their email verification results';
COMMENT ON COLUMN contact_email_verifications.contact_id IS 'Reference to contacts table';
COMMENT ON COLUMN contact_email_verifications.email_verification_id IS 'Reference to email_verifications table';

-- ============================================
-- STEP 3: Add updated_at trigger function if not exists
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 4: Add trigger to email_verifications table
-- ============================================

DROP TRIGGER IF EXISTS update_email_verifications_updated_at ON email_verifications;
CREATE TRIGGER update_email_verifications_updated_at
  BEFORE UPDATE ON email_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify tables were created
SELECT
  'email_verifications' as table_name,
  COUNT(*) as row_count
FROM email_verifications
UNION ALL
SELECT
  'contact_email_verifications' as table_name,
  COUNT(*) as row_count
FROM contact_email_verifications;
