import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { getGmailClient, getGmailSettings } from '@/lib/email/gmail-client';

// Stage 1 configuration handled dynamically in POST

// Parse email from header
function parseEmailHeader(header: string): string {
  const match = header.match(/<(.+)>/);
  return match ? match[1] : header;
}

// Parse name from header
function parseNameHeader(header: string): string {
  const match = header.match(/(.*)\s*<.+>/);
  return match ? match[1].trim() : header;
}

// Extract email body from Gmail message
function extractEmailBody(message: any): string {
  const payload = message.payload;

  function extractTextFromPart(part: any): string {
    if (part.mimeType === 'text/plain' && part.body) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8');
    }
    if (part.mimeType === 'text/html' && part.body) {
      const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
      return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    if (part.parts) {
      return part.parts.map(extractTextFromPart).join('\n');
    }
    return '';
  }

  return extractTextFromPart(payload);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      startDate, 
      endDate, 
      recipientEmail,
      searchDirectly = false,
      force = false 
    } = body;

    // Stage 0: Get Gmail client and check settings
    let gmail;
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

    let sentEmails: any[] = [];
    let searchQuery = 'is:unread';

    if (searchDirectly) {
      // Stage 1: Skip DB, build Gmail search query directly from filters
      if (recipientEmail) searchQuery += ` from:(${recipientEmail})`;
      if (startDate) searchQuery += ` after:${Math.floor(new Date(startDate).getTime() / 1000)}`;
      if (endDate) searchQuery += ` before:${Math.floor(new Date(endDate).getTime() / 1000)}`;
      
      // We still need to fetch some sent emails later for matching, or match them one-by-one
    } else {
      // Stage 1: Legacy - Fetch sent emails from DB first
      let query = `
        SELECT id, message_id, recipient_email, subject
        FROM email_queue
        WHERE message_id IS NOT NULL
        AND status = 'sent'
      `;
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (startDate) {
        query += ` AND sent_at >= $${paramIndex++}`;
        queryParams.push(new Date(startDate));
      } else {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query += ` AND sent_at >= $${paramIndex++}`;
        queryParams.push(thirtyDaysAgo);
      }

      if (endDate) {
        query += ` AND sent_at <= $${paramIndex++}`;
        queryParams.push(new Date(endDate));
      }

      if (recipientEmail) {
        query += ` AND recipient_email = $${paramIndex++}`;
        queryParams.push(recipientEmail);
      }

      query += ` ORDER BY sent_at DESC`;
      sentEmails = await executeQuery(query, queryParams);

      if (!sentEmails || sentEmails.length === 0) {
        return NextResponse.json({
          success: true,
          stage: 'fetching_sent',
          details: {
            sentEmailsFound: 0,
            message: (startDate || endDate || recipientEmail) 
              ? 'No sent emails found matching the applied filters' 
              : 'No sent emails found in the last 30 days',
            repliesFound: []
          }
        });
      }

      const recipients = [...new Set(sentEmails.map((e: any) => e.recipient_email))];
      searchQuery += ` from:(${recipients.join(',')})`;
    }

    // Stage 2: Search for new replies
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: 50,
    });

    const messages = response.data.messages;

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: true,
        stage: 'searching_replies',
        details: {
          sentEmailsFound: searchDirectly ? 'N/A' : sentEmails.length,
          message: 'No new unread replies found in inbox match',
          repliesFound: []
        }
      });
    }

    // Stage 3: Process each reply
    const repliesFound = [];
    const errors = [];

    for (const msg of messages) {
      try {
        // Get message metadata
        const messageData = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: [
            'In-Reply-To',
            'From',
            'Subject',
            'Message-ID',
            'References',
          ],
        });

        const headers = messageData.data.payload?.headers;
        if (!headers) {
          errors.push({
            messageId: msg.id,
            reason: 'No headers found in message'
          });
          continue;
        }

        const inReplyToHeader = headers.find((h: any) => h.name === 'In-Reply-To');
        const fromHeader = headers.find((h: any) => h.name === 'From');
        const subjectHeader = headers.find((h: any) => h.name === 'Subject');
        const messageIdHeader = headers.find((h: any) => h.name === 'Message-ID');

        if (!inReplyToHeader || !messageIdHeader) {
          errors.push({
            messageId: msg.id,
            reason: 'Missing In-Reply-To or Message-ID header'
          });
          continue;
        }

        // Find the original email this is replying to
        let originalEmail = sentEmails.find(
          (e: any) => e.message_id === inReplyToHeader.value
        );

        if (!originalEmail && searchDirectly) {
          // If searching directly, we might not have the sent email in our local list yet
          const matchResult = await executeQuery(
            'SELECT id, recipient_email, subject, message_id FROM email_queue WHERE message_id = $1 LIMIT 1',
            [inReplyToHeader.value]
          );
          if (matchResult && matchResult.length > 0) {
            originalEmail = matchResult[0];
          }
        }

        if (!originalEmail) {
          errors.push({
            messageId: msg.id,
            reason: `Reply to unknown message ID: ${inReplyToHeader.value}`
          });
          continue;
        }

        // Get full message for body extraction
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        });

        const body = extractEmailBody(fullMessage.data);
        const fromEmail = parseEmailHeader(fromHeader?.value || '');
        const fromName = parseNameHeader(fromHeader?.value || '');

        // Check if reply already exists
        const existingReply = await executeQuery(
          'SELECT id FROM email_replies WHERE reply_message_id = $1',
          [msg.id]
        );

        if (existingReply && existingReply.length > 0) {
          // Update existing reply
          await executeQuery(
            `
            UPDATE email_replies
            SET
              from_email = $1,
              from_name = $2,
              subject = $3,
              body = $4,
              thread_id = $5,
              in_reply_to = $6,
              received_at = NOW(),
              processed = FALSE
            WHERE reply_message_id = $7
            `,
            [
              fromEmail,
              fromName,
              subjectHeader?.value || '',
              body,
              fullMessage.data.threadId!,
              inReplyToHeader.value,
              msg.id
            ]
          );
        } else {
          // Insert new reply
          await executeQuery(
            `
            INSERT INTO email_replies (
              queue_id,
              message_id,
              reply_message_id,
              from_email,
              from_name,
              subject,
              body,
              thread_id,
              in_reply_to,
              is_reply,
              recipient_email,
              original_subject
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (reply_message_id) DO UPDATE SET
              processed = FALSE,
              received_at = NOW()
            `,
            [
              originalEmail.id,
              inReplyToHeader.value,
              msg.id,
              fromEmail,
              fromName,
              subjectHeader?.value || '',
              body,
              fullMessage.data.threadId!,
              inReplyToHeader.value,
              true,
              originalEmail.recipient_email,
              originalEmail.subject
            ]
          );
        }

        // Mark as read
        await gmail.users.messages.modify({
          userId: 'me',
          id: msg.id!,
          requestBody: {
            removeLabelIds: ['UNREAD'],
          },
        });

        repliesFound.push({
          id: msg.id,
          from: fromName || fromEmail,
          fromEmail,
          subject: subjectHeader?.value || 'No Subject',
          body: body.substring(0, 100) + '...',
          receivedAt: new Date().toISOString(),
          originalEmailId: originalEmail.id,
          originalSubject: originalEmail.subject
        });

      } catch (error: any) {
        errors.push({
          messageId: msg.id,
          reason: error.message || 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      stage: 'completed',
      details: {
        sentEmailsFound: sentEmails.length,
        unreadRepliesFound: messages.length,
        newRepliesProcessed: repliesFound.length,
        errors: errors.length,
        replies: repliesFound,
        errorsList: errors
      }
    });

  } catch (error: any) {
    console.error('Error in manual reply check:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stage: 'error',
      details: null
    }, { status: 500 });
  }
}
