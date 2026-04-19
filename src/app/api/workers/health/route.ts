import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { workerLogger } from '@/lib/workers/worker-logger';
import { getDependencyStats } from '@/lib/queue/dependency-activator';

/**
 * Worker Health Check Endpoint
 *
 * Provides monitoring and diagnostics for the queue processing worker.
 * Returns:
 * - Last run time and status
 * - Processing metrics
 * - Queue depth and health indicators
 * - Error rates and patterns
 */

export async function GET(request: Request) {
  try {
    const now = new Date();
    const metrics = workerLogger.getCurrentMetrics();

    // 1. Get queue statistics
    const queueStats = await getQueueStats();

    // 2. Get last run information
    const lastRunInfo = await getLastRunInfo();

    // 3. Calculate health indicators
    const healthIndicators = calculateHealthIndicators(queueStats, lastRunInfo, metrics);

    // 4. Get recent error patterns (last hour)
    const recentErrors = await getRecentErrors();

    // 5. Get dependency chain statistics
    const dependencyStats = await getOverallDependencyStats();

    return NextResponse.json({
      status: 'healthy',
      timestamp: now.toISOString(),
      health_indicators: healthIndicators,
      queue_stats: queueStats,
      last_run: lastRunInfo,
      current_run_metrics: metrics,
      recent_errors: recentErrors,
      dependency_stats: dependencyStats,
      system_info: {
        uptime_seconds: process.uptime(),
        memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024,
        node_version: process.version
      }
    });

  } catch (error: any) {
    console.error('Health check error:', error);

    return NextResponse.json({
      status: 'failing',
      timestamp: new Date().toISOString(),
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Get comprehensive queue statistics
 */
async function getQueueStats() {
  try {
    const stats = await executeQuery(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'ready_to_send') as ready_to_send,
        COUNT(*) FILTER (WHERE status = 'sending') as sending,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE status = 'dependency_pending') as dependency_pending,
        COUNT(*) FILTER (WHERE status = 'paused') as paused,
        COUNT(*) as total,
        AVG(CASE WHEN sent_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (sent_at - created_at))
        END) as avg_age_seconds
      FROM email_queue
    `);

    return stats[0] || {};
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return {};
  }
}

/**
 * Get last run information from worker logs
 */
async function getLastRunInfo() {
  try {
    const result = await executeQuery(`
      SELECT
        timestamp,
        message,
        metadata
      FROM worker_logs
      WHERE category = 'worker'
      AND message LIKE '%Queue processing run %'
      ORDER BY timestamp DESC
      LIMIT 2
    `);

    if (result.length === 0) {
      return {
        last_run_time: null,
        time_since_last_run_minutes: null,
        last_run_status: 'never_run'
      };
    }

    const lastRun = result[0];
    const lastRunTime = new Date(lastRun.timestamp);
    const timeSinceLastRun = Date.now() - lastRunTime.getTime();
    const timeSinceLastRunMinutes = Math.round(timeSinceLastRun / (1000 * 60));

    let status = 'completed';
    if (result.length > 1) {
      const previousRun = result[1];
      if (previousRun.message.includes('started')) {
        status = 'completed';
      }
    }

    return {
      last_run_time: lastRunTime.toISOString(),
      time_since_last_run_minutes: timeSinceLastRunMinutes,
      last_run_status: status,
      last_run_message: lastRun.message
    };
  } catch (error) {
    console.error('Error getting last run info:', error);
    return {
      last_run_time: null,
      time_since_last_run_minutes: null,
      last_run_status: 'error'
    };
  }
}

/**
 * Calculate health indicators based on various metrics
 */
function calculateHealthIndicators(queueStats: any, lastRunInfo: any, metrics: any) {
  const indicators = {
    overall_status: 'healthy' as 'healthy' | 'degraded' | 'failing',
    issues: [] as string[],
    warnings: [] as string[]
  };

  // Check 1: Queue depth (too many ready_to_send emails)
  const readyToSend = parseInt(queueStats.ready_to_send || '0');
  if (readyToSend > 100) {
    indicators.issues.push('High queue depth: ' + readyToSend + ' emails ready to send');
    indicators.overall_status = 'degraded';
  } else if (readyToSend > 50) {
    indicators.warnings.push('Moderate queue depth: ' + readyToSend + ' emails ready to send');
  }

  // Check 2: Last run time (should run every minute)
  const timeSinceLastRun = lastRunInfo.time_since_last_run_minutes;
  if (timeSinceLastRun === null) {
    indicators.issues.push('Worker has never run');
    indicators.overall_status = 'failing';
  } else if (timeSinceLastRun > 5) {
    indicators.issues.push('Worker not running: last run ' + timeSinceLastRun + ' minutes ago');
    indicators.overall_status = 'failing';
  } else if (timeSinceLastRun > 2) {
    indicators.warnings.push('Worker delayed: last run ' + timeSinceLastRun + ' minutes ago');
    indicators.overall_status = 'degraded';
  }

  // Check 3: Error rate
  if (metrics) {
    const totalProcessed = metrics.sent_count + metrics.failed_count;
    if (totalProcessed > 0) {
      const errorRate = metrics.failed_count / totalProcessed;
      if (errorRate > 0.5) {
        indicators.issues.push('High error rate: ' + Math.round(errorRate * 100) + '%');
        indicators.overall_status = 'failing';
      } else if (errorRate > 0.2) {
        indicators.warnings.push('Elevated error rate: ' + Math.round(errorRate * 100) + '%');
        indicators.overall_status = 'degraded';
      }
    }
  }

  // Check 4: Stuck emails (in sending state too long)
  const sendingCount = parseInt(queueStats.sending || '0');
  if (sendingCount > 10) {
    indicators.issues.push('Possible stuck emails: ' + sendingCount + ' in sending state');
    indicators.overall_status = 'degraded';
  }

  return indicators;
}

/**
 * Get recent error patterns
 */
async function getRecentErrors() {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const errors = await executeQuery(`
      SELECT
        message,
        COUNT(*) as count
      FROM worker_logs
      WHERE timestamp >= $1
      AND level = 'error'
      GROUP BY message
      ORDER BY count DESC
      LIMIT 10
    `, [oneHourAgo.toISOString()]);

    return errors;
  } catch (error) {
    console.error('Error getting recent errors:', error);
    return [];
  }
}

/**
 * Get overall dependency chain statistics
 */
async function getOverallDependencyStats() {
  try {
    // Get stats for all active campaigns
    const result = await executeQuery(`
      SELECT
        c.id as campaign_id,
        c.name as campaign_name,
        COUNT(DISTINCT q.depends_on_queue_id) as total_chains,
        COUNT(*) FILTER (WHERE q.dependency_satisfied = FALSE) as pending_activations,
        COUNT(*) FILTER (
          q.status IN ('dependency_pending', 'scheduled', 'ready_to_send')
          AND parent_q.status = 'failed'
        ) as stuck_chains
      FROM campaigns c
      LEFT JOIN email_queue q ON q.campaign_id = c.id
      LEFT JOIN email_queue parent_q ON q.depends_on_queue_id = parent_q.id
      WHERE c.status IN ('running', 'paused')
      GROUP BY c.id, c.name
    `);

    return result;
  } catch (error) {
    console.error('Error getting dependency stats:', error);
    return [];
  }
}
