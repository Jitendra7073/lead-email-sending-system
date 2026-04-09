-- Add send_time column to email_sequence_items
-- This replaces delay_hours with a specific time of day

ALTER TABLE email_sequence_items ADD COLUMN IF NOT EXISTS send_time VARCHAR(10) DEFAULT '09:00';

-- Add comment for documentation
COMMENT ON COLUMN email_sequence_items.send_time IS 'Time of day to send this email (format: HH:MM)';
