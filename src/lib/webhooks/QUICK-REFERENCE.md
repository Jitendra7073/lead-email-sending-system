# Webhook Quick Reference

Fast reference guide for the email webhook system.

## 🚀 Quick Start

```bash
# 1. Run migration
psql -U user -d database -f src/lib/webhooks/migration.sql

# 2. Test webhooks
npm run test:webhooks

# 3. Check endpoints
curl http://localhost:3000/api/webhooks/email-sent
```

## 📡 Endpoints

### POST /api/webhooks/email-sent
```json
{
  "event": "email.sent",
  "data": {
    "queue_id": "uuid",
    "campaign_id": "uuid (optional)",
    "contact_email": "email",
    "sent_at": "ISO timestamp",
    "sender_id": "uuid",
    "subject": "subject",
    "smtp_response": "response (optional)",
    "timezone": "timezone (optional)"
  }
}
```

### POST /api/webhooks/email-failed
```json
{
  "event": "email.failed",
  "data": {
    "queue_id": "uuid",
    "campaign_id": "uuid (optional)",
    "contact_email": "email",
    "failed_at": "ISO timestamp",
    "error": "error message",
    "sender_id": "uuid (optional)",
    "subject": "subject (optional)"
  }
}
```

### POST /api/webhooks/email-opened
```json
{
  "event": "email.opened",
  "data": {
    "queue_id": "uuid",
    "contact_email": "email",
    "opened_at": "ISO timestamp",
    "ip_address": "ip (optional)",
    "user_agent": "agent (optional)"
  }
}
```

### POST /api/webhooks/email-clicked
```json
{
  "event": "email.clicked",
  "data": {
    "queue_id": "uuid",
    "contact_email": "email",
    "url": "clicked url",
    "clicked_at": "ISO timestamp",
    "ip_address": "ip (optional)",
    "user_agent": "agent (optional)"
  }
}
```

## 💻 Code Examples

### Send Webhook from Code
```typescript
async function notifyWebhook(eventType: string, data: any) {
  await fetch(`${process.env.APP_URL}/api/webhooks/${eventType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: eventType, data })
  });
}

// Usage
await notifyWebhook('email.sent', {
  queue_id: '123',
  contact_email: 'test@example.com',
  sent_at: new Date().toISOString(),
  sender_id: '456',
  subject: 'Test'
});
```

### Direct Handler Call
```typescript
import { handleEmailSentEvent } from '@/lib/webhooks/webhook-handler';

await handleEmailSentEvent({
  queue_id: '123',
  contact_email: 'test@example.com',
  sent_at: new Date().toISOString(),
  sender_id: '456',
  subject: 'Test'
});
```

### With Security
```typescript
import { verifyWebhookSignature, extractSignature } from '@/lib/webhooks/webhook-utils';

const rawBody = await request.text();
const signature = extractSignature(request);
const isValid = verifyWebhookSignature(rawBody, signature, process.env.WEBHOOK_SECRET);
```

## 🗄️ Database Queries

### Check Recent Webhooks
```sql
SELECT * FROM webhook_events
ORDER BY received_at DESC
LIMIT 20;
```

### Check Failed Sends
```sql
SELECT * FROM email_send_log
WHERE status = 'failed'
ORDER BY sent_at DESC
LIMIT 20;
```

### Check Queue Status
```sql
SELECT
  status,
  COUNT(*) as count,
  AVG(retry_count) as avg_retries
FROM email_queue
GROUP BY status;
```

### Open/Click Statistics
```sql
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE opened_count > 0) as opened,
  COUNT(*) FILTER (WHERE clicked_count > 0) as clicked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE opened_count > 0) / COUNT(*), 2) as open_rate
FROM email_queue
WHERE status = 'sent';
```

## 🔧 Common Tasks

### Retry Failed Emails
```sql
UPDATE email_queue
SET status = 'pending',
    scheduled_at = NOW()
WHERE status = 'failed'
  AND retry_count < max_retries;
```

### Get Webhook Statistics
```sql
SELECT
  event_type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE processed = TRUE) as processed,
  COUNT(*) FILTER (WHERE processed = FALSE) as unprocessed
FROM webhook_events
GROUP BY event_type;
```

### Clean Old Webhook Events
```sql
DELETE FROM webhook_events
WHERE received_at < NOW() - INTERVAL '30 days';
```

### Get Sender Performance
```sql
SELECT
  sender_id,
  COUNT(*) as total_sends,
  COUNT(*) FILTER (WHERE status = 'sent') as successful,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'sent') / COUNT(*), 2) as success_rate
