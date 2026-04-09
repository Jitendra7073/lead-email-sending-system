/**
 * Queue Status Manager
 *
 * Centralized status management for email queue items.
 * Provides consistent state transitions with proper logging and error handling.
 */

import { executeQuery, dbPool } from '@/lib/db/postgres';

export interface StatusTransition {
  queue_id: string;
  old_status: string;
  new_status: string;
  timestamp: string;
  reason?: string;
}

/**
 * Mark email as sending (prevents duplicate processing)
 */
export async function markAsSending(queueId: string): Promise<boolean> {
  try {
    const client = await dbPool.connect();

    try {
      // Use transaction with SELECT FOR UPDATE to prevent race conditions
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT status FROM email_queue
         WHERE id = $1
         FOR UPDATE`,
        [queueId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const currentStatus = result.rows[0].status;

      // Only allow transition from ready_to_send to sending
      if (currentStatus !== 'ready_to_send') {
        await client.query('ROLLBACK');
        console.log(`Email ${queueId} not in ready_to_send status (current: ${currentStatus})`);
        return false;
      }

      // Update status
      await client.query(
        `UPDATE email_queue
         SET status = 'sending',
             updated_at = NOW()
         WHERE id = $1`,
        [queueId]
      );

      await client.query('COMMIT');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error marking as sending:', error);
    return false;
  }
}

/**
 * Mark email as successfully sent
 */
export async function markAsSent(
  queueId: string,
  messageId: string,
  metadata?: {
    provider?: string;
    sent_from?: string;
  }
): Promise<void> {
  try {
    await executeQuery(
      `UPDATE email_queue
       SET status = 'sent',
           message_id = $2,
           sent_at = NOW(),
           error_message = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [queueId, messageId]
    );

    // Log the send event
    await executeQuery(
      `INSERT INTO email_send_log (
        queue_id,
        contact_id,
        contact_email,
        campaign_id,
        send_type,
        status,
        message_id,
        provider,
        sent_at,
        created_at
      ) SELECT
        $1,
        contact_id,
        recipient_email,
        campaign_id,
        'sequence_pos_' || sequence_position,
        'sent',
        $2,
        $3,
        NOW(),
        NOW()
      FROM email_queue
      WHERE id = $1`,
      [queueId, messageId, metadata?.provider || 'unknown']
    );
  } catch (error) {
    console.error('Error marking as sent:', error);
    throw error;
  }
}

/**
 * Mark email as failed with retry logic
 */
