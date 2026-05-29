import { dbPool } from "@/lib/db/postgres";
import { getCountryName } from "@/lib/email-variables";
import { sendEmailWithResend } from "@/lib/email/resend-sender";
import { activateDependentEmails } from "@/lib/queue/dependency-activator";
import { markAsFailed, markAsSent } from "@/lib/queue/queue-status-manager";

export interface QueueProcessorOptions {
  batchSize?: number;
  maxRetries?: number;
}

export interface QueueProcessorResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  reset_daily_limits: boolean;
  results: Array<{
    id: string;
    status: "sent" | "failed" | "skipped";
    recipient_email?: string;
    message_id?: string;
    error?: string;
  }>;
}

interface QueueItem {
  id: string;
  sender_id?: string | null;
  recipient_email: string;
  recipient_name?: string | null;
  subject: string;
  html_content?: string | null;
  website_url?: string | null;
  country_code?: string | null;
  site_country?: string | null;
}

interface Sender {
  id: string;
  name?: string | null;
  email: string;
  service?: string | null;
}

const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_MAX_RETRIES = 3;

export async function resetSenderDailyLimitsIfNeeded(): Promise<boolean> {
  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS email_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        label TEXT,
        description TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const today = new Date().toISOString().slice(0, 10);
    const result = await client.query(
      `SELECT value FROM email_settings WHERE key = 'sender_daily_limit_last_reset' FOR UPDATE`,
    );

    if (result.rows[0]?.value === today) {
      await client.query("COMMIT");
      return false;
    }

    await client.query(`UPDATE email_senders SET sent_today = 0`);
    await client.query(
      `INSERT INTO email_settings (key, value, label, description, updated_at)
       VALUES (
         'sender_daily_limit_last_reset',
         $1,
         'Sender Daily Limit Last Reset',
         'UTC date when sender sent_today counters were last reset',
         NOW()
       )
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [today],
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function processDueQueue(
  options: QueueProcessorOptions = {},
): Promise<QueueProcessorResult> {
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
  const resetDailyLimits = await resetSenderDailyLimitsIfNeeded();
  const result: QueueProcessorResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    reset_daily_limits: resetDailyLimits,
    results: [],
  };

  const queueItems = await claimDueQueueItems(batchSize);

  for (const item of queueItems) {
    result.processed++;

    try {
      const sender = await ensureSenderForQueueItem(item);
      if (!sender) {
        throw new Error("No active senders available with remaining daily capacity");
      }

      const countryCodeInput = item.country_code || item.site_country;
      const countryName = countryCodeInput
        ? await getCountryName(countryCodeInput)
        : "";

      const info = await sendEmailWithResend(
        sender.id,
        item.recipient_email,
        item.subject,
        item.html_content || "",
        item.id,
        {
          recipientName: item.recipient_name || undefined,
          recipientEmail: item.recipient_email,
          websiteUrl: item.website_url || undefined,
          senderName: sender.name || undefined,
          region: countryName,
        },
      );

      await markAsSent(item.id, info.messageId, {
        provider: "resend",
        sent_from: info.fromEmail,
      });

      await dbPool.query(
        `UPDATE email_senders SET sent_today = sent_today + 1 WHERE id = $1`,
        [sender.id],
      );

      await activateDependentEmails(item.id, new Date());

      result.sent++;
      result.results.push({
        id: item.id,
        status: "sent",
        recipient_email: item.recipient_email,
        message_id: info.messageId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown send error";
      result.failed++;
      const failure = await markAsFailed(
        item.id,
        message,
        maxRetries,
      );

      result.results.push({
        id: item.id,
        status: "failed",
        recipient_email: item.recipient_email,
        error: `${message} (${failure.new_status})`,
      });
    }
  }

  return result;
}

async function claimDueQueueItems(batchSize: number): Promise<QueueItem[]> {
  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");

    const claimResult = await client.query(
      `
      WITH due_items AS (
        SELECT q.id
        FROM email_queue q
        WHERE q.status IN ('queued', 'pending', 'scheduled', 'ready_to_send')
          AND COALESCE(q.adjusted_scheduled_at, q.scheduled_at, NOW()) <= NOW()
          AND COALESCE(q.dependency_satisfied, TRUE) = TRUE
        ORDER BY q.contact_id, q.sequence_position, COALESCE(q.adjusted_scheduled_at, q.scheduled_at) ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1
      )
      UPDATE email_queue q
      SET status = 'sending', updated_at = NOW()
      FROM due_items
      WHERE q.id = due_items.id
      RETURNING q.*
      `,
      [batchSize],
    );

    await client.query("COMMIT");

    if (claimResult.rows.length === 0) {
      return [];
    }

    const ids = claimResult.rows.map((row) => row.id);
    const detailResult = await dbPool.query(
      `
      SELECT q.*,
             st.url as website_url,
             c.country_code,
             st.country as site_country
      FROM email_queue q
      LEFT JOIN contacts c ON q.contact_id = c.id
      LEFT JOIN sites st ON c.site_id = st.id
      WHERE q.id = ANY($1::uuid[])
      ORDER BY q.contact_id, q.sequence_position, COALESCE(q.adjusted_scheduled_at, q.scheduled_at) ASC
      `,
      [ids],
    );

    return detailResult.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureSenderForQueueItem(item: QueueItem): Promise<Sender | null> {
  if (item.sender_id) {
    const existing = await dbPool.query(
      `SELECT * FROM email_senders WHERE id = $1 AND is_active = true AND sent_today < daily_limit LIMIT 1`,
      [item.sender_id],
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }
  }

  const available = await dbPool.query(
    `SELECT *
     FROM email_senders
     WHERE is_active = true
       AND sent_today < daily_limit
     ORDER BY sent_today ASC, daily_limit DESC, created_at ASC
     LIMIT 1`,
  );

  const sender = available.rows[0];
  if (!sender) return null;

  await dbPool.query(
    `UPDATE email_queue SET sender_id = $1, updated_at = NOW() WHERE id = $2`,
    [sender.id, item.id],
  );

  return sender;
}
