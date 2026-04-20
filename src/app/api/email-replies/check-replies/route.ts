import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { getGmailClient } from '@/lib/email/gmail-client';

// Normalize Message-IDs by stripping angle brackets for consistent comparison
function normalizeId(id: string | null | undefined): string {
  if (!id) return '';
  return id.replace(/[<>]/g, '').trim();
}

// Parse email address from "Name <email@domain.com>"
function parseEmailHeader(header: string): string {
  const match = header.match(/<(.+)>/);
  return match ? match[1].toLowerCase().trim() : header.toLowerCase().trim();
}

// Parse display name from "Name <email@domain.com>"
function parseNameHeader(header: string): string {
  const match = header.match(/(.*)\s*<.+>/);
  return match ? match[1].trim() : header;
}

// Extract plain text body from Gmail message payload
function extractEmailBody(message: any): string {
  const payload = message.payload;
  if (!payload) return '';

  function extractTextFromPart(part: any): string {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8');
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
      return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    if (part.parts) {
      return part.parts.map(extractTextFromPart).join('\n');
    }
    return '';
  }

  return extractTextFromPart(payload);
}

// Strip Re:/Fwd: prefixes and template variables for subject comparison
function cleanSubject(subject: string): string {
  return subject
    .replace(/^(re|fw|fwd|reply|forward):\s*/i, '')
    .replace(/\{\{[^}]+\}\}/g, '') // strip {{template_vars}}
    .trim()
    .toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { startDate, endDate, recipientEmail, force = false } = body;

    // Authenticate Gmail
    let gmail: any;
    try {
      gmail = await getGmailClient();
    } catch (err: any) {
      return NextResponse.json({
        success: false,
        error: 'Gmail integration is not configured. Please check your settings.',
        stage: 'authentication',
        details: err.message
      }, { status: 400 });
    }

    // --- Stage 1: Load sent emails from DB ---
    // Use 90-day lookback by default to cast a wide net for matching
    const lookbackDate = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const queryParams: any[] = [lookbackDate];
    let sentQuery = `
      SELECT id, message_id, recipient_email, subject, sent_at
      FROM email_queue
      WHERE message_id IS NOT NULL
        AND status = 'sent'
        AND sent_at >= $1
    `;

    if (endDate) {
      sentQuery += ` AND sent_at <= $2`;
      queryParams.push(new Date(endDate));
    }
    if (recipientEmail) {
      sentQuery += ` AND recipient_email = $${queryParams.length + 1}`;
      queryParams.push(recipientEmail);
    }

    sentQuery += ` ORDER BY sent_at DESC`;

    const sentEmails: any[] = await executeQuery(sentQuery, queryParams);

    if (!sentEmails || sentEmails.length === 0) {
      return NextResponse.json({
        success: true,
        stage: 'fetching_sent',
        details: {
          sentEmailsFound: 0,
          message: 'No sent emails found matching the applied filters',
          unreadRepliesFound: 0,
          newRepliesProcessed: 0,
          errors: 0,
          replies: [],
          errorsList: []
        }
      });
    }

    // Build O(1) lookup maps
    // Key: normalized message_id (no angle brackets) → sent email row
    const byMessageId = new Map<string, any>();
    // Key: recipient_email → array of sent emails (for subject fallback)
    const byRecipient = new Map<string, any[]>();

    for (const row of sentEmails) {
      const normId = normalizeId(row.message_id);
      if (normId) byMessageId.set(normId, row);

      const email = row.recipient_email?.toLowerCase().trim();
      if (email) {
        if (!byRecipient.has(email)) byRecipient.set(email, []);
        byRecipient.get(email)!.push(row);
      }
    }

    // --- Stage 2: Search Gmail inbox for replies ---
    // Use `is:reply` to filter only actual reply messages, cutting noise dramatically
    let searchQuery = 'in:inbox is:reply';

    if (recipientEmail) {
      // Searching for replies FROM a specific person
      searchQuery += ` from:(${recipientEmail})`;
    } else {
      // Limit to replies from known recipients only
      const knownEmails = Array.from(byRecipient.keys());
      if (knownEmails.length > 0 && knownEmails.length <= 30) {
        searchQuery += ` from:(${knownEmails.join(' OR ')})`;
      }
    }

    // Date range filter
    if (startDate) {
      searchQuery += ` after:${Math.floor(new Date(startDate).getTime() / 1000)}`;
    }
    if (endDate) {
      searchQuery += ` before:${Math.floor(new Date(endDate).getTime() / 1000)}`;
    }

    // Fetch up to 100 messages with pagination support
    let allMessages: any[] = [];
    let pageToken: string | undefined;

    do {
      const response: any = await gmail.users.messages.list({
        userId: 'me',
        q: searchQuery,
        maxResults: 100,
        ...(pageToken ? { pageToken } : {})
      });

      const msgs = response.data.messages || [];
      allMessages = allMessages.concat(msgs);
      pageToken = response.data.nextPageToken;

      // Cap at 500 to avoid runaway API usage
      if (allMessages.length >= 500) break;
    } while (pageToken);

    if (allMessages.length === 0) {
      return NextResponse.json({
        success: true,
        stage: 'completed',
        details: {
          sentEmailsFound: sentEmails.length,
          unreadRepliesFound: 0,
          newRepliesProcessed: 0,
          errors: 0,
          message: 'No replies found in inbox',
          replies: [],
          errorsList: []
        }
      });
    }

    // --- Stage 3: Match and store replies ---
    const repliesFound: any[] = [];
    const errors: any[] = [];

    for (const msg of allMessages) {
      try {
        // Fetch metadata headers only (cheap API call)
        const metaRes = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['In-Reply-To', 'References', 'From', 'Subject', 'Message-ID', 'Date'],
        });

        const headers = metaRes.data.payload?.headers || [];
        const getHeader = (name: string): string =>
          headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        const rawInReplyTo = getHeader('In-Reply-To');
        const rawReferences = getHeader('References');
        const rawFrom = getHeader('From');
        const rawSubject = getHeader('Subject');
        const rawDate = getHeader('Date');
        const threadId = metaRes.data.threadId || '';

        const inReplyTo = normalizeId(rawInReplyTo);
        const references = rawReferences
          ? rawReferences.split(/\s+/).map(normalizeId).filter(Boolean)
          : [];
        const fromEmail = parseEmailHeader(rawFrom);

        let originalEmail: any = null;
        let matchStrategy = '';

        // Strategy 1: In-Reply-To header — most reliable, exact match
        if (inReplyTo && byMessageId.has(inReplyTo)) {
          originalEmail = byMessageId.get(inReplyTo);
          matchStrategy = 'In-Reply-To';
        }

        // Strategy 2: References header — catches threaded replies
        if (!originalEmail && references.length > 0) {
          for (const ref of references) {
            if (byMessageId.has(ref)) {
              originalEmail = byMessageId.get(ref);
              matchStrategy = 'References';
              break;
            }
          }
        }

        // Strategy 3: Sender email + subject similarity
        // Only runs if the sender is a known recipient (avoids false positives)
        if (!originalEmail && byRecipient.has(fromEmail)) {
          const candidates = byRecipient.get(fromEmail)!;
          const cleanReply = cleanSubject(rawSubject);

          if (cleanReply.length >= 5) { // avoid matching on empty/trivial subjects
            for (const candidate of candidates) {
              const cleanSent = cleanSubject(candidate.subject);
              if (
                cleanSent.length >= 5 &&
                (cleanReply.includes(cleanSent) || cleanSent.includes(cleanReply))
              ) {
                originalEmail = candidate;
                matchStrategy = 'Sender+Subject';
                break;
              }
            }
          }
        }

        if (!originalEmail) {
          errors.push({
            messageId: msg.id,
            reason: `Could not match reply to any sent email. From: ${rawFrom}, Subject: ${rawSubject}, In-Reply-To: ${rawInReplyTo || 'none'}, Match Strategy: none`
          });
          continue;
        }

        // Check for duplicate before fetching full message body
        const existing = await executeQuery(
          'SELECT id FROM email_replies WHERE reply_message_id = $1',
          [msg.id]
        );

        if (existing && existing.length > 0 && !force) {
          // Already tracked, skip
          continue;
        }

        // Fetch full message for body (only for matched replies)
        const fullMsg = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        });

        const body = extractEmailBody(fullMsg.data);
        const fromName = parseNameHeader(rawFrom);
        const replyMsgId = normalizeId(getHeader('Message-ID'));

        // Parse actual received date from Gmail internalDate (milliseconds epoch)
        const receivedAt = fullMsg.data.internalDate
          ? new Date(parseInt(fullMsg.data.internalDate, 10)).toISOString()
          : new Date().toISOString();

        if (existing && existing.length > 0) {
          // force=true: update existing record
          await executeQuery(
            `UPDATE email_replies
             SET from_email = $1, from_name = $2, subject = $3, body = $4,
                 thread_id = $5, in_reply_to = $6, received_at = $7, processed = FALSE
             WHERE reply_message_id = $8`,
            [fromEmail, fromName, rawSubject, body, threadId, inReplyTo, receivedAt, msg.id]
          );
        } else {
          await executeQuery(
            `INSERT INTO email_replies (
               queue_id, message_id, reply_message_id, from_email, from_name,
               subject, body, thread_id, in_reply_to, is_reply,
               recipient_email, original_subject, received_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (reply_message_id) DO UPDATE SET
               processed = FALSE,
               received_at = EXCLUDED.received_at`,
            [
              originalEmail.id,
              replyMsgId,
              msg.id,
              fromEmail,
              fromName,
              rawSubject,
              body,
              threadId,
              inReplyTo,
              true,
              originalEmail.recipient_email,
              originalEmail.subject,
              receivedAt
            ]
          );
        }

        // Mark as read in Gmail
        await gmail.users.messages.modify({
          userId: 'me',
          id: msg.id!,
          requestBody: { removeLabelIds: ['UNREAD'] },
        });

        repliesFound.push({
          id: msg.id,
          from: fromName || fromEmail,
          fromEmail,
          subject: rawSubject || 'No Subject',
          body: body.substring(0, 200) + (body.length > 200 ? '...' : ''),
          receivedAt,
          originalEmailId: originalEmail.id,
          originalSubject: originalEmail.subject,
          matchStrategy
        });

      } catch (err: any) {
        errors.push({
          messageId: msg.id,
          reason: err.message || 'Unknown error processing message'
        });
      }
    }

    return NextResponse.json({
      success: true,
      stage: 'completed',
      details: {
        sentEmailsFound: sentEmails.length,
        unreadRepliesFound: allMessages.length,
        newRepliesProcessed: repliesFound.length,
        errors: errors.length,
        replies: repliesFound,
        errorsList: errors
      }
    });

  } catch (error: any) {
    console.error('Error in check-replies:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stage: 'error',
      details: null
    }, { status: 500 });
  }
}
