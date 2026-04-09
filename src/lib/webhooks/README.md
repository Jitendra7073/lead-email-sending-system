# Email Webhook System

Complete webhook infrastructure for the email-sending-system with event tracking, logging, and security features.

## 📋 Overview

This webhook system handles real-time email events from your email service provider (ESP) or custom sending system. It provides:

- **4 Webhook Endpoints**: email.sent, email.failed, email.opened, email.clicked
- **Event Logging**: All webhooks logged to `webhook_events` table
- **Send Logging**: Comprehensive logging to `email_send_log` table
- **Queue Management**: Automatic status updates and retry logic
- **Security**: Signature verification, rate limiting, and timestamp validation
- **Type Safety**: Full TypeScript support with proper types

## 🚀 Quick Start

### 1. Run Database Migration

```bash
# Connect to your PostgreSQL database and run:
psql -U your_user -d your_database -f src/lib/webhooks/migration.sql
```

This creates:
- `webhook_events` table
- `email_send_log` table
- Tracking columns on `email_queue` table

### 2. Test Webhook Endpoints

```bash
# Test email-sent webhook
curl -X POST http://localhost:3000/api/webhooks/email-sent \
  -H "Content-Type: application/json" \
  -d '{
    "event": "email.sent",
    "data": {
      "queue_id": "uuid-here",
      "campaign_id": "campaign-uuid",
      "contact_email": "test@example.com",
      "sent_at": "2026-04-07T10:00:00Z",
      "sender_id": "sender-uuid",
      "subject": "Test Email",
      "smtp_response": "250 OK"
    }
  }'

# Test email-failed webhook
curl -X POST http://localhost:3000/api/webhooks/email-failed \
  -H "Content-Type: application/json" \
  -d '{
    "event": "email.failed",
    "data": {
      "queue_id": "uuid-here",
      "contact_email": "test@example.com",
      "failed_at": "2026-04-07T10:00:00Z",
      "error": "SMTP connection timeout"
    }
  }'
```

### 3. Health Check

All endpoints support GET requests for health checks:

```bash
curl http://localhost:3000/api/webhooks/email-sent
curl http://localhost:3000/api/webhooks/email-failed
curl http://localhost:3000/api/webhooks/email-opened
curl http://localhost:3000/api/webhooks/email-clicked
```

## 📡 Webhook Endpoints

### POST /api/webhooks/email-sent

Handles successful email delivery events.

**Payload:**
```json
{
  "event": "email.sent",
  "data": {
    "queue_id": "string (required)",
    "campaign_id": "string (optional)",
    "contact_email": "string (required)",
    "sent_at": "ISO 8601 timestamp (required)",
    "sender_id": "string (required)",
    "subject": "string (required)",
    "smtp_response": "string (optional)",
    "timezone": "string (optional)"
  }
}
```

**Actions:**
- Logs to `email_send_log` table
- Updates `email_queue` status to 'sent'
- Records send timestamp

**Response:**
```json
{
  "success": true,
  "received": true,
  "message": "Email sent event processed successfully",
  "data": {
    "event_id": "uuid"
  }
}
```

### POST /api/webhooks/email-failed

Handles failed email delivery events.

**Payload:**
```json
{
  "event": "email.failed",
  "data": {
    "queue_id": "string (required)",
    "campaign_id": "string (optional)",
    "contact_email": "string (required)",
    "failed_at": "ISO 8601 timestamp (required)",
    "error": "string (required)",
    "sender_id": "string (optional)",
    "subject": "string (optional)"
  }
}
```

**Actions:**
- Logs to `email_send_log` table
- Updates `email_queue` with error details
- Increments `retry_count`
- Sets status to 'failed' if max retries exceeded
- Sets status to 'pending' if retries remaining

**Response:**
```json
{
  "success": true,
  "received": true,
  "message": "Email failed event processed. Status set to pending. Retry 1/3",
  "data": {
    "event_id": "uuid",
    "new_status": "pending",
    "retry_count": 1,
    "max_retries": 3
  }
}
```

### POST /api/webhooks/email-opened

Handles email open tracking events (optional).

**Payload:**
```json
{
  "event": "email.opened",
  "data": {
    "queue_id": "string (required)",
    "contact_email": "string (required)",
    "opened_at": "ISO 8601 timestamp (required)",
    "ip_address": "string (optional)",
    "user_agent": "string (optional)"
  }
}
```

**Actions:**
- Increments `opened_count` in `email_queue`
- Updates `first_opened_at` and `last_opened_at`

