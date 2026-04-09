# Webhook Integration Guide

Complete guide for integrating email webhooks with your email sending system.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Database Setup](#database-setup)
3. [Integration Patterns](#integration-patterns)
4. [Testing](#testing)
5. [Monitoring](#monitoring)
6. [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Database Migration

```bash
# Using psql
psql -U your_user -d your_database -f src/lib/webhooks/migration.sql

# Or using your database GUI tool
# Run the SQL from src/lib/webhooks/migration.sql
```

### 3. Start Development Server

```bash
npm run dev
```

### 4. Test Webhooks

```bash
npm run test:webhooks
```

## Database Setup

### Required Tables

The migration creates these tables:

#### `webhook_events`
Stores all incoming webhook events for audit and debugging.

#### `email_send_log`
Comprehensive log of all email send attempts with full details.

#### `email_queue` (enhanced)
Adds tracking columns for open/click analytics.

### Manual Migration Check

Verify tables were created:

```sql
-- Check webhook_events table
SELECT COUNT(*) FROM webhook_events;

-- Check email_send_log table
SELECT COUNT(*) FROM email_send_log;

-- Check email_queue has tracking columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'email_queue'
  AND column_name IN ('opened_count', 'clicked_count', 'first_opened_at');
```

## Integration Patterns

### Pattern 1: Post-Send Webhook from Email Worker

Modify your email sending logic to notify webhooks after send attempts:

```typescript
// src/lib/email/sender.ts (or similar)

import { logger } from '@/lib/utils/logger';

async function sendEmail(queueItem: any) {
  try {
    // Your existing send logic
    const result = await smtpTransport.sendMail({
      from: queueItem.sender_email,
      to: queueItem.recipient_email,
      subject: queueItem.subject,
      html: queueItem.html_body
    });

    // Notify webhook of success
    await notifyWebhook('email.sent', {
      queue_id: queueItem.id,
      campaign_id: queueItem.campaign_id,
      contact_email: queueItem.recipient_email,
      sent_at: new Date().toISOString(),
      sender_id: queueItem.sender_id,
      subject: queueItem.subject,
      smtp_response: result.response,
      timezone: queueItem.timezone
    });

    logger.info(`Email sent successfully to ${queueItem.recipient_email}`);
    return { success: true, result };

  } catch (error) {
    // Notify webhook of failure
    await notifyWebhook('email.failed', {
      queue_id: queueItem.id,
      campaign_id: queueItem.campaign_id,
      contact_email: queueItem.recipient_email,
      failed_at: new Date().toISOString(),
      error: error.message,
      sender_id: queueItem.sender_id,
      subject: queueItem.subject
    });

    logger.error(`Email failed to send to ${queueItem.recipient_email}:`, error);
    return { success: false, error };
  }
}

async function notifyWebhook(eventType: string, data: any) {
  const webhookUrl = `${process.env.APP_URL}/api/webhooks/${eventType}`;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: eventType, data })
    });
  } catch (error) {
    logger.error('Failed to notify webhook:', error);
    // Don't throw - webhook failure shouldn't break email sending
  }
}
```

### Pattern 2: External Service Integration

Integrate with external email services like SendGrid, Mailgun, etc.

#### SendGrid Integration

```typescript
// SendGrid webhook handler
// Route: /api/sendgrid/events

import { NextRequest, NextResponse } from 'next/server';
import { handleEmailSentEvent, handleEmailFailedEvent } from '@/lib/webhooks/webhook-handler';

export async function POST(request: NextRequest) {
  const events = await request.json();

  for (const event of events) {
    try {
      if (event.event === 'delivered') {
        await handleEmailSentEvent({
          queue_id: event['queue-id'],
          contact_email: event.email,
          sent_at: new Date(event.timestamp * 1000).toISOString(),
          sender_id: event['sender-id'],
          subject: event.subject,
          smtp_response: event['smtp-response']
        });
      } else if (event.event === 'bounce' || event.event === 'dropped') {
        await handleEmailFailedEvent({
          queue_id: event['queue-id'],
          contact_email: event.email,
          failed_at: new Date(event.timestamp * 1000).toISOString(),
          error: event.reason,
          sender_id: event['sender-id'],
          subject: event.subject
        });
      } else if (event.event === 'open') {
        await handleEmailOpenedEvent({
          queue_id: event['queue-id'],
          contact_email: event.email,
          opened_at: new Date(event.timestamp * 1000).toISOString(),
          ip_address: event.ip,
          user_agent: event.useragent
        });
      } else if (event.event === 'click') {
        await handleEmailClickedEvent({
          queue_id: event['queue-id'],
          contact_email: event.email,
          url: event.url,
          clicked_at: new Date(event.timestamp * 1000).toISOString(),
          ip_address: event.ip,
          user_agent: event.useragent
        });
      }
    } catch (error) {
      console.error('Error processing SendGrid event:', error);
    }
  }

  return NextResponse.json({ received: true });
}
```

#### Mailgun Integration

```typescript
// Mailgun webhook handler
// Route: /api/mailgun/events

import { NextRequest, NextResponse } from 'next/server';
import { handleEmailSentEvent, handleEmailFailedEvent } from '@/lib/webhooks/webhook-handler';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const signature = formData.get('signature');
  const timestamp = formData.get('timestamp');
  const token = formData.get('token');
  const eventData = JSON.parse(formData.get('event-data') as string);

  try {
    if (eventData.event === 'delivered') {
      await handleEmailSentEvent({
        queue_id: eventData['user-variables']['queue-id'],
        contact_email: eventData.recipient,
        sent_at: new Date(eventData.timestamp * 1000).toISOString(),
        sender_id: eventData['user-variables']['sender-id'],
        subject: eventData.message.headers.subject,
        smtp_response: eventData['delivery-status']['message']
      });
    } else if (eventData.event === 'failed') {
      await handleEmailFailedEvent({
        queue_id: eventData['user-variables']['queue-id'],
        contact_email: eventData.recipient,
        failed_at: new Date(eventData.timestamp * 1000).toISOString(),
        error: eventData['delivery-status']['message'],
        sender_id: eventData['user-variables']['sender-id'],
        subject: eventData.message.headers.subject
      });
    } else if (eventData.event === 'opened') {
      await handleEmailOpenedEvent({
        queue_id: eventData['user-variables']['queue-id'],
        contact_email: eventData.recipient,
        opened_at: new Date(eventData.timestamp * 1000).toISOString(),
        ip_address: eventData.ip,
        user_agent: eventData['user-agent']
      });
    } else if (eventData.event === 'clicked') {
      await handleEmailClickedEvent({
        queue_id: eventData['user-variables']['queue-id'],
        contact_email: eventData.recipient,
        url: eventData.url,
        clicked_at: new Date(eventData.timestamp * 1000).toISOString(),
        ip_address: eventData.ip,
        user_agent: eventData['user-agent']
      });
    }
  } catch (error) {
    console.error('Error processing Mailgun event:', error);
  }

  return NextResponse.json({ received: true });
}
```

### Pattern 3: Queue Worker Integration

Integrate webhooks into your existing queue processing system:

```typescript
// src/api/workers/process-queue/route.ts (or similar)

import { executeQuery } from '@/lib/db/postgres';

async function processQueueItem(queueItem: any) {
  try {
    // Get sender details
    const senders = await executeQuery(
      'SELECT * FROM email_senders WHERE id = $1 AND is_active = TRUE',
      [queueItem.sender_id]
    );

    if (!senders || senders.length === 0) {
      throw new Error('Active sender not found');
    }

    const sender = senders[0];

    // Send email
    const result = await sendEmail({
      from: sender.email,
      to: queueItem.recipient_email,
      subject: queueItem.subject,
      html: queueItem.html_body,
      smtp: {
        host: sender.smtp_host,
        port: sender.smtp_port,
        secure: sender.smtp_secure,
        auth: {
          user: sender.smtp_user,
          pass: sender.smtp_password
        }
      }
    });

    // Notify webhook system
    await fetch(`${process.env.APP_URL}/api/webhooks/email-sent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'email.sent',
        data: {
          queue_id: queueItem.id,
          campaign_id: queueItem.campaign_id,
          contact_email: queueItem.recipient_email,
          sent_at: new Date().toISOString(),
          sender_id: sender.id,
          subject: queueItem.subject,
          smtp_response: result.response,
          timezone: queueItem.timezone
        }
      })
    });

    return { success: true };

  } catch (error: any) {
    // Notify webhook system of failure
    await fetch(`${process.env.APP_URL}/api/webhooks/email-failed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'email.failed',
        data: {
          queue_id: queueItem.id,
          campaign_id: queueItem.campaign_id,
          contact_email: queueItem.recipient_email,
          failed_at: new Date().toISOString(),
          error: error.message
        }
      })
    });

    return { success: false, error: error.message };
  }
}
```

## Testing

### Manual Testing with cURL

```bash
# Test email sent webhook
curl -X POST http://localhost:3000/api/webhooks/email-sent \
  -H "Content-Type: application/json" \
  -d '{
    "event": "email.sent",
    "data": {
      "queue_id": "test-uuid-123",
      "campaign_id": "test-campaign-456",
      "contact_email": "test@example.com",
      "sent_at": "2026-04-07T10:00:00Z",
      "sender_id": "sender-uuid-789",
      "subject": "Test Email",
      "smtp_response": "250 OK"
    }
  }'

# Test email failed webhook
curl -X POST http://localhost:3000/api/webhooks/email-failed \
  -H "Content-Type: application/json" \
  -d '{
    "event": "email.failed",
    "data": {
      "queue_id": "test-uuid-123",
      "contact_email": "test@example.com",
      "failed_at": "2026-04-07T10:00:00Z",
      "error": "Connection timeout"
    }
  }'
```

### Automated Testing

```bash
npm run test:webhooks
```

### Testing with Real Email Service

Set up a test campaign and monitor webhooks:

```typescript
// test-integration.ts
import { executeQuery } from '@/lib/db/postgres';

async function testWebhookIntegration() {
  // Create test campaign
  const campaign = await executeQuery(
    `INSERT INTO email_campaigns (name, status)
     VALUES ($1, 'active')
     RETURNING *`,
    ['Webhook Test Campaign']
  );

  // Create test sender
  const sender = await executeQuery(
    `INSERT INTO email_senders (email, smtp_host, is_active)
     VALUES ($1, $2, TRUE)
     RETURNING *`,
    ['test@example.com', 'smtp.example.com']
  );

  // Queue test email
  const queue = await executeQuery(
    `INSERT INTO email_queue (campaign_id, sender_id, recipient_email, subject, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
    [campaign[0].id, sender[0].id, 'recipient@example.com', 'Test Subject']
  );

  console.log('Test queue item created:', queue[0].id);
  console.log('Monitor webhook_events table for incoming webhooks');
}

testWebhookIntegration();
```

## Monitoring

### Webhook Event Monitoring

```sql
-- Recent webhook events
SELECT
  event_type,
  COUNT(*) as count,
  processed,
  MAX(received_at) as last_received
FROM webhook_events
GROUP BY event_type, processed
ORDER BY event_type, processed;

-- Unprocessed webhooks (potential issues)
SELECT * FROM webhook_events
WHERE processed = FALSE
ORDER BY received_at DESC
LIMIT 10;

-- Webhook processing time
SELECT
  event_type,
  AVG(EXTRACT(EPOCH FROM (processed_at - received_at))) as avg_processing_seconds
FROM webhook_events
WHERE processed = TRUE
GROUP BY event_type;
```

### Email Send Log Monitoring

```sql
-- Recent send attempts
SELECT
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '1 hour') as last_hour
FROM email_send_log
GROUP BY status;