export async function markAsFailed(
  queueId: string,
  error: string,
  maxRetries: number = 3
): Promise<{
  is_fatal: boolean;
  attempts: number;
  new_status: string;
}> {
  try {
    const client = await dbPool.connect();

    try {
      await client.query('BEGIN');

      // Get current attempts
      const result = await client.query(
        'SELECT attempts FROM email_queue WHERE id = $1',
        [queueId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error(`Email ${queueId} not found`);
      }

      const currentAttempts = result.rows[0].attempts || 0;
      const newAttempts = currentAttempts + 1;
      const isFatal = newAttempts >= maxRetries;
      const newStatus = isFatal ? 'failed' : 'ready_to_send';

      // Update with retry backoff for non-fatal failures
      if (isFatal) {
        await client.query(
          `UPDATE email_queue
           SET status = $1,
               attempts = $2,
               error_message = $3,
               updated_at = NOW()
           WHERE id = $4`,
          [newStatus, newAttempts, error, queueId]
        );
      } else {
        // Calculate exponential backoff: 2^attempts minutes
        const backoffMinutes = Math.pow(2, newAttempts);
        const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

        await client.query(
          `UPDATE email_queue
           SET status = $1,
               attempts = $2,
               error_message = $3,
               adjusted_scheduled_at = $4,
               adjustment_reason = COALESCE(adjustment_reason, '[]'::jsonb) || $5::jsonb,
               updated_at = NOW()
           WHERE id = $6`,
          [
            newStatus,
            newAttempts,
            error,
            nextRetryAt.toISOString(),
            JSON.stringify([{
              type: 'retry_backoff',
              attempt: newAttempts,
              backoff_minutes: backoffMinutes,
              next_retry_at: nextRetryAt.toISOString(),
              timestamp: new Date().toISOString()
            }]),
            queueId
          ]
        );
      }

      await client.query('COMMIT');

      return {
        is_fatal: isFatal,
        attempts: newAttempts,
        new_status: newStatus
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error marking as failed:', error);
    throw error;
  }
}

/**
 * Cancel all dependent emails in a chain (cascade effect)
 */
export async function cancelDependentEmails(
  parentQueueId: string,
  reason: string
): Promise<number> {
  try {
    const client = await dbPool.connect();

    try {
      let cancelledCount = 0;

      await client.query('BEGIN');

      // Find all direct dependents
      const dependentsResult = await client.query(
        `SELECT id FROM email_queue
         WHERE depends_on_email_id = $1
         AND status IN ('dependency_pending', 'scheduled', 'ready_to_send')
         FOR UPDATE`,
        [parentQueueId]
      );

      const dependents = dependentsResult.rows;

      for (const dependent of dependents) {
        // Cancel this dependent
        await client.query(
          `UPDATE email_queue
           SET status = 'cancelled',
               error_message = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [`Cascade cancellation: ${reason}`, dependent.id]
        );

        cancelledCount++;

        // Recursively cancel their dependents
        cancelledCount += await cancelDependentEmails(dependent.id, reason);
      }

      await client.query('COMMIT');
      return cancelledCount;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error cancelling dependent emails:', error);
    return 0;
  }
}

/**
 * Reschedule an email to a new time
 */
export async function rescheduleEmail(
  queueId: string,
  newTime: Date,
  reason: string
): Promise<void> {
  try {
    await executeQuery(
      `UPDATE email_queue
       SET adjusted_scheduled_at = $1,
           adjustment_reason = COALESCE(adjustment_reason, '[]'::jsonb) || $2::jsonb,
           updated_at = NOW()
       WHERE id = $3`,
      [
        newTime.toISOString(),
        JSON.stringify([{
          type: 'manual_reschedule',
          reason: reason,
          previous_schedule: null, // Could fetch old value if needed
          new_schedule: newTime.toISOString(),
          timestamp: new Date().toISOString()
        }]),
        queueId
      ]
    );
  } catch (error) {
    console.error('Error rescheduling email:', error);
    throw error;
  }
}

/**
 * Pause an email (stop processing temporarily)
 */
export async function pauseEmail(queueId: string, reason?: string): Promise<void> {
  try {
    await executeQuery(
      `UPDATE email_queue
       SET status = 'paused',
           error_message = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [reason || 'Manually paused', queueId]
    );
  } catch (error) {
    console.error('Error pausing email:', error);
    throw error;
  }
}

/**
 * Resume a paused email
 */
export async function resumeEmail(queueId: string): Promise<void> {
  try {
    await executeQuery(
      `UPDATE email_queue
       SET status = 'ready_to_send',
           error_message = NULL,
           updated_at = NOW()
       WHERE id = $1
       AND status = 'paused'`,
      [queueId]
    );
  } catch (error) {
    console.error('Error resuming email:', error);
    throw error;
  }
}

/**
 * Get status transition history for debugging
 */
export async function getStatusHistory(queueId: string): Promise<StatusTransition[]> {
  try {
    // This would require a status_history table
    // For now, return basic info from email_queue
    const result = await executeQuery(
      `SELECT
        id as queue_id,
        status as new_status,
        created_at,
        updated_at as timestamp,
        error_message as reason
       FROM email_queue
       WHERE id = $1`,
      [queueId]
    );

    if (result.length === 0) return [];

    return [{
      queue_id: result[0].queue_id,
      old_status: 'unknown',
      new_status: result[0].new_status,
      timestamp: result[0].timestamp,
      reason: result[0].reason
    }];
  } catch (error) {
    console.error('Error getting status history:', error);
    return [];
  }
}

/**
 * Bulk update status for multiple emails (admin operation)
 */
export async function bulkUpdateStatus(
  queueIds: string[],
  newStatus: string,
  reason?: string
): Promise<{
  updated: number;
  failed: number;
}> {
  let updated = 0;
  let failed = 0;

  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    for (const queueId of queueIds) {
      try {
        await client.query(
          `UPDATE email_queue
           SET status = $1,
               error_message = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [newStatus, reason || '', queueId]
        );
        updated++;
      } catch (error) {
        console.error(`Error updating queue item ${queueId}:`, error);
        failed++;
      }
    }

    await client.query('COMMIT');
    return { updated, failed };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
