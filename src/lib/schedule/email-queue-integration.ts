/**
 * Email Queue Integration Helper
 *
 * Provides helper functions to integrate timezone-aware scheduling
 * with the existing email queue system.
 */

import { executeQuery, dbPool } from '@/lib/db/postgres';
import { calculateOptimalSchedule } from './timezone-calculator';

export interface EmailScheduleParams {
  campaign_id: string;
  contact_id: number;
  recipient_email: string;
  recipient_name?: string;
  recipient_country: string;
  recipient_timezone?: string;
  base_time?: string; // ISO string, defaults to now
  gap_days?: number;
  gap_hours?: number;
  gap_minutes?: number;
  send_time?: string; // HH:mm format
  subject: string;
  html_content: string;
  text_content?: string;
  sequence_position?: number;
  parent_queue_id?: string | null;
}

export interface BatchScheduleParams {
  campaign_id: string;
  contacts: Array<{
    id: number;
    email: string;
    name?: string;
    country_code?: string;
    timezone?: string;
  }>;
  base_time?: string;
  gap_days?: number;
  send_time?: string;
  subject_template?: string;
  html_template?: string;
  sequence_position?: number;
}

/**
 * Schedule a single email with timezone-aware calculation
 */
export async function scheduleEmail(params: EmailScheduleParams): Promise<string | null> {
  const client = await dbPool.connect();

  try {
    const {
      campaign_id,
      contact_id,
      recipient_email,
      recipient_name = null,
      recipient_country,
      recipient_timezone,
      base_time = new Date().toISOString(),
      gap_days = 0,
      gap_hours = 0,
      gap_minutes = 0,
      send_time = '10:00',
      subject,
      html_content,
      text_content = null,
      sequence_position = null,
      parent_queue_id = null
    } = params;

    // Calculate timezone-aware schedule
    const schedule = await calculateOptimalSchedule({
      recipient_country,
      recipient_timezone,
      base_time,
      gap_days,
      gap_hours,
      gap_minutes,
      send_time
    });

    // Generate idempotency key
    const crypto = require('crypto');
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${campaign_id}-${contact_id}-${schedule.adjusted_scheduled_at}`)
      .digest('hex');

    // Insert into email queue
    const query = `
      INSERT INTO email_queue (
        campaign_id,
        contact_id,
        recipient_email,
        recipient_name,
        subject,
        html_content,
        text_content,
        scheduled_at,
        sequence_position,
        parent_queue_id,
        idempotency_key,
        status,
        country_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (idempotency_key) DO UPDATE SET
        scheduled_at = EXCLUDED.scheduled_at,
        subject = EXCLUDED.subject,
        html_content = EXCLUDED.html_content
      RETURNING id
    `;

    const values = [
      campaign_id,
      contact_id,
      recipient_email,
      recipient_name,
      subject,
      html_content,
      text_content,
      schedule.adjusted_scheduled_at,
      sequence_position,
      parent_queue_id,
      idempotencyKey,
      'queued',
      recipient_country
    ];

    const result = await client.query(query, values);
    return result.rows[0]?.id || null;
  } catch (error) {
    console.error('Error scheduling email:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Schedule multiple emails in batch with timezone-aware calculation
 */
export async function scheduleBatchEmails(params: BatchScheduleParams): Promise<{
  success: number;
  failed: number;
  errors: Array<{ contact: string; error: string }>;
}> {
  const client = await dbPool.connect();

  try {
    const {
      campaign_id,
      contacts,
      base_time = new Date().toISOString(),
      gap_days = 0,
      send_time = '10:00',
      subject_template = '',
      html_template = '',
      sequence_position = null
    } = params;

    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ contact: string; error: string }> = [];

    await client.query('BEGIN');

    for (const contact of contacts) {
      try {
        // Skip if no email or country
        if (!contact.email || !contact.country_code) {
          failedCount++;
          errors.push({
            contact: contact.email || 'unknown',
            error: 'Missing email or country code'
          });
          continue;
        }

        // Calculate timezone-aware schedule
        const schedule = await calculateOptimalSchedule({
          recipient_country: contact.country_code,
          recipient_timezone: contact.timezone,
          base_time,
          gap_days,
          send_time
        });

        // Replace variables in templates
        const subject = subject_template
          .replace(/{{email}}/g, contact.email)
          .replace(/{{name}}/g, contact.name || '');

        const html_content = html_template
          .replace(/{{email}}/g, contact.email)
          .replace(/{{name}}/g, contact.name || '');

        // Generate idempotency key
        const crypto = require('crypto');
        const idempotencyKey = crypto
          .createHash('sha256')
          .update(`${campaign_id}-${contact.id}-${schedule.adjusted_scheduled_at}`)
          .digest('hex');

        // Insert into email queue
        const query = `
          INSERT INTO email_queue (
            campaign_id,
            contact_id,
            recipient_email,
            recipient_name,
            subject,
            html_content,
            scheduled_at,
            sequence_position,
            idempotency_key,
            status,
            country_code
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (idempotency_key) DO NOTHING
        `;

        await client.query(query, [
          campaign_id,
          contact.id,
          contact.email,
          contact.name || null,
          subject,
          html_content,
          schedule.adjusted_scheduled_at,
          sequence_position,
          idempotencyKey,
          'queued',
          contact.country_code
        ]);

        successCount++;
      } catch (error: any) {
        failedCount++;
        errors.push({
          contact: contact.email,
          error: error.message
        });
      }
    }

    await client.query('COMMIT');

    return {
      success: successCount,
      failed: failedCount,
      errors
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Schedule email sequence with timezone-aware gaps
 */
export async function scheduleEmailSequence(params: {
  campaign_id: string;
  contact: {
    id: number;
    email: string;
    name?: string;
    country_code?: string;
    timezone?: string;
  };
  emails: Array<{
    subject: string;
    html_content: string;
    gap_days?: number;
    gap_hours?: number;
    gap_minutes?: number;
    send_time?: string;
  }>;
}): Promise<string[]> {
  const scheduledIds: string[] = [];
  let baseTime = new Date().toISOString();
  let parentQueueId: string | null = null;

  for (let i = 0; i < params.emails.length; i++) {
    const email = params.emails[i];
    const queueId = await scheduleEmail({
      campaign_id: params.campaign_id,
      contact_id: params.contact.id,
      recipient_email: params.contact.email,
      recipient_name: params.contact.name,
      recipient_country: params.contact.country_code || 'US',
      recipient_timezone: params.contact.timezone,
      base_time: baseTime,
      gap_days: email.gap_days || 0,
      gap_hours: email.gap_hours || 0,
      gap_minutes: email.gap_minutes || 0,
      send_time: email.send_time || '10:00',
      subject: email.subject,
      html_content: email.html_content,
      sequence_position: i + 1,
      parent_queue_id: parentQueueId
    });

    if (queueId) {
      scheduledIds.push(queueId);

      // Update base time for next email (use the scheduled time)
      const schedule = await calculateOptimalSchedule({
        recipient_country: params.contact.country_code || 'US',
        recipient_timezone: params.contact.timezone,
        base_time: baseTime,
        gap_days: email.gap_days || 0,
        gap_hours: email.gap_hours || 0,
        gap_minutes: email.gap_minutes || 0,
        send_time: email.send_time || '10:00'
      });

      baseTime = schedule.adjusted_scheduled_at;
      parentQueueId = queueId;
    }
  }

  return scheduledIds;
}

/**
 * Get country timezone from database
 */
export async function getCountryTimezone(countryCode: string): Promise<any | null> {
  try {
    const query = `
      SELECT * FROM country_timezones
      WHERE country_code = $1
    `;
    const result = await executeQuery(query, [countryCode.toUpperCase()]);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error fetching country timezone:', error);
    return null;
  }
}

/**
 * Bulk update email schedules with new timezone settings
 */
export async function rescheduleEmails(params: {
  queue_ids: string[];
  new_base_time: string;
  new_send_time?: string;
}): Promise<{ success: number; failed: number }> {
  const client = await dbPool.connect();

  try {
    let successCount = 0;
    let failedCount = 0;

    await client.query('BEGIN');

    for (const queueId of params.queue_ids) {
      try {
        // Get email details
        const getQuery = `
          SELECT * FROM email_queue
          WHERE id = $1 AND status = 'queued'
        `;
        const emailResult = await client.query(getQuery, [queueId]);

        if (emailResult.rows.length === 0) {
          failedCount++;
          continue;
        }

        const email = emailResult.rows[0];

        // Recalculate schedule
        const schedule = await calculateOptimalSchedule({
          recipient_country: email.country_code || 'US',
          recipient_timezone: email.recipient_timezone,
          base_time: params.new_base_time,
          send_time: params.new_send_time || '10:00'
        });

        // Update scheduled time
        const updateQuery = `
          UPDATE email_queue
          SET scheduled_at = $1
          WHERE id = $2
        `;
        await client.query(updateQuery, [schedule.adjusted_scheduled_at, queueId]);

        successCount++;
      } catch (error) {
        console.error(`Error rescheduling email ${queueId}:`, error);
        failedCount++;
      }
    }

    await client.query('COMMIT');

    return { success: successCount, failed: failedCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
