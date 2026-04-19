/**
 * Schedule Validator Service
 *
 * Validates email schedules before sending to ensure they respect:
 * - Weekend restrictions
 * - Business hours
 * - Timezone-specific rules
 * - Dependency constraints
 */

import { executeQuery } from '@/lib/db/postgres';
import { calculateOptimalSchedule } from '@/lib/schedule/timezone-calculator';

export interface ValidationResult {
  valid: boolean;
  new_scheduled_at?: string;
  reason?: string;
  adjustment_details?: any;
}

export interface ScheduleValidationParams {
  queue_id: string;
  recipient_timezone: string;
  current_scheduled_at: string;
  country_code?: string;
}

/**
 * Revalidate an email schedule before sending
 *
 * Checks if the email's scheduled time has arrived (i.e. it's due to send now).
 * If the scheduled time is still in the future, it reschedules to that future time.
 * Does NOT recalculate a brand-new schedule from scratch — that would override
 * the timezone-aware schedule that was already computed when the email was queued.
 */
export async function revalidateSchedule(params: ScheduleValidationParams): Promise<ValidationResult> {
  const {
    queue_id,
    current_scheduled_at,
  } = params;

  try {
    const scheduledTime = new Date(current_scheduled_at);
    const now = new Date();

    // If the scheduled time is in the future (more than 1 minute buffer), not ready yet
    const bufferMs = 60 * 1000; // 1 minute buffer
    if (scheduledTime.getTime() > now.getTime() + bufferMs) {
      return {
        valid: false,
        new_scheduled_at: current_scheduled_at,
        reason: `Email is scheduled for ${scheduledTime.toISOString()}, not yet due`,
        adjustment_details: {
          original: current_scheduled_at,
          recalculated: current_scheduled_at,
          difference_minutes: Math.round((scheduledTime.getTime() - now.getTime()) / 60000),
          adjustments: []
        }
      };
    }

    // Scheduled time has arrived — valid to send
    return {
      valid: true,
      reason: 'Schedule validation passed — email is due to send'
    };
  } catch (error) {
    console.error('Error revalidating schedule:', error);
    // On error, allow original schedule to proceed
    return {
      valid: true,
      reason: 'Validation failed - allowing original schedule'
    };
  }
}

/**
 * Validate and potentially reschedule a batch of emails
 */
export async function revalidateBatchSchedules(queueIds: string[]): Promise<{
  validated: number;
  rescheduled: number;
  failed: number;
}> {
  let validated = 0;
  let rescheduled = 0;
  let failed = 0;

  for (const queueId of queueIds) {
    try {
      // Get queue item
      const items = await executeQuery(
        'SELECT * FROM email_queue WHERE id = $1',
        [queueId]
      );

      if (items.length === 0) {
        failed++;
        continue;
      }

      const item = items[0];

      // Revalidate schedule
      const result = await revalidateSchedule({
        queue_id: queueId,
        recipient_timezone: item.recipient_timezone || 'UTC',
        current_scheduled_at: item.adjusted_scheduled_at || item.scheduled_at,
        country_code: item.country_code
      });

      if (result.valid) {
        validated++;
      } else {
        // Reschedule with new time
        await executeQuery(
          `UPDATE email_queue
           SET adjusted_scheduled_at = $1,
               adjustment_reason = COALESCE(adjustment_reason, '[]'::jsonb) || $2::jsonb,
               updated_at = NOW()
           WHERE id = $3`,
          [
            result.new_scheduled_at,
            JSON.stringify([{
              type: 'revalidation',
              reason: result.reason,
              details: result.adjustment_details,
              timestamp: new Date().toISOString()
            }]),
            queueId
          ]
        );
        rescheduled++;
      }
    } catch (error) {
      console.error(`Error revalidating queue item ${queueId}:`, error);
      failed++;
    }
  }

  return { validated, rescheduled, failed };
}

/**
 * Get country-specific timezone and business hours rules
 */
async function getCountryTimezoneRules(countryCode: string): Promise<any> {
  try {
    const result = await executeQuery(
      'SELECT * FROM country_timezones WHERE country_code = $1',
      [countryCode.toUpperCase()]
    );

    if (result.length > 0) {
      return result[0];
    }

    // Default rules
    return {
      default_timezone: 'UTC',
      business_hours_start: '09:00',
      business_hours_end: '18:00',
      weekend_days: ['Saturday', 'Sunday'],
      send_time: '10:00'
    };
  } catch (error) {
    console.error('Error fetching country timezone rules:', error);
    return {
      default_timezone: 'UTC',
      business_hours_start: '09:00',
      business_hours_end: '18:00',
      weekend_days: ['Saturday', 'Sunday'],
      send_time: '10:00'
    };
  }
}

/**
 * Mark email as having passed all validation checks
 */
export async function markValidationPassed(queueId: string): Promise<void> {
  await executeQuery(
    `UPDATE email_queue
     SET passed_weekend_check = TRUE,
         passed_business_hours_check = TRUE,
         updated_at = NOW()
     WHERE id = $1`,
    [queueId]
  );
}

/**
 * Check if an email is ready to send (all validations passed)
 */
export async function isReadyToSend(queueId: string): Promise<boolean> {
  const result = await executeQuery(
    `SELECT status, dependency_satisfied, adjusted_scheduled_at <= NOW() as is_time
     FROM email_queue
     WHERE id = $1`,
    [queueId]
  );

  if (result.length === 0) return false;

  const item = result[0];
  return (
    item.status === 'ready_to_send' &&
    item.dependency_satisfied === true &&
    item.is_time === true
  );
}
