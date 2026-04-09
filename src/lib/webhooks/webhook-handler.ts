import { executeQuery } from '@/lib/db/postgres';
import crypto from 'crypto';

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Webhook event types for email system
 */
export type EmailEventType = 'email.sent' | 'email.failed' | 'email.opened' | 'email.clicked';

/**
 * Base webhook payload structure
 */
export interface WebhookPayload {
  event: EmailEventType;
  data: any;
  timestamp?: string;
}

/**
 * Email sent event data
 */
export interface EmailSentData {
  queue_id: string;
  campaign_id?: string;
  contact_email: string;
  sent_at: string;
  sender_id: string;
  subject: string;
  smtp_response?: string;
  timezone?: string;
}

/**
 * Email failed event data
 */
export interface EmailFailedData {
  queue_id: string;
  campaign_id?: string;
  contact_email: string;
  failed_at: string;
  error: string;
  sender_id?: string;
  subject?: string;
}

/**
 * Email opened event data
 */
export interface EmailOpenedData {
  queue_id: string;
  contact_email: string;
  opened_at: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Email clicked event data
 */
export interface EmailClickedData {
  queue_id: string;
  contact_email: string;
  url: string;
  clicked_at: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Webhook processing result
 */
export interface WebhookResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Log webhook event to webhook_events table
 */
export async function logWebhookEvent(
  eventType: string,
  payload: any,
  processed: boolean = false
): Promise<string> {
  const eventId = generateUUID();

  try {
    await executeQuery(
      `INSERT INTO webhook_events (id, event_type, payload, processed, received_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [eventId, eventType, JSON.stringify(payload), processed]
    );
    return eventId;
  } catch (error: any) {
    console.error('Failed to log webhook event:', error);
    throw error;
  }
}

/**
 * Mark webhook event as processed
 */
export async function markWebhookProcessed(eventId: string): Promise<void> {
  try {
    await executeQuery(
      `UPDATE webhook_events SET processed = TRUE, processed_at = NOW() WHERE id = $1`,
      [eventId]
    );
  } catch (error: any) {
    console.error('Failed to mark webhook as processed:', error);
  }
}

/**
 * Log email send to email_send_log table
 */
async function logToSendLog(data: {
  queue_id: string;
  campaign_id?: string;
  sender_id: string;
  recipient_email: string;
  subject: string;
  status: string;
  error_message?: string;
  smtp_response?: string;
  timezone?: string;
}): Promise<string> {
  const logId = generateUUID();

  try {
    await executeQuery(
      `INSERT INTO email_send_log (
        id, queue_id, campaign_id, sender_id, recipient_email,
        subject, sent_at, status, error_message, smtp_response, timezone
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10)`,
      [
        logId,
        data.queue_id,
        data.campaign_id || null,
        data.sender_id,
        data.recipient_email,
        data.subject,
        data.status,
        data.error_message || null,
        data.smtp_response || null,
        data.timezone || null
      ]
    );
    return logId;
  } catch (error: any) {
    console.error('Failed to log to email_send_log:', error);
    throw error;
  }
}

/**
 * Update email_queue status
 */
async function updateQueueStatus(
  queueId: string,
  updates: {
    status?: string;
    sent_at?: string;
    error_message?: string;
    retry_count?: number;
    last_retry_at?: string;
  }
): Promise<void> {
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.sent_at) {
      setClauses.push(`sent_at = $${paramIndex++}`);
      values.push(updates.sent_at);
    }
    if (updates.error_message) {
      setClauses.push(`error_message = $${paramIndex++}`);
      values.push(updates.error_message);
    }
    if (updates.retry_count !== undefined) {
      setClauses.push(`retry_count = $${paramIndex++}`);
      values.push(updates.retry_count);
    }
    if (updates.last_retry_at) {
      setClauses.push(`last_retry_at = $${paramIndex++}`);
      values.push(updates.last_retry_at);
    }

    if (setClauses.length > 0) {
      values.push(queueId);
      await executeQuery(
        `UPDATE email_queue SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }
  } catch (error: any) {
    console.error('Failed to update queue status:', error);
    throw error;
  }
}

/**
 * Handle email sent event
 */
export async function handleEmailSentEvent(data: EmailSentData): Promise<WebhookResult> {
  const eventId = await logWebhookEvent('email.sent', data);

  try {
    // Log to email_send_log
    await logToSendLog({
      queue_id: data.queue_id,
      campaign_id: data.campaign_id,
      sender_id: data.sender_id,
      recipient_email: data.contact_email,
      subject: data.subject,
      status: 'sent',
      smtp_response: data.smtp_response,
      timezone: data.timezone
    });

    // Update email_queue status
    await updateQueueStatus(data.queue_id, {
      status: 'sent',
      sent_at: data.sent_at
    });

    await markWebhookProcessed(eventId);

    return {
      success: true,
      message: 'Email sent event processed successfully',
      data: { event_id: eventId }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to process email sent event: ${error.message}`,
      data: { event_id: eventId }
    };
  }
}

/**
 * Handle email failed event
 */
export async function handleEmailFailedEvent(data: EmailFailedData): Promise<WebhookResult> {
  const eventId = await logWebhookEvent('email.failed', data);

  try {
    // Get current retry_count from queue
    const queueData = await executeQuery(
      'SELECT retry_count, max_retries FROM email_queue WHERE id = $1',
      [data.queue_id]
    );

    if (!queueData || queueData.length === 0) {
      return {
        success: false,
        message: 'Queue item not found',
        data: { event_id: eventId }
      };
    }

    const currentRetryCount = queueData[0].retry_count || 0;
    const maxRetries = queueData[0].max_retries || 3;
    const newRetryCount = currentRetryCount + 1;

    // Determine new status
    const newStatus = newRetryCount >= maxRetries ? 'failed' : 'pending';

    // Log to email_send_log
    if (data.sender_id && data.subject) {
      await logToSendLog({
        queue_id: data.queue_id,
        campaign_id: data.campaign_id,
        sender_id: data.sender_id,
        recipient_email: data.contact_email,
        subject: data.subject,
        status: 'failed',
        error_message: data.error
      });
    }

    // Update email_queue status
    await updateQueueStatus(data.queue_id, {
      status: newStatus,
      error_message: data.error,
      retry_count: newRetryCount,
      last_retry_at: data.failed_at
    });

    await markWebhookProcessed(eventId);

    return {
      success: true,
      message: `Email failed event processed. Status set to ${newStatus}. Retry ${newRetryCount}/${maxRetries}`,
      data: {
        event_id: eventId,
        new_status: newStatus,
        retry_count: newRetryCount,
        max_retries: maxRetries
      }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to process email failed event: ${error.message}`,
      data: { event_id: eventId }
    };
  }
}

/**
 * Handle email opened event (optional tracking)
 */
export async function handleEmailOpenedEvent(data: EmailOpenedData): Promise<WebhookResult> {
  const eventId = await logWebhookEvent('email.opened', data);

  try {
    // Update tracking in email_queue (optional fields)
    await executeQuery(
      `UPDATE email_queue
       SET opened_count = COALESCE(opened_count, 0) + 1,
           first_opened_at = COALESCE(first_opened_at, $1),
           last_opened_at = $1
       WHERE id = $2`,
      [data.opened_at, data.queue_id]
    );

    await markWebhookProcessed(eventId);

    return {
      success: true,
      message: 'Email opened event processed successfully',
      data: { event_id: eventId }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to process email opened event: ${error.message}`,
      data: { event_id: eventId }
    };
  }
}

/**
 * Handle email clicked event (optional tracking)
 */
export async function handleEmailClickedEvent(data: EmailClickedData): Promise<WebhookResult> {
  const eventId = await logWebhookEvent('email.clicked', data);

  try {
    // Update tracking in email_queue (optional fields)
    await executeQuery(
      `UPDATE email_queue
       SET clicked_count = COALESCE(clicked_count, 0) + 1,
           first_clicked_at = COALESCE(first_clicked_at, $1),
           last_clicked_at = $1
       WHERE id = $2`,
      [data.clicked_at, data.queue_id]
    );

    await markWebhookProcessed(eventId);

    return {
      success: true,
      message: 'Email clicked event processed successfully',
      data: { event_id: eventId, url: data.url }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to process email clicked event: ${error.message}`,
      data: { event_id: eventId }
    };
  }
}

/**
 * Validate webhook payload structure
 */
export function validateWebhookPayload(payload: any, eventType: EmailEventType): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  if (payload.event !== eventType) {
    return false;
  }

  if (!payload.data || typeof payload.data !== 'object') {
    return false;
  }

  // Validate required fields based on event type
  switch (eventType) {
    case 'email.sent':
      return !!(
        payload.data.queue_id &&
        payload.data.contact_email &&
        payload.data.sent_at &&
        payload.data.sender_id &&
        payload.data.subject
      );

    case 'email.failed':
      return !!(
        payload.data.queue_id &&
        payload.data.contact_email &&
        payload.data.failed_at &&
        payload.data.error
      );

    case 'email.opened':
      return !!(
        payload.data.queue_id &&
        payload.data.contact_email &&
        payload.data.opened_at
      );

    case 'email.clicked':
      return !!(
        payload.data.queue_id &&
        payload.data.contact_email &&
        payload.data.url &&
        payload.data.clicked_at
      );

    default:
      return false;
  }
}