### POST /api/webhooks/email-clicked

Handles link click tracking events (optional).

**Payload:**
```json
{
  "event": "email.clicked",
  "data": {
    "queue_id": "string (required)",
    "contact_email": "string (required)",
    "url": "string (required)",
    "clicked_at": "ISO 8601 timestamp (required)",
    "ip_address": "string (optional)",
    "user_agent": "string (optional)"
  }
}
```

**Actions:**
- Increments `clicked_count` in `email_queue`
- Updates `first_clicked_at` and `last_clicked_at`

## 🔒 Security Features

### Webhook Signature Verification

If your ESP signs webhooks, verify signatures:

```typescript
import { verifyWebhookSignature, extractSignature } from '@/lib/webhooks/webhook-utils';

// In your route handler
const rawBody = await request.text();
const signature = extractSignature(request);
const isValid = verifyWebhookSignature(rawBody, signature, process.env.WEBHOOK_SECRET);

if (!isValid) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}
```

### Rate Limiting

Protect against webhook abuse:

```typescript
import { WebhookRateLimiter, getClientIP } from '@/lib/webhooks/webhook-utils';

const rateLimiter = new WebhookRateLimiter(
  60000,  // 1 minute window
  100     // max 100 requests per minute
);

const clientIP = getClientIP(request);
if (rateLimiter.isRateLimited(clientIP)) {
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    { status: 429 }
  );
}
```

### Timestamp Validation

Prevent replay attacks:

```typescript
import { validateTimestamp } from '@/lib/webhooks/webhook-utils';

const isValid = validateTimestamp(payload.data.sent_at, 300); // 5 minute window
```

## 🗄️ Database Schema

### webhook_events Table

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
```

**Indexes:**
- `event_type` - Fast filtering by event type
- `processed` - Query unprocessed events
- `received_at` - Time-based queries

### email_send_log Table

```sql
CREATE TABLE email_send_log (
  id UUID PRIMARY KEY,
  queue_id UUID NOT NULL,
  campaign_id UUID,
  sender_id UUID NOT NULL,
  contact_id UUID,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL,
  error_message TEXT,
  smtp_response TEXT,
  timezone TEXT,
  scheduled_adjusted BOOLEAN DEFAULT FALSE
);
```

### email_queue Tracking Columns

```sql
ALTER TABLE email_queue ADD COLUMN opened_count INTEGER DEFAULT 0;
ALTER TABLE email_queue ADD COLUMN first_opened_at TIMESTAMPTZ;
ALTER TABLE email_queue ADD COLUMN last_opened_at TIMESTAMPTZ;
ALTER TABLE email_queue ADD COLUMN clicked_count INTEGER DEFAULT 0;
ALTER TABLE email_queue ADD COLUMN first_clicked_at TIMESTAMPTZ;
ALTER TABLE email_queue ADD COLUMN last_clicked_at TIMESTAMPTZ;
```

## 🔧 Utility Functions

### webhook-handler.ts

Core webhook processing logic:

```typescript
import {
  handleEmailSentEvent,
  handleEmailFailedEvent,
  handleEmailOpenedEvent,
  handleEmailClickedEvent,
  validateWebhookPayload
} from '@/lib/webhooks/webhook-handler';

// Process events
const result = await handleEmailSentEvent(data);
const isValid = validateWebhookPayload(payload, 'email.sent');
```

### webhook-utils.ts

Security and utility functions:

```typescript
import {
  verifyWebhookSignature,
  extractSignature,
  WebhookRateLimiter,
  getClientIP,
  validateTimestamp,
  createRateLimiterMiddleware
} from '@/lib/webhooks/webhook-utils';
```

## 📊 Monitoring & Debugging

### Query Webhook Events

```sql
-- Get recent webhook events
SELECT * FROM webhook_events
ORDER BY received_at DESC
LIMIT 100;

-- Get failed webhooks
SELECT * FROM webhook_events
WHERE processed = FALSE
ORDER BY received_at DESC;

-- Get events by type
SELECT event_type, COUNT(*)
FROM webhook_events
GROUP BY event_type;
```

### Query Send Logs

```sql
-- Get recent send attempts
SELECT * FROM email_send_log
ORDER BY sent_at DESC
LIMIT 100;

-- Get failed sends
SELECT * FROM email_send_log
WHERE status = 'failed'
ORDER BY sent_at DESC;

