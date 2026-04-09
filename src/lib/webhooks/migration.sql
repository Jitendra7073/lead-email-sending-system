-- Webhook System Database Migration
-- Run this in your PostgreSQL database to add webhook support

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Create index on event_type for faster queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON webhook_events(received_at);

-- Create email_send_log table if not exists
CREATE TABLE IF NOT EXISTS email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL,
  campaign_id UUID,
  sender_id UUID NOT NULL,
  contact_id UUID,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL,
  error_message TEXT,
  smtp_response TEXT,
  timezone TEXT,
  scheduled_adjusted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for email_send_log
CREATE INDEX IF NOT EXISTS idx_email_send_log_queue_id ON email_send_log(queue_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_campaign_id ON email_send_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_sender_id ON email_send_log(sender_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_status ON email_send_log(status);
CREATE INDEX IF NOT EXISTS idx_email_send_log_sent_at ON email_send_log(sent_at);

-- Add tracking columns to email_queue table if they don't exist
ALTER TABLE email_queue
  ADD COLUMN IF NOT EXISTS opened_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON TABLE webhook_events IS 'Stores all incoming webhook events for email system';
COMMENT ON TABLE email_send_log IS 'Comprehensive log of all email send attempts';

COMMENT ON COLUMN webhook_events.event_type IS 'Type of webhook event (email.sent, email.failed, etc.)';
COMMENT ON COLUMN webhook_events.payload IS 'Full webhook payload as JSON';
COMMENT ON COLUMN webhook_events.processed IS 'Whether the webhook has been processed';

COMMENT ON COLUMN email_send_log.queue_id IS 'Reference to email_queue entry';
COMMENT ON COLUMN email_send_log.status IS 'Status of send attempt (sent, failed, etc.)';
COMMENT ON COLUMN email_send_log.smtp_response IS 'SMTP server response message';
COMMENT ON COLUMN email_send_log.timezone IS 'Timezone used for scheduling';