-- Failure analysis
SELECT
  error_message,
  COUNT(*) as occurrences,
  MAX(sent_at) as last_occurrence
FROM email_send_log
WHERE status = 'failed'
GROUP BY error_message
ORDER BY occurrences DESC
LIMIT 10;

-- Sender performance
SELECT
  sender_id,
  COUNT(*) as total_sent,
  COUNT(*) FILTER (WHERE status = 'sent') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'sent') / COUNT(*), 2) as success_rate
FROM email_send_log
WHERE sent_at > NOW() - INTERVAL '24 hours'
GROUP BY sender_id;
```

### Real-time Dashboard

Create a simple monitoring page:

```typescript
// src/app/api/webhooks/stats/route.ts

import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET() {
  const stats = await executeQuery(`
    SELECT
      (SELECT COUNT(*) FROM webhook_events WHERE received_at > NOW() - INTERVAL '1 hour') as webhook_events_last_hour,
      (SELECT COUNT(*) FROM email_send_log WHERE sent_at > NOW() - INTERVAL '1 hour' AND status = 'sent') as emails_sent_last_hour,
      (SELECT COUNT(*) FROM email_send_log WHERE sent_at > NOW() - INTERVAL '1 hour' AND status = 'failed') as emails_failed_last_hour,
      (SELECT COUNT(*) FROM webhook_events WHERE processed = FALSE) as unprocessed_webhooks
  `);

  return NextResponse.json({ success: true, data: stats[0] });
}
```

## Troubleshooting

### Webhooks Not Received

**Symptoms**: No records in `webhook_events` table

**Solutions**:
1. Verify Next.js server is running: `curl http://localhost:3000/api/webhooks/email-sent`
2. Check network connectivity to webhook URL
3. Verify CORS settings if calling from external domain
4. Check firewall rules allow incoming POST requests

