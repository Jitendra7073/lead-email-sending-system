/**
 * Queue Creator Helper
 *
 * Handles creation of individual queue entries with timezone validation
 * and dependency chain management
 */

import { calculateOptimalSchedule, calculateDependentSchedule, validateScheduleResult, formatScheduleLog } from '@/lib/schedule/schedule-calculator';
import { detectTimezone } from '@/lib/schedule/timezone-detector';

export interface QueueEntryParams {
  campaign_id: string;
  contact_id: string;
  recipient_email: string;
  recipient_country?: string;
  recipient_timezone?: string;
  template_id: string;
  subject: string;
  html_content: string;
  text_content?: string;
  sequence_position: number;
  gap_days?: number;
  previous_scheduled_at?: string;
  depends_on_queue_id?: string | null;
  idempotency_key: string;
  send_time?: string;
}

export interface QueueEntryResult {
  success: boolean;
  queue_item?: any;
  schedule_result?: any;
  validation_result?: { isValid: boolean; warnings: string[] };
  error?: string;
}

/**
 * Create a single queue entry with timezone validation
 */
export async function createQueueEntryWithValidation(params: QueueEntryParams): Promise<QueueEntryResult> {
  try {
    // 1. Detect timezone if not provided
    let timezone = params.recipient_timezone;
    let country = params.recipient_country;

    if (!timezone || !country) {
      const detection = await detectTimezone(
        params.recipient_email,
        undefined, // website - would need to be passed separately
        country
      );

      if (detection) {
        timezone = detection.timezone;
        country = detection.country_code;
      }
    }

    // 2. Calculate schedule based on position
    let scheduleResult;
    if (params.sequence_position === 1 || !params.previous_scheduled_at) {
      // First email - no dependency
      scheduleResult = await calculateOptimalSchedule({
        recipient_country: country || 'US',
        recipient_timezone: timezone,
        base_time: new Date().toISOString(),
        send_time: params.send_time || '10:00'
      });
    } else {
      // Follow-up email - depends on previous
      scheduleResult = await calculateDependentSchedule(
        params.previous_scheduled_at,
        params.gap_days || 5,
        {
          recipient_country: country || 'US',
          recipient_timezone: timezone,
          send_time: params.send_time || '10:00'
        }
      );
    }

    // 3. Validate schedule
    const validationResult = validateScheduleResult(scheduleResult);

    // 4. Prepare queue item data
    const queueItem = {
      campaign_id: params.campaign_id,
      contact_id: params.contact_id,
      recipient_email: params.recipient_email,
      subject: params.subject,
      html_content: params.html_content,
      text_content: params.text_content || '',
      scheduled_at: scheduleResult.adjusted_scheduled_at,
      original_scheduled_at: scheduleResult.original_scheduled_at,
      sequence_position: params.sequence_position,
      depends_on_queue_id: params.depends_on_queue_id || null,
      dependency_satisfied: params.depends_on_queue_id ? false : null,
      idempotency_key: params.idempotency_key,
      status: 'pending' as const,
      timezone: timezone,
      country_code: country,
      schedule_validation: JSON.stringify(validationResult),
      adjustment_reason: scheduleResult.adjustments.map((a: any) => a.reason).join('; ') || null,
      timezone_conversion_data: JSON.stringify(scheduleResult.timezone_conversion),
      metadata: JSON.stringify({
        country_info: scheduleResult.country_info,
        adjustments: scheduleResult.adjustments,
        detection_confidence: 'medium'
      })
    };

    // 5. Log schedule calculation for debugging
    console.log(`[QueueCreator] ${formatScheduleLog(scheduleResult)}`);

    return {
      success: true,
      queue_item: queueItem,
      schedule_result: scheduleResult,
      validation_result: validationResult
    };
  } catch (error: any) {
    console.error('[QueueCreator] Error creating queue entry:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Batch create queue entries
 */
export async function batchCreateQueueEntries(
  entries: QueueEntryParams[]
): Promise<QueueEntryResult[]> {
  return Promise.all(entries.map(entry => createQueueEntryWithValidation(entry)));
}

/**
 * Generate idempotency key for queue entry
 */
export function generateIdempotencyKey(
  campaignId: string,
  contactId: string,
  templateId: string,
  position: number
): string {
  const crypto = require('crypto');
  const data = `${campaignId}-${contactId}-${templateId}-${position}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}
