/**
 * Dependency Activator Service
 *
 * Manages activation of dependent emails in a sequence when a parent email is sent.
 * Handles schedule recalculation based on actual send time vs planned time.
 */

import { executeQuery, dbPool } from '@/lib/db/postgres';
import { calculateOptimalSchedule } from '@/lib/schedule/timezone-calculator';

export interface ActivationResult {
  activated_count: number;
  failed_count: number;
  activations: Array<{
    queue_id: string;
    old_scheduled_at: string;
    new_scheduled_at: string;
    gap_days: number;
  }>;
}

/**
 * Activate dependent emails after a parent email is successfully sent
 *
 * This function:
 * 1. Finds all emails waiting on the sent email
 * 2. Recalculates their schedules based on actual send time
 * 3. Applies timezone validations
 * 4. Updates them to ready_to_send status
 */
export async function activateDependentEmails(
  sentEmailId: string,
  sentAt: Date
): Promise<ActivationResult> {
  const client = await dbPool.connect();

  try {
    let activatedCount = 0;
    let failedCount = 0;
    const activations: Array<{
      queue_id: string;
      old_scheduled_at: string;
      new_scheduled_at: string;
      gap_days: number;
    }> = [];

    await client.query('BEGIN');

    // 1. Get the sent email details for context
    const sentEmailResult = await client.query(
      'SELECT * FROM email_queue WHERE id = $1',
      [sentEmailId]
    );

    if (sentEmailResult.rows.length === 0) {
      throw new Error(`Sent email ${sentEmailId} not found`);
    }

    const sentEmail = sentEmailResult.rows[0];

    // 2. Find all dependent emails (waiting on this one)
    const dependentsResult = await client.query(
      `SELECT * FROM email_queue
       WHERE depends_on_email_id = $1
       AND status IN ('dependency_pending', 'scheduled')
       ORDER BY sequence_position ASC`,
      [sentEmailId]
    );

    const dependents = dependentsResult.rows;

    if (dependents.length === 0) {
      await client.query('COMMIT');
      return {
        activated_count: 0,
        failed_count: 0,
        activations: []
      };
    }

    // 3. For each dependent, recalculate schedule
    for (const dependent of dependents) {
      try {
        // Get gap days from campaign template or sequence
        const gapDays = await getGapDaysForSequence(
          client,
          dependent.campaign_id,
          dependent.sequence_position
        );

        // Calculate new schedule based on actual send time
        const schedule = await calculateOptimalSchedule({
          recipient_country: dependent.country_code || 'US',
          recipient_timezone: dependent.recipient_timezone || 'UTC',
          base_time: sentAt.toISOString(), // Use ACTUAL send time
          gap_days: gapDays,
          send_time: '10:00' // Default, could be made configurable
        });

        // Store old schedule for logging
        const oldScheduledAt = dependent.adjusted_scheduled_at || dependent.scheduled_at;

        // Update dependent email
        await client.query(
          `UPDATE email_queue
           SET status = 'ready_to_send',
               dependency_satisfied = TRUE,
               adjusted_scheduled_at = $1,
               original_scheduled_at = $2,
               adjustment_reason = COALESCE(adjustment_reason, '[]'::jsonb) || $3::jsonb,
               updated_at = NOW()
           WHERE id = $4`,
          [
            schedule.adjusted_scheduled_at,
            oldScheduledAt,
            JSON.stringify([{
              type: 'dependency_activation',
              reason: `Activated based on parent email ${sentEmailId} sent at ${sentAt.toISOString()}`,
              parent_send_time: sentAt.toISOString(),
              gap_days: gapDays,
              previous_schedule: oldScheduledAt,
              new_schedule: schedule.adjusted_scheduled_at,
              adjustments: schedule.adjustments || [],
              timestamp: new Date().toISOString()
            }]),
            dependent.id
          ]
        );

        activatedCount++;
        activations.push({
          queue_id: dependent.id,
          old_scheduled_at: oldScheduledAt,
          new_scheduled_at: schedule.adjusted_scheduled_at,
          gap_days: gapDays
        });
      } catch (error) {
        console.error(`Error activating dependent email ${dependent.id}:`, error);
        failedCount++;

        // Mark as failed for review
        await client.query(
          `UPDATE email_queue
           SET status = 'failed',
               error_message = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [`Dependency activation failed: ${error}`, dependent.id]
        );
      }
    }

    await client.query('COMMIT');

    return {
      activated_count: activatedCount,
      failed_count: failedCount,
      activations
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get gap days for a specific sequence position
 *
 * This would typically come from a campaign template or sequence configuration
 * For now, we'll use a default of 3 days
 */
async function getGapDaysForSequence(
  client: any,
  campaignId: string,
  sequencePosition: number
): Promise<number> {
  try {
    // Try to get gap from campaign templates table
    const templateResult = await client.query(
      `SELECT gap_days FROM email_templates
       WHERE id = (
         SELECT template_id FROM campaigns WHERE id = $1
       )
       AND sequence_position = $2`,
      [campaignId, sequencePosition]
    );

    if (templateResult.rows.length > 0) {
      return templateResult.rows[0].gap_days || 3;
    }

    // Default gap of 3 days
    return 3;
  } catch (error) {
    console.error('Error getting gap days:', error);
    return 3; // Default
  }
}

/**
 * Find all emails in a dependency chain
 *
 * Useful for debugging and visualization
 */
export async function getDependencyChain(rootEmailId: string): Promise<any[]> {
  try {
    const result = await executeQuery(
      `WITH RECURSIVE chain AS (
        -- Start with root email
        SELECT *,
               0 as level,
               ARRAY[id] as path
        FROM email_queue
        WHERE id = $1

        UNION ALL

        -- Find dependents
        SELECT q.*,
               c.level + 1,
               c.path || q.id
        FROM email_queue q
        JOIN chain c ON q.depends_on_email_id = c.id
        WHERE NOT q.id = ANY(c.path) -- Prevent cycles
      )
      SELECT * FROM chain
      ORDER BY level, sequence_position`,
      [rootEmailId]
    );

    return result;
  } catch (error) {
    console.error('Error getting dependency chain:', error);
    return [];
  }
}

/**
 * Cancel all dependent emails when a parent fails
 *
 * This creates a cascade cancellation effect
 */
export async function cancelDependentEmails(parentEmailId: string, reason: string): Promise<number> {
  try {
    // First, find all direct dependents
    const dependents = await executeQuery(
      `SELECT id FROM email_queue
       WHERE depends_on_email_id = $1
       AND status IN ('dependency_pending', 'scheduled', 'ready_to_send')`,
      [parentEmailId]
    );

    let cancelledCount = 0;

    for (const dependent of dependents) {
      // Mark as cancelled
      await executeQuery(
        `UPDATE email_queue
         SET status = 'cancelled',
             error_message = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [`Cancelled due to parent failure: ${reason}`, dependent.id]
      );

      cancelledCount++;

      // Recursively cancel their dependents
      cancelledCount += await cancelDependentEmails(dependent.id, reason);
    }

    return cancelledCount;
  } catch (error) {
    console.error('Error cancelling dependent emails:', error);
    return 0;
  }
}

/**
 * Get statistics about dependency chains
 */
export async function getDependencyStats(campaignId: string): Promise<{
  total_chains: number;
  pending_activations: number;
  stuck_chains: number;
}> {
  try {
    // Count chains (emails with dependents)
    const chainsResult = await executeQuery(
      `SELECT COUNT(DISTINCT depends_on_email_id) as count
       FROM email_queue
       WHERE campaign_id = $1
       AND depends_on_email_id IS NOT NULL`,
      [campaignId]
    );

    // Count pending activations
    const pendingResult = await executeQuery(
      `SELECT COUNT(*) as count
       FROM email_queue
       WHERE campaign_id = $1
       AND dependency_satisfied = FALSE
       AND status IN ('dependency_pending', 'scheduled')`,
      [campaignId]
    );

    // Count stuck chains (parent failed but children still waiting)
    const stuckResult = await executeQuery(
      `SELECT COUNT(*) as count
       FROM email_queue q
       JOIN email_queue parent ON q.depends_on_email_id = parent.id
       WHERE q.campaign_id = $1
       AND parent.status = 'failed'
       AND q.status IN ('dependency_pending', 'scheduled', 'ready_to_send')`,
      [campaignId]
    );

    return {
      total_chains: parseInt(chainsResult[0]?.count || '0'),
      pending_activations: parseInt(pendingResult[0]?.count || '0'),
      stuck_chains: parseInt(stuckResult[0]?.count || '0')
    };
  } catch (error) {
    console.error('Error getting dependency stats:', error);
    return { total_chains: 0, pending_activations: 0, stuck_chains: 0 };
  }
}
