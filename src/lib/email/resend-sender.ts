/**
 * Resend Email Sender
 *
 * Sends emails via Resend HTTP API (works on Railway without SMTP port issues).
 * Supports email aliases, variable replacement, and Message-ID tracking.
 * Drop-in replacement for the Nodemailer sender in the queue processing flow.
 */

import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../db/postgres';
import { replaceVariables, VariableContext } from '../email-variables';

export interface AliasOptions {
  aliasEmail?: string;
  aliasName?: string;
  aliasId?: string;
}

export interface ResendSendResult {
  id: string;
  messageId: string;
  fromEmail: string;
  fromName: string;
  mainEmail: string;
}

interface ResendAPIResponse {
  id: string;
}

interface ResendAPIError {
  statusCode: number;
  message: string;
  name: string;
}

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Send email using Resend HTTP API
 *
 * Same interface as sendEmailWithNodemailer — fetches sender from DB,
 * resolves alias, replaces template variables, sends via Resend API,
 * and stores Message-ID for reply tracking.
 */
export async function sendEmailWithResend(
  senderId: string,
  recipient: string,
  subject: string,
  htmlContent: string,
  queueId?: string,
  context?: {
    recipientName?: string;
    recipientEmail?: string;
    websiteUrl?: string;
    senderName?: string;
    region?: string;
  },
  aliasOptions?: AliasOptions
): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set in environment variables');
  }

  // 1. Fetch sender details from database (using direct PostgreSQL, not Supabase)
  const senders = await executeQuery(
    'SELECT * FROM email_senders WHERE id = $1 LIMIT 1',
    [senderId]
  );

  const sender = senders && senders.length > 0 ? senders[0] : null;

  if (!sender) {
    throw new Error(`Sender not found for ID: ${senderId}`);
  }

  // 2. Determine which email to use as "from" address
  // Priority: aliasOptions parameter > sender.alias_email > sender.email
  let fromEmail: string;
  let fromName: string;

  if (aliasOptions?.aliasEmail) {
    fromEmail = aliasOptions.aliasEmail;
    fromName = aliasOptions.aliasName || sender.name;
    console.log(`📧 [Resend] Using alias from parameter: ${fromName} <${fromEmail}>`);
  } else if (sender.alias_email) {
    fromEmail = sender.alias_email;
    fromName = sender.name;
    console.log(`📧 [Resend] Using sender's alias: ${fromName} <${fromEmail}>`);
  } else {
    fromEmail = sender.email;
    fromName = sender.name;
  }

  // 3. Replace template variables with actual values
  const variableContext: VariableContext = {
    sender_name: context?.senderName || fromName,
    receiver_email: context?.recipientEmail || recipient,
    website_url: context?.websiteUrl,
    region: context?.region,
  };

  const processedSubject = await replaceVariables(subject, variableContext);
  const processedHtmlContent = await replaceVariables(htmlContent, variableContext);

  // 4. Generate unique Message-ID for tracking replies
  const domain = fromEmail.split('@')[1];
  const messageId = `<${uuidv4()}@${domain}>`;

  // 5. Build Resend API payload
  const payload = {
    from: `${fromName} <${fromEmail}>`,
    to: [recipient],
    subject: processedSubject,
    html: processedHtmlContent,
    reply_to: sender.email, // Replies go to MAIN email, not alias
    headers: {
      'Message-ID': messageId,
      'X-Priority': '3',
      'X-Mailer': 'Email-Sending-System',
    },
  };

  // 6. Send via Resend HTTP API
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Unknown Resend API error' })) as ResendAPIError;
    throw new Error(`Resend API error (${response.status}): ${errorBody.message || JSON.stringify(errorBody)}`);
  }

  const result = await response.json() as ResendAPIResponse;

  console.log(`✅ [Resend] Email sent to ${recipient} | Resend ID: ${result.id} | Message-ID: ${messageId}`);

  // 7. Store the Message-ID in the database for tracking
  if (queueId) {
    try {
      await executeQuery(
        `UPDATE email_queue
         SET message_id = $1, status = 'sent', sent_at = NOW(), error_message = NULL
         WHERE id = $2`,
        [messageId, queueId]
      );
    } catch (err) {
      console.error('[Resend] Failed to store Message-ID:', err);
    }
  }

  return {
    id: result.id,
    messageId,
    fromEmail,
    fromName,
    mainEmail: sender.email,
  };
}