FROM email_send_log
WHERE sent_at > NOW() - INTERVAL '7 days'
GROUP BY sender_id;
```

## 🧪 Testing

### Test with cURL
```bash
# Email sent
curl -X POST http://localhost:3000/api/webhooks/email-sent \
  -H "Content-Type: application/json" \
  -d @test-payloads/email-sent.json

# Email failed
curl -X POST http://localhost:3000/api/webhooks/email-failed \
  -H "Content-Type: application/json" \
  -d @test-payloads/email-failed.json

# Email opened
curl -X POST http://localhost:3000/api/webhooks/email-opened \
  -H "Content-Type: application/json" \
  -d @test-payloads/email-opened.json

# Email clicked
curl -X POST http://localhost:3000/api/webhooks/email-clicked \
  -H "Content-Type: application/json" \
  -d @test-payloads/email-clicked.json
```

### Test with Node.js
```typescript
const testWebhook = async (endpoint: string, payload: any) => {
  const response = await fetch(`http://localhost:3000${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await response.json();
};

// Test
await testWebhook('/api/webhooks/email-sent', {
  event: 'email.sent',
  data: {
    queue_id: 'test-123',
    contact_email: 'test@example.com',
    sent_at: new Date().toISOString(),
    sender_id: 'sender-123',
    subject: 'Test'
  }
});
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/api/webhooks/email-sent
curl http://localhost:3000/api/webhooks/email-failed
curl http://localhost:3000/api/webhooks/email-opened
curl http://localhost:3000/api/webhooks/email-clicked
```

### Check Logs
```sql
-- Unprocessed webhooks (potential issues)
SELECT * FROM webhook_events
WHERE processed = FALSE
ORDER BY received_at DESC;

-- Recent errors
SELECT * FROM email_send_log
WHERE status = 'failed'
ORDER BY sent_at DESC
LIMIT 10;

-- Processing time
SELECT
  event_type,
  AVG(EXTRACT(EPOCH FROM (processed_at - received_at))) as avg_seconds
FROM webhook_events
WHERE processed = TRUE
GROUP BY event_type;
```

## 🔍 Troubleshooting

### Webhook Not Received
1. Check server is running: `curl http://localhost:3000`
2. Check endpoint exists: `curl http://localhost:3000/api/webhooks/email-sent`
3. Check database connection
4. Review server logs

### Database Errors
1. Verify migration ran: `\dt webhook_events` in psql
2. Check permissions: Ensure INSERT/UPDATE access
3. Verify foreign keys exist

### Processing Errors
1. Check unprocessed webhooks: `SELECT * FROM webhook_events WHERE processed = FALSE`
2. Review error messages in payload
3. Verify queue_id exists in email_queue table

### Rate Limiting
1. Check client IP: `SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT 10`
2. Adjust rate limiter settings
3. Implement exponential backoff

## 📝 Types Reference

```typescript
// Event Types
type EmailEventType = 'email.sent' | 'email.failed' | 'email.opened' | 'email.clicked';

// Email Sent Data
interface EmailSentData {
  queue_id: string;
  campaign_id?: string;
  contact_email: string;
  sent_at: string;
  sender_id: string;
  subject: string;
  smtp_response?: string;
  timezone?: string;
}

// Email Failed Data
interface EmailFailedData {
  queue_id: string;
  campaign_id?: string;
  contact_email: string;
  failed_at: string;
  error: string;
  sender_id?: string;
  subject?: string;
}

// Webhook Result
interface WebhookResult {
  success: boolean;
  message: string;
  data?: any;
}
```

## 🔐 Security Checklist

- [ ] Use HTTPS in production
- [ ] Set WEBHOOK_SECRET environment variable
- [ ] Enable signature verification
- [ ] Configure rate limiting
- [ ] Validate all payloads
- [ ] Monitor for suspicious activity
- [ ] Keep webhook URLs private
- [ ] Use environment-specific secrets

## 📚 Additional Resources

- Full documentation: `src/lib/webhooks/README.md`
- Integration guide: `src/lib/webhooks/INTEGRATION-GUIDE.md`
- Implementation summary: `src/lib/webhooks/IMPLEMENTATION-SUMMARY.md`
- Test payloads: `test-payloads/`
- Database migration: `src/lib/webhooks/migration.sql`

## 🆘 Getting Help

1. Check documentation files
2. Review database logs
3. Test with example payloads
4. Check Next.js server logs
5. Verify database schema
6. Test endpoints individually

---

**Quick Reference v1.0.0** - Last updated: April 7, 2026
