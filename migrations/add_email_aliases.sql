-- Migration: Add Email Aliases Support
-- Run this in your PostgreSQL database
-- File: migrations/add_email_aliases.sql

-- Create email_aliases table
CREATE TABLE IF NOT EXISTS email_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES email_senders(id) ON DELETE CASCADE,
  alias_email TEXT NOT NULL,
  alias_name TEXT,
  is_verified BOOLEAN DEFAULT false,
  verification_method TEXT DEFAULT 'manual',
  dns_spf_valid BOOLEAN DEFAULT null,
  dns_dkim_valid BOOLEAN DEFAULT null,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sender_id, alias_email)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_aliases_sender_id
ON email_aliases(sender_id);

CREATE INDEX IF NOT EXISTS idx_email_aliases_alias_email
ON email_aliases(alias_email);

CREATE INDEX IF NOT EXISTS idx_email_aliases_is_verified
ON email_aliases(is_verified) WHERE is_verified = true;

-- Add from_alias_id to email_queue for tracking
ALTER TABLE email_queue
ADD COLUMN IF NOT EXISTS from_alias_id UUID REFERENCES email_aliases(id);

-- Create default aliases for existing senders
INSERT INTO email_aliases (sender_id, alias_email, alias_name, is_verified, verification_method)
SELECT
  id,
  email,
  name,
  true,
  'auto_main_email'
FROM email_senders
WHERE NOT EXISTS (
  SELECT 1 FROM email_aliases
  WHERE email_aliases.sender_id = email_senders.id
  AND email_aliases.alias_email = email_senders.email
);

COMMIT;

-- Verify migration
SELECT 'Migration completed!' as status;
SELECT COUNT(*) as default_aliases_created FROM email_aliases WHERE verification_method = 'auto_main_email';
