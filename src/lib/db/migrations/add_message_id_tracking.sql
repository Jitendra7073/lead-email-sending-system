-- Add message_id column to email_queue table for reply tracking
ALTER TABLE email_queue
ADD COLUMN IF NOT EXISTS message_id TEXT UNIQUE;

-- Add index for faster lookups by message_id
CREATE INDEX IF NOT EXISTS idx_email_queue_message_id ON email_queue(message_id);

-- Comment for documentation
COMMENT ON COLUMN email_queue.message_id IS 'Unique Message-ID header for tracking email replies';