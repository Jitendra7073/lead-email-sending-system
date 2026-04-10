import { google } from "googleapis";
import { getGmailClient, getGmailSettings } from "./gmail-client";
import { dbPool } from "../db/postgres";
import Bottleneck from "bottleneck";

// --- Configuration ---

// Rate limiter: 4 requests per second to avoid Gmail API throttling
const limiter = new Bottleneck({
  minTime: 250,
});

// --- Utility Helpers ---

/**
 * Normalizes Message-IDs by removing angle brackets and trimming whitespace.
 * Essential for comparing Gmail headers to database records.
 */
const normalizeId = (id: string | null | undefined): string => {
  if (!id) return "";
  return id.replace(/[<>]/g, "").trim();
};

/**
 * Extracts email from "Name <email@done.com>"
 */
export function parseEmailHeader(header: string): string {
  const match = header.match(/<(.+)>/);
  return match ? match[1] : header;
}

/**
 * Extracts name from "Name <email@done.com>"
 */
export function parseNameHeader(header: string): string {
  const match = header.match(/(.*)\s*<.+>/);
  return match ? match[1].trim() : header;
}

/**
 * Decodes and extracts text content from Gmail message payload
 */
function extractEmailBody(message: any): string {
  const payload = message.payload;
  if (!payload) return "";

  function extractTextFromPart(part: any): string {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64").toString("utf-8");
    }
    if (part.mimeType === "text/html" && part.body?.data) {
      const html = Buffer.from(part.body.data, "base64").toString("utf-8");
      // Basic HTML strip
      return html
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    if (part.parts) {
      return part.parts.map(extractTextFromPart).join("\n");
    }
    return "";
  }

  return extractTextFromPart(payload);
}

// --- Database Initialization ---

