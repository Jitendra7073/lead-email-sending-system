-- ============================================
-- Email Sequences Management System Schema
-- ============================================

-- Main sequences table
CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sequence items table (templates within sequences)
CREATE TABLE IF NOT EXISTS email_sequence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sequence_id, position)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_sequences_is_active ON email_sequences(is_active);
CREATE INDEX IF NOT EXISTS idx_email_sequences_created_at ON email_sequences(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_sequence_items_sequence_id ON email_sequence_items(sequence_id);
CREATE INDEX IF NOT EXISTS idx_email_sequence_items_template_id ON email_sequence_items(template_id);
CREATE INDEX IF NOT EXISTS idx_email_sequence_items_position ON email_sequence_items(sequence_id, position);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_email_sequences_updated_at
  BEFORE UPDATE ON email_sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_sequence_items_updated_at
  BEFORE UPDATE ON email_sequence_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE email_sequences IS 'Stores email sequences (campaigns with ordered templates)';
COMMENT ON TABLE email_sequence_items IS 'Stores individual templates within sequences with order and delay settings';
COMMENT ON COLUMN email_sequence_items.delay_days IS 'Days to wait before sending this email after the previous one';
COMMENT ON COLUMN email_sequence_items.delay_hours IS 'Hours to wait before sending this email after the previous one';
