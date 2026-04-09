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
      CREATE INDEX IF NOT EXISTS idx_email_replies_reply_message_id ON email_replies(reply_message_id);
      CREATE INDEX IF NOT EXISTS idx_email_replies_in_reply_to ON email_replies(in_reply_to);
    `);
  } finally {
    client.release();
  }
}

// --- Core Logic: Detection ---

export async function checkInboxForReplies(): Promise<void> {
  const client = await dbPool.connect();
  try {
    await ensureReplyTable();
    const gmail = await getGmailClient();

    // Look back at sent emails from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sentEmailsResult = await client.query(
      `SELECT id, message_id FROM email_queue 
       WHERE message_id IS NOT NULL AND sent_at >= $1 AND status = 'sent'`,
      [thirtyDaysAgo],
    );

    if (sentEmailsResult.rows.length === 0) {
      console.log("😴 No sent emails to track.");
      return;
    }

    // Build lookup map for O(1) performance
    const sentMap = new Map();
    sentEmailsResult.rows.forEach((row) => {
      sentMap.set(normalizeId(row.message_id), row.id);
    });

    const response = await limiter.schedule(() =>
      gmail.users.messages.list({
        userId: "me",
        q: "is:unread",
        maxResults: 50,
      }),
    );

    const messages = response.data.messages || [];
    if (messages.length === 0) return;

    for (const msg of messages) {
      try {
        const metadata = await limiter.schedule(() =>
          gmail.users.messages.get({
            userId: "me",
            id: msg.id!,
            format: "metadata",
            metadataHeaders: ["In-Reply-To", "From", "Subject", "Message-ID"],
          }),
        );

        const headers = metadata.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
            ?.value;

        const rawInReplyTo = getHeader("In-Reply-To");
        const normalizedInReplyTo = normalizeId(rawInReplyTo);
        const queueId = sentMap.get(normalizedInReplyTo);

        if (queueId) {
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
              subject, body, thread_id, in_reply_to
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (reply_message_id) 
            DO UPDATE SET received_at = NOW()`,
            [
              queueId,
              normalizeId(replyMsgId),
              msg.id,
              parseEmailHeader(fromHeader),
              parseNameHeader(fromHeader),
              getHeader("Subject") || "No Subject",
              extractEmailBody(fullMessage.data),
              fullMessage.data.threadId,
              normalizedInReplyTo,
            ],
          );

          // Mark as read to avoid duplicate processing
          await limiter.schedule(() =>
            gmail.users.messages.modify({
              userId: "me",
              id: msg.id!,
              requestBody: { removeLabelIds: ["UNREAD"] },
            }),
          );
          console.log(`✅ Tracked and marked read: ${msg.id}`);
        }
      } catch (innerError) {
        console.error(
          `Error processing individual message ${msg.id}:`,
          innerError,
        );
      }
    }
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
      `SELECT r.*, eq.recipient_email, eq.subject as original_subject
       FROM email_replies r
       JOIN email_queue eq ON r.queue_id = eq.id
       WHERE r.queue_id = $1
       ORDER BY r.received_at DESC`,
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
      `SELECT r.*, eq.recipient_email, eq.subject as original_subject
       FROM email_replies r
       JOIN email_queue eq ON r.queue_id = eq.id
       ORDER BY r.received_at DESC
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

  // Run on startup
  await checkInboxForReplies();

  // Polling interval (5 minutes)
  setInterval(checkInboxForReplies, 5 * 60 * 1000);
  console.log("🔍 Reply tracking initialized.");
}