async function ensureReplyTable() {
  const client = await dbPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_replies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        queue_id UUID REFERENCES email_queue(id) ON DELETE CASCADE,
        message_id TEXT NOT NULL,
        reply_message_id TEXT NOT NULL,
        from_email TEXT NOT NULL,
        from_name TEXT,
        subject TEXT NOT NULL,
        body TEXT,
        received_at TIMESTAMPTZ DEFAULT NOW(),
        processed BOOLEAN DEFAULT FALSE,
        thread_id TEXT,
        in_reply_to TEXT,
        is_reply BOOLEAN DEFAULT true,
        recipient_email TEXT,
        original_subject TEXT,
        CONSTRAINT unique_reply_msg_id UNIQUE (reply_message_id)
      );

      CREATE INDEX IF NOT EXISTS idx_email_replies_queue_id ON email_replies(queue_id);
      CREATE INDEX IF NOT EXI STS idx_email_replies_reply_message_id ON email_replies(reply_message_id);
      CREATE INDEX IF NOT EXISTS idx_email_replies_in_reply_to ON email_replies(in_reply_to);
    `);
  } finally {
    client.release();
  }
}

// --- Core Logic: Detection ---

export interface ReplyTrackingOptions {
  startDate?: Date;
  endDate?: Date;
  recipientEmail?: string;
  specificMessageId?: string;
}

export async function checkInboxForReplies(options?: ReplyTrackingOptions): Promise<void> {
  const client = await dbPool.connect();
  try {
    await ensureReplyTable();
    const gmail = await getGmailClient();

    // Build query for sent emails with optional filters
    let query = `SELECT id, message_id, recipient_email, subject, sent_at FROM email_queue WHERE message_id IS NOT NULL AND status = 'sent'`;
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Apply date filters if provided
    if (options?.startDate) {
      query += ` AND sent_at >= $${paramIndex++}`;
      queryParams.push(options.startDate);
    } else {
      // Default: look back 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query += ` AND sent_at >= $${paramIndex++}`;
      queryParams.push(thirtyDaysAgo);
    }

    if (options?.endDate) {
      query += ` AND sent_at <= $${paramIndex++}`;
      queryParams.push(options.endDate);
    }

    if (options?.recipientEmail) {
      query += ` AND recipient_email = $${paramIndex++}`;
      queryParams.push(options.recipientEmail);
    }

    if (options?.specificMessageId) {
      query += ` AND message_id = $${paramIndex++}`;
      queryParams.push(options.specificMessageId);
    }

    query += ` ORDER BY sent_at DESC`;

    const sentEmailsResult = await client.query(query, queryParams);

    if (sentEmailsResult.rows.length === 0) {
      console.log("😴 No sent emails to track.");
      return;
    }

    // Build lookup maps for O(1) performance
    const sentMapByMessageId = new Map();
    const sentMapByThreadId = new Map();
    const recipientEmails = new Set<string>();

    sentEmailsResult.rows.forEach((row) => {
      sentMapByMessageId.set(normalizeId(row.message_id), row);
      recipientEmails.add(row.recipient_email);
    });

    // Build Gmail search query - CRITICAL FIX: Remove is:unread to find ALL replies
    let searchQuery = "in:inbox";

    // Add sender filter if we have specific recipients
    if (recipientEmails.size > 0 && !(options?.specificMessageId)) {
      const recipientList = Array.from(recipientEmails).join(' OR ');
      searchQuery += ` from:(${recipientList})`;
    }

    // Add date range to Gmail search
    if (options?.startDate) {
      searchQuery += ` after:${Math.floor(options.startDate.getTime() / 1000)}`;
    }
    if (options?.endDate) {
      searchQuery += ` before:${Math.floor(options.endDate.getTime() / 1000)}`;
    }

    const response = await limiter.schedule(() =>
      gmail.users.messages.list({
        userId: "me",
        q: searchQuery,
        maxResults: 100,
      }),
    );

    const messages = response.data.messages || [];
    if (messages.length === 0) {
      console.log("📭 No messages found matching search criteria.");
      return;
    }

    console.log(`🔍 Checking ${messages.length} messages for replies...`);

    let newRepliesFound = 0;

    for (const msg of messages) {
      try {
        const metadata = await limiter.schedule(() =>
          gmail.users.messages.get({
            userId: "me",
            id: msg.id!,
            format: "metadata",
            metadataHeaders: ["In-Reply-To", "From", "Subject", "Message-ID", "References", "Thread-Id"],
          }),
        );

        const headers = metadata.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
            ?.value;

        const inReplyTo = normalizeId(getHeader("In-Reply-To"));
        const references = getHeader("References")?.split(/\s+/).map(normalizeId).filter(Boolean) || [];
        const threadId = metadata.data.threadId;
        const subject = getHeader("Subject") || "";

        // MULTIPLE MATCHING STRATEGIES
        let matchedEmail = null;

        // Strategy 1: Match by In-Reply-To header (most reliable)
        if (inReplyTo && sentMapByMessageId.has(inReplyTo)) {
          matchedEmail = sentMapByMessageId.get(inReplyTo);
        }

        // Strategy 2: Match by References header (contains thread history)
        if (!matchedEmail && references.length > 0) {
          for (const ref of references) {
            if (sentMapByMessageId.has(ref)) {
              matchedEmail = sentMapByMessageId.get(ref);
              break;
            }
          }
        }

        // Strategy 3: Match by Thread ID (Gmail conversations)
        if (!matchedEmail && threadId) {
          // This requires additional API call to get thread details
          // For now, we'll skip this as it's more expensive
        }

        // Strategy 4: Match by Subject (RE:, FW:, etc.) + Sender
        if (!matchedEmail) {
          const fromEmail = parseEmailHeader(getHeader("From") || "");
          const isReply = /^(re|fw|fwd|reply|forward):/i.test(subject);

          if (isReply && recipientEmails.has(fromEmail)) {
            // Find sent email with matching subject (without RE:/FW:)
            const baseSubject = subject.replace(/^(re|fw|fwd|reply|forward):\s*/i, "").trim().toLowerCase();
            matchedEmail = sentEmailsResult.rows.find((row: any) => {
              const sentSubject = row.subject.toLowerCase();
              return sentSubject.includes(baseSubject) || baseSubject.includes(sentSubject);
            });
          }
        }

        if (matchedEmail) {
          // Check if reply already exists
          const existingReply = await client.query(
            'SELECT id FROM email_replies WHERE reply_message_id = $1',
            [msg.id]
          );

          if (existingReply.rows.length === 0) {
            // New reply - fetch full message
            const fullMessage = await limiter.schedule(() =>
              gmail.users.messages.get({
                userId: "me",
                id: msg.id!,
                format: "full",
              }),
            );

            const fromHeader = getHeader("From") || "";
            const replyMsgId = getHeader("Message-ID") || "";

            await client.query(
              `INSERT INTO email_replies (
                queue_id, message_id, reply_message_id, from_email, from_name,
                subject, body, thread_id, in_reply_to, recipient_email, original_subject
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (reply_message_id)
              DO UPDATE SET received_at = NOW(), processed = FALSE`,
              [
                matchedEmail.id,
                normalizeId(replyMsgId),
                msg.id,
                parseEmailHeader(fromHeader),
                parseNameHeader(fromHeader),
                subject,
                extractEmailBody(fullMessage.data),
                threadId,
                inReplyTo,
                matchedEmail.recipient_email,
                matchedEmail.subject
              ],
            );
            newRepliesFound++;
            console.log(`✅ New reply tracked: ${msg.id} from ${parseEmailHeader(fromHeader)}`);
          }
        }
      } catch (innerError) {
        console.error(
          `Error processing individual message ${msg.id}:`,
          innerError,
        );
      }
    }

    console.log(`🎉 Reply check complete. Found ${newRepliesFound} new replies.`);
  } catch (error) {
    console.error("Critical error in checkInboxForReplies:", error);
  } finally {
    client.release();
  }
}

// --- Data Retrieval for API ---

export async function getRepliesForQueueItem(queueId: string) {
  const client = await dbPool.connect();
  try {
    const result = await client.query(
      `SELECT DISTINCT ON (r.id) r.*, eq.recipient_email, eq.subject as original_subject
       FROM email_replies r
       JOIN email_queue eq ON r.queue_id = eq.id
       WHERE r.queue_id = $1
       ORDER BY r.id, r.received_at DESC`,
      [queueId],
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getAllRecentReplies(limit: number = 50) {
  const client = await dbPool.connect();
  try {
    const result = await client.query(
      `SELECT DISTINCT ON (r.id) r.*, eq.recipient_email, eq.subject as original_subject
       FROM email_replies r
       JOIN email_queue eq ON r.queue_id = eq.id
       ORDER BY r.id, r.received_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows;
  } finally {
    client.release();
  }
}

// --- Lifecycle ---

export async function initializeReplyTracking() {
  const settings = await getGmailSettings();
  if (!settings.clientId || !settings.clientSecret || !settings.refreshToken) {
    console.warn("⚠️ Gmail credentials missing for reply tracking (DB/Env).");
    return;
  }

  // Run on startup with default 30-day lookback
  await checkInboxForReplies();

  // Polling interval (5 minutes) - checks for new replies
  setInterval(() => checkInboxForReplies(), 5 * 60 * 1000);
  console.log("🔍 Reply tracking initialized with improved detection.");
}