-- Get sends by campaign
SELECT campaign_id, COUNT(*), status
FROM email_send_log
GROUP BY campaign_id, status;
```

### Check Email Tracking

```sql
-- Get open/click statistics
SELECT
  q.id,
  q.recipient_email,
  q.opened_count,
  q.clicked_count,
  q.first_opened_at,
  q.first_clicked_at
FROM email_queue q
WHERE q.opened_count > 0 OR q.clicked_count > 0;
```

## 🔌 Integration Examples

### SendGrid Integration

```typescript
// SendGrid webhook format
const sendgridPayload = {
  event: 'email.sent', // or 'email.failed'
  data: {
    queue_id: sgEvent.queue_id,
    contact_email: sgEvent.email,
    sent_at: sgEvent.timestamp,
    sender_id: sgEvent.sender_id,
    subject: sgEvent.subject,
    smtp_response: sgEvent.smtp_response
  }
};

await fetch('http://your-domain.com/api/webhooks/email-sent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(sendgridPayload)
});
```

### Mailgun Integration

```typescript
// Mailgun webhook format
const mailgunPayload = {
  event: 'email.sent',
  data: {
    queue_id: mailgunData['queue-id'],
    contact_email: mailgunData['recipient'],
    sent_at: new Date(mailgunData.timestamp * 1000).toISOString(),
    sender_id: mailgunData['sender-id'],
    subject: mailgunData.subject,
    smtp_response: mailgunData['smtp-response']
  }
};
```

### Custom Integration

```typescript
// Your custom email sending system
async function sendEmailWithWebhook(queueItem) {
  try {
    const result = await smtpSend(queueItem);

    // Notify webhook
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
          sender_id: queueItem.sender_id,
          subject: queueItem.subject,
          smtp_response: result.response
        }
      })
    });
  } catch (error) {
    // Notify webhook of failure
    await fetch(`${process.env.APP_URL}/api/webhooks/email-failed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'email.failed',
        data: {
          queue_id: queueItem.id,
          contact_email: queueItem.recipient_email,
          failed_at: new Date().toISOString(),
          error: error.message
        }
      })
    });
  }
}
```

## 🧪 Testing

### Manual Testing

```bash
# Test sent event
curl -X POST http://localhost:3000/api/webhooks/email-sent \
  -H "Content-Type: application/json" \
  -d @test-payloads/sent.json

# Test failed event
curl -X POST http://localhost:3000/api/webhooks/email-failed \
  -H "Content-Type: application/json" \
  -d @test-payloads/failed.json
```

### Automated Testing

```typescript
// Example test case
describe('Email Webhooks', () => {
  it('should process email.sent event', async () => {
    const payload = {
      event: 'email.sent',
      data: {
        queue_id: 'test-uuid',
        contact_email: 'test@example.com',
        sent_at: new Date().toISOString(),
        sender_id: 'sender-uuid',
        subject: 'Test'
      }
    };

    const response = await fetch('/api/webhooks/email-sent', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

## 📝 Environment Variables

```env
# Webhook Security (Optional)
WEBHOOK_SECRET=your-webhook-signing-secret

# Rate Limiting
WEBHOOK_RATE_LIMIT_WINDOW_MS=60000
WEBHOOK_RATE_LIMIT_MAX_REQUESTS=100

# Application URL (for callback URLs)
APP_URL=http://localhost:3000
```

## 🚨 Troubleshooting

### Webhook Not Received

1. Check endpoint is accessible: `curl http://your-domain.com/api/webhooks/email-sent`
2. Verify firewall allows incoming requests
3. Check Next.js logs for errors
4. Validate payload structure

### Database Errors

1. Ensure migration was run: Check tables exist
2. Verify database connection: Check `DATABASE_URL`
3. Check permissions: Ensure INSERT/UPDATE permissions

### Rate Limiting Issues

1. Adjust limits in `WebhookRateLimiter` constructor
2. Check IP detection: Verify `getClientIP()` returns correct IP
3. Clear rate limits: `rateLimiter.reset(clientIP)`

## 📚 Additional Resources

- [Next.js API Routes Documentation](https://nextjs.org/docs/api-routes/introduction)
- [Webhook Best Practices](https://sendgrid.com/docs/for-developers/tracking-events/event/)
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html)

## 🤝 Contributing

When adding new webhook types:

1. Add type to `EmailEventType` in `webhook-handler.ts`
2. Create validation function
3. Add handler function
4. Create route in `src/app/api/webhooks/`
5. Update this README

## 📄 License

Part of the email-sending-system project.
