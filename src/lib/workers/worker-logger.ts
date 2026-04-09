/**
 * Worker Logger
 *
 * Structured logging for queue processing operations.
 * Provides categorized logging with performance metrics and error tracking.
 */

import { executeQuery } from '@/lib/db/postgres';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'debug';
  category: string;
  message: string;
  metadata?: any;
}

export interface WorkerMetrics {
  start_time: string;
  end_time?: string;
  processed_count: number;
  sent_count: number;
  failed_count: number;
  rescheduled_count: number;
  validated_count: number;
  activation_count: number;
  average_processing_time_ms: number;
  errors: Array<{
    queue_id: string;
    error: string;
    timestamp: string;
  }>;
}

class WorkerLogger {
  private currentRun: WorkerMetrics | null = null;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Flush logs every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000);
  }

  /**
   * Start a new worker run
   */
  startRun(): void {
    this.currentRun = {
      start_time: new Date().toISOString(),
      processed_count: 0,
      sent_count: 0,
      failed_count: 0,
      rescheduled_count: 0,
      validated_count: 0,
      activation_count: 0,
      average_processing_time_ms: 0,
      errors: []
    };

    this.log('info', 'worker', 'Queue processing run started', {
      start_time: this.currentRun.start_time
    });
  }

  /**
   * End current worker run and generate summary
   */
  endRun(): void {
    if (!this.currentRun) return;

    this.currentRun.end_time = new Date().toISOString();

    const duration = new Date(this.currentRun.end_time).getTime() -
                    new Date(this.currentRun.start_time).getTime();

    this.log('info', 'worker', 'Queue processing run completed', {
      duration_seconds: Math.round(duration / 1000),
      processed_count: this.currentRun.processed_count,
      sent_count: this.currentRun.sent_count,
      failed_count: this.currentRun.failed_count,
      rescheduled_count: this.currentRun.rescheduled_count,
      validated_count: this.currentRun.validated_count,
      activation_count: this.currentRun.activation_count,
      average_processing_time_ms: this.currentRun.average_processing_time_ms,
      error_count: this.currentRun.errors.length
    });

    // Flush remaining logs
    this.flush();

    // Clear current run
    this.currentRun = null;
  }

  /**
   * Log a processing event
   */
  logProcessing(
    queueId: string,
    action: string,
    metadata?: any
  ): void {
    this.log('info', 'processing', `[${queueId}] ${action}`, metadata);
    this.incrementMetric('processed_count');
  }

  /**
   * Log a validation event
   */
  logValidation(
    queueId: string,
    valid: boolean,
    metadata?: any
  ): void {
    const level = valid ? 'success' : 'warning';
    this.log(level, 'validation', `[${queueId}] Schedule ${valid ? 'validated' : 'rescheduled'}`, metadata);

    if (valid) {
      this.incrementMetric('validated_count');
    }
  }

  /**
   * Log a send attempt
   */
  logSendAttempt(
    queueId: string,
    success: boolean,
    metadata?: any
  ): void {
    const level = success ? 'success' : 'error';
    this.log(level, 'send', `[${queueId}] Send ${success ? 'succeeded' : 'failed'}`, metadata);

    if (success) {
      this.incrementMetric('sent_count');
    } else {
      this.incrementMetric('failed_count');
      if (this.currentRun && metadata?.error) {
        this.currentRun.errors.push({
          queue_id: queueId,
          error: metadata.error,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Log a dependency activation event
   */
  logActivation(
    parentQueueId: string,
    activatedCount: number,
    metadata?: any
  ): void {
    this.log('success', 'activation', `[${parentQueueId}] Activated ${activatedCount} dependent emails`, metadata);
    this.currentRun && (this.currentRun.activation_count += activatedCount);
  }

  /**
   * Log a reschedule event
   */
  logReschedule(
    queueId: string,
    reason: string,
    newTime: string,
    metadata?: any
  ): void {
    this.log('warning', 'reschedule', `[${queueId}] Rescheduled: ${reason}`, {
      new_scheduled_at: newTime,
      ...metadata
    });
    this.incrementMetric('rescheduled_count');
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    queueId: string,
    processingTimeMs: number,
    breakdown?: {
      validation_ms?: number;
      send_ms?: number;
      activation_ms?: number;
    }
  ): void {
    this.log('debug', 'performance', `[${queueId}] Processing time: ${processingTimeMs}ms`, breakdown);

    // Update average
    if (this.currentRun) {
      const total = this.currentRun.average_processing_time_ms * (this.currentRun.processed_count - 1);
      this.currentRun.average_processing_time_ms = (total + processingTimeMs) / this.currentRun.processed_count;
    }
  }

  /**
   * Log an error
   */
  logError(
    queueId: string,
    error: string,
    metadata?: any
  ): void {
    this.log('error', 'error', `[${queueId}] ${error}`, metadata);

    if (this.currentRun) {
      this.currentRun.errors.push({
        queue_id: queueId,
        error: error,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Generic log method
   */
  log(
    level: 'info' | 'success' | 'warning' | 'error' | 'debug',
    category: string,
    message: string,
    metadata?: any
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      metadata
    };

    this.logBuffer.push(entry);

    // Also log to console for immediate visibility
    const consoleLevel = level === 'error' ? 'error' :
                        level === 'warning' ? 'warn' :
                        level === 'success' ? 'log' : 'log';
    console[consoleLevel](`[${category.toUpperCase()}] ${message}`, metadata || '');
  }

  /**
   * Increment a metric counter
   */
  private incrementMetric(metric: keyof WorkerMetrics): void {
    if (this.currentRun && typeof this.currentRun[metric] === 'number') {
      (this.currentRun[metric] as number)++;
    }
  }

  /**
   * Flush buffered logs to database
   */
  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Insert logs into worker_logs table
      // Note: This table needs to be created separately
      for (const log of logsToFlush) {
        await executeQuery(
          `INSERT INTO worker_logs (
            timestamp,
            level,
            category,
            message,
            metadata
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            log.timestamp,
            log.level,
            log.category,
            log.message,
            JSON.stringify(log.metadata || {})
          ]
        );
      }
    } catch (error) {
      console.error('Error flushing logs to database:', error);
      // Logs are lost if DB insert fails - could add retry logic here
    }
  }

  /**
   * Get current run metrics
   */
  getCurrentMetrics(): WorkerMetrics | null {
    return this.currentRun;
  }

  /**
   * Generate daily summary report
   */
  async generateDailySummary(date: Date = new Date()): Promise<any> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get logs from database
      const logs = await executeQuery(
        `SELECT
          level,
          category,
          COUNT(*) as count
         FROM worker_logs
         WHERE timestamp >= $1
         AND timestamp <= $2
         GROUP BY level, category
         ORDER BY category, level`,
        [startOfDay.toISOString(), endOfDay.toISOString()]
      );

      // Get error details
      const errors = await executeQuery(
        `SELECT
          message,
          metadata,
          COUNT(*) as count
         FROM worker_logs
         WHERE timestamp >= $1
         AND timestamp <= $2
         AND level = 'error'
         GROUP BY message, metadata
         ORDER BY count DESC
         LIMIT 10`,
        [startOfDay.toISOString(), endOfDay.toISOString()]
      );

      return {
        date: date.toISOString().split('T')[0],
        summary: logs,
        top_errors: errors,
        total_logs: logs.reduce((sum: number, log: any) => sum + parseInt(log.count), 0)
      };
    } catch (error) {
      console.error('Error generating daily summary:', error);
      return null;
    }
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }
}

// Singleton instance
export const workerLogger = new WorkerLogger();

// Ensure cleanup on process exit
process.on('exit', () => {
  workerLogger.destroy();
});

process.on('SIGINT', () => {
  workerLogger.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  workerLogger.destroy();
  process.exit(0);
});
