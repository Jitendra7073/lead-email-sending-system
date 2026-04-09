-- ============================================
-- WORKER LOGS TABLE MIGRATION
-- ============================================
-- This migration adds a worker_logs table for
-- structured logging of queue processing operations

-- ============================================
-- STEP 1: Create worker_logs table
-- ============================================

CREATE TABLE IF NOT EXISTS worker_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level VARCHAR(20) NOT NULL CHECK (level IN ('info', 'success', 'warning', 'error', 'debug')),
  category VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_worker_logs_timestamp ON worker_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_worker_logs_level ON worker_logs(level);
CREATE INDEX IF NOT EXISTS idx_worker_logs_category ON worker_logs(category);
CREATE INDEX IF NOT EXISTS idx_worker_logs_timestamp_category ON worker_logs(timestamp DESC, category);

-- Add comments for documentation
COMMENT ON TABLE worker_logs IS 'Structured logs from queue processing worker';
COMMENT ON COLUMN worker_logs.timestamp IS 'When the log entry was created';
COMMENT ON COLUMN worker_logs.level IS 'Log level: info, success, warning, error, debug';
COMMENT ON COLUMN worker_logs.category IS 'Log category: worker, processing, validation, send, activation, reschedule, performance, error';
COMMENT ON COLUMN worker_logs.message IS 'Log message text';
COMMENT ON COLUMN worker_logs.metadata IS 'Additional structured data (JSON)';

-- ============================================
-- STEP 2: Create function to cleanup old logs
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_worker_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete logs older than specified days
  DELETE FROM worker_logs
  WHERE timestamp < NOW() - (days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the cleanup (if we still have logs)
  INSERT INTO worker_logs (level, category, message, metadata)
  VALUES ('info', 'system', 'Cleaned up old worker logs',
          jsonb_build_object(
            'days_kept', days_to_keep,
            'deleted_count', deleted_count,
            'cleanup_timestamp', NOW()
          ));

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION cleanup_old_worker_logs IS 'Cleanup worker logs older than specified days (default: 30)';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify migration
DO $$
DECLARE
  table_exists BOOLEAN;
  index_count INTEGER;
BEGIN
  -- Check table exists
  SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'worker_logs')
  INTO table_exists;

  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'worker_logs';

  RAISE NOTICE 'Migration verification:';
  RAISE NOTICE '- worker_logs table exists: % (expected: true)', table_exists;
  RAISE NOTICE '- Indexes created: % (expected: 4)', index_count;

  IF table_exists AND index_count >= 4 THEN
    RAISE NOTICE '✅ MIGRATION SUCCESSFUL';
  ELSE
    RAISE EXCEPTION ' MIGRATION INCOMPLETE - Table or indexes missing';
  END IF;
END $$;
