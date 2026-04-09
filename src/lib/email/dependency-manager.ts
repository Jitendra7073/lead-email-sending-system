import { supabaseAdmin } from '../supabase/client';
import { createQueueEntryWithValidation, generateIdempotencyKey, QueueEntryParams } from '@/lib/queue/queue-creator';

/**
 * Checks if a specific queue record is eligible to be sent by
 * verifying the status of its parent dependency.
 *
 * @param parentQueueId The ID of the preceding email in the campaign sequence
 * @returns boolean True if eligible, False if parent failed/paused
 */
export async function isDependencyMet(parentQueueId: string | null): Promise<boolean> {
  if (!parentQueueId) return true; // No dependency, it's the first email in the chain

  // Use .limit(1) instead of .single() to handle potential duplicates gracefully
  const { data: parentRecords, error } = await supabaseAdmin
    .from('email_queue')
    .select('status')
    .eq('id', parentQueueId)
    .limit(1);

  const parentRecord = parentRecords && parentRecords.length > 0 ? parentRecords[0] : null;

  if (error || !parentRecord) {
    console.error('Failed to locate parent dependency', error);
    return false; // Fail safe
  }

  // A follow-up can only be sent if its direct parent successfully reached 'sent' status
  return parentRecord.status === 'sent';
}

/**
 * If an email fails permanently, we need to mark all of its children
 * (subsequent follow-up emails) as 'cancelled' or 'skipped'.
 *
 * @param failedQueueId The queue ID of the email that just failed
 */
export async function cancelDownstreamDependencies(failedQueueId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('email_queue')
    .update({
      status: 'cancelled',
      error_message: 'Parent dependency failed.'
    })
    // This assumes we have a parent_queue_id column structured
    .eq('parent_queue_id', failedQueueId);

  if (error) {
    console.error('Failed to cancel downstream dependencies', error);
  }
}

/**
 * Build complete dependency chain for a campaign
 *
 * @param campaign - Campaign object
 * @param contacts - Array of contacts to target
 * @param templates - Array of templates ordered by position
 * @param group - Template group with gap configuration
 * @returns Summary of created queue items
 */
export async function buildDependencyChain(
  campaign: any,
  contacts: any[],
  templates: any[],
  group: any
): Promise<{
  success: boolean;
  total_contacts: number;
  total_emails_queued: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let totalEmailsQueued = 0;

  // Extract gap days configuration
  const gapDaysConfig = [
    group.gap_days_1 || 2,
    group.gap_days_2 || 5,
    group.gap_days_3 || 5,
    group.gap_days_4 || 7
  ];

  // Process each contact
  for (const contact of contacts) {
    try {
      let previousQueueId: string | null = null;
      let previousScheduledAt: string | null = null;

      // Process each template in sequence
      for (let i = 0; i < templates.length; i++) {
        const template = templates[i];
        const position = i + 1;

        // Generate idempotency key
        const idempotencyKey = generateIdempotencyKey(
          campaign.id,
          contact.id,
          template.id,
          position
        );

        // Get gap days for this position
        const gapDays = position === 1 ? 0 : gapDaysConfig[position - 2] || 5;

        // Prepare queue entry params
        const queueParams: QueueEntryParams = {
          campaign_id: campaign.id,
          contact_id: contact.id,
          recipient_email: contact.email || contact.value,
          recipient_country: contact.country_code,
          recipient_timezone: contact.timezone,
          template_id: template.id,
          subject: template.subject,
          html_content: template.html_content,
          text_content: template.text_content || '',
          sequence_position: position,
          gap_days: gapDays,
          previous_scheduled_at: previousScheduledAt || undefined,
          depends_on_email_id: previousQueueId,
          idempotency_key: idempotencyKey,
          send_time: '10:00' // Default send time
        };

        // Create queue entry with validation
        const result = await createQueueEntryWithValidation(queueParams);

        if (!result.success || !result.queue_item) {
          errors.push(`Contact ${contact.id}, Template ${template.id}: ${result.error || 'Unknown error'}`);
          continue;
        }

        // Insert into database
        const { error: insertError } = await supabaseAdmin
          .from('email_queue')
          .insert(result.queue_item);

        if (insertError) {
          // Check for duplicate (idempotency key)
          if (insertError.code === '23505') {
            console.log(`[DependencyManager] Duplicate entry skipped: ${idempotencyKey}`);
            totalEmailsQueued++;
          } else {
            errors.push(`Failed to insert queue item: ${insertError.message}`);
          }
          continue;
        }

        totalEmailsQueued++;

        // Update references for next iteration
        // Note: In production, you'd want to get the actual inserted ID
        // For now, we'll use a placeholder approach
        previousQueueId = result.queue_item.id || idempotencyKey;
        previousScheduledAt = result.queue_item.scheduled_at;
      }
    } catch (error: any) {
      errors.push(`Contact ${contact.id}: ${error.message}`);
    }
  }

  return {
    success: errors.length === 0,
    total_contacts: contacts.length,
    total_emails_queued: totalEmailsQueued,
    errors
  };
}
