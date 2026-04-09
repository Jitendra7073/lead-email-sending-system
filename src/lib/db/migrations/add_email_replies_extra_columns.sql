-- Add missing columns to email_replies table
-- Required by check-replies route which inserts recipient_email and original_subject

ALTER TABLE email_replies
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS original_subject TEXT;

-- Index for faster lookups by recipient email
CREATE INDEX IF NOT EXISTS idx_email_replies_recipient_email ON email_replies(recipient_email);

-- Comments
COMMENT ON COLUMN email_replies.recipient_email IS 'The email address of the original recipient';
COMMENT ON COLUMN email_replies.original_subject IS 'Subject of the original sent email';