### Database Errors

**Symptoms**: 500 errors with database messages

**Solutions**:
1. Verify migration was run successfully
2. Check database connection: `psql -U user -d database -c "SELECT 1"`
3. Verify tables exist: `\dt webhook_events` in psql
4. Check database permissions: Ensure INSERT/UPDATE permissions

### Processing Errors

**Symptoms**: Webhooks received but not processed

**Solutions**:
1. Check unprocessed webhooks: `SELECT * FROM webhook_events WHERE processed = FALSE`
2. Review server logs for error messages
3. Verify queue_id references exist in email_queue table
4. Check for missing required fields in payloads

### Rate Limiting Issues

**Symptoms**: 429 errors from webhook endpoints

**Solutions**:
1. Adjust rate limiter settings in route handlers
2. Implement webhook batching if sending many events
3. Use webhook signature verification to bypass limits for trusted sources

### Timestamp Validation Failures

**Symptoms**: 400 errors for "Invalid timestamp"

**Solutions**:
1. Ensure timestamps are ISO 8601 format
2. Check system time synchronization
3. Adjust maxTimestampAge if needed
4. Disable timestamp validation if not required

## Best Practices

### 1. Always Use Queue IDs

Include queue_id in all webhook payloads for proper tracking:

```typescript
// When sending emails, pass queue_id in user variables
await mailClient.send({
  to: 'recipient@example.com',
  subject: 'Hello',
  'user-variables': {
    'queue-id': queueItem.id,
    'sender-id': sender.id
  }
});
```

### 2. Implement Retry Logic

Webhooks can fail. Implement retry logic in your sender:

```typescript
async function notifyWebhookWithRetry(url: string, payload: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        return true;
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1)); // Exponential backoff
    }
  }
  return false;
}
```

### 3. Monitor Webhook Health

Set up alerts for:
- High rate of unprocessed webhooks
- Increasing webhook processing time
- High failure rates
- Unusual error messages

### 4. Use Webhooks for Analytics

Leverage webhook data for insights:

```sql
-- Email open rate by campaign
SELECT
  c.name as campaign,
  COUNT(DISTINCT q.id) as total_sent,
  COUNT(DISTINCT CASE WHEN q.opened_count > 0 THEN q.id END) as opened,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN q.opened_count > 0 THEN q.id END) / COUNT(DISTINCT q.id), 2) as open_rate
FROM email_campaigns c
JOIN email_queue q ON q.campaign_id = c.id
GROUP BY c.id, c.name;
```

### 5. Secure Your Webhooks

- Use HTTPS in production
- Implement signature verification
- Add rate limiting
- Validate and sanitize all inputs
- Monitor for suspicious activity
