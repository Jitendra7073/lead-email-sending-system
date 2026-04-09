-- ============================================================
-- CATCH-UP MIGRATION: Run all pending migrations in order
-- Execute this file in your PostgreSQL / Supabase SQL editor
-- ============================================================

-- ----------------------------------------------------------------
-- MIGRATION 1: Add message_id to email_queue (reply tracking)
-- Source: add_message_id_tracking.sql
-- ----------------------------------------------------------------
ALTER TABLE email_queue
  ADD COLUMN IF NOT EXISTS message_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_email_queue_message_id ON email_queue(message_id);

COMMENT ON COLUMN email_queue.message_id IS 'Unique Message-ID header for tracking email replies';

-- ----------------------------------------------------------------
-- MIGRATION 2: Ensure email_replies table exists (with full schema)
-- Source: reply-tracker.ts ensureReplyTable()
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID REFERENCES email_queue(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  reply_message_id TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT NOT NULL,
  body TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  thread_id TEXT,
  in_reply_to TEXT,
  is_reply BOOLEAN DEFAULT true,
  CONSTRAINT unique_reply_msg_id UNIQUE (reply_message_id)
);

CREATE INDEX IF NOT EXISTS idx_email_replies_queue_id ON email_replies(queue_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_reply_message_id ON email_replies(reply_message_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_in_reply_to ON email_replies(in_reply_to);

-- ----------------------------------------------------------------
-- MIGRATION 3: Add recipient_email & original_subject to email_replies
-- Required by check-replies route INSERT statement
-- Source: add_email_replies_extra_columns.sql
-- ----------------------------------------------------------------
ALTER TABLE email_replies
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS original_subject TEXT;

CREATE INDEX IF NOT EXISTS idx_email_replies_recipient_email ON email_replies(recipient_email);

COMMENT ON COLUMN email_replies.recipient_email IS 'The email address of the original recipient';
COMMENT ON COLUMN email_replies.original_subject IS 'Subject of the original sent email';
