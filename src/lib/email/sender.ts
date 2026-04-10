import nodemailer from 'nodemailer';
import { supabaseAdmin } from '../supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../db/postgres';
import { replaceVariables, VariableContext } from '../email-variables';

export interface AliasOptions {
  aliasEmail?: string;
  aliasName?: string;
  aliasId?: string;
}

export async function sendEmailWithNodemailer(
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
  },
  aliasOptions?: AliasOptions
) {
  // 1. Fetch sender credentials with alias information if provided
  const { data: senders, error } = await supabaseAdmin
    .from('email_senders')
    .select('*')
    .eq('id', senderId)
    .limit(1);

  const sender = senders && senders.length > 0 ? senders[0] : null;

  if (error || !sender) {
    throw new Error(`Sender not found or error fetching credentials: ${error?.message || 'Sender ID not found'}`);
  }

  // Warn if duplicates exist
  if (senders && senders.length > 1) {
    console.warn(`⚠️ Multiple sender records found for ID ${senderId}. Using the first one.`);
  }

  // 2. Determine which email to use as "from" address
  let fromEmail: string;
  let fromName: string;

  // Priority: aliasOptions parameter > sender.alias_email > sender.email
  if (aliasOptions?.aliasEmail) {
    // Use alias from parameter (for backwards compatibility)
    fromEmail = aliasOptions.aliasEmail;
    fromName = aliasOptions.aliasName || sender.name;
    console.log(`📧 Using alias from parameter: ${fromName} <${fromEmail}>`);
  } else if (sender.alias_email) {
    // Use alias from sender record (NEW: Simple approach)
    fromEmail = sender.alias_email;
    fromName = sender.name;
    console.log(`📧 Using sender's alias: ${fromName} <${fromEmail}>`);
  } else {
    // Use main email
    fromEmail = sender.email;
    fromName = sender.name;
  }

  // 3. Replace template variables with actual values
  const variableContext: VariableContext = {
    sender_name: context?.senderName || fromName,
    receiver_email: context?.recipientEmail || recipient,
    website_url: context?.websiteUrl,
  };

  const processedSubject = replaceVariables(subject, variableContext);
  const processedHtmlContent = replaceVariables(htmlContent, variableContext);

  // 4. Configure Nodemailer transport
  // IMPORTANT: Always authenticate with the main email (SMTP auth user), NOT the alias
  const transporter = nodemailer.createTransport({
    host: sender.smtp_host || 'smtp.gmail.com',
    port: sender.smtp_port || 587,
    secure: sender.smtp_port === 465, // true for 465, false for other ports
    auth: {
      user: sender.smtp_user || sender.email, // Always use main email for auth
      pass: sender.app_password || sender.password,
    },
  });

  // 5. Generate unique Message-ID for tracking replies
  const domain = fromEmail.split('@')[1];
  const messageId = `<${uuidv4()}@${domain}>`;

  // 6. Send email with proper headers
  // CRITICAL: Set up headers so recipient sees alias email but replies go to main email
  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`, // What recipient sees
    to: recipient,
    subject: processedSubject,
    html: processedHtmlContent,
    headers: {
      'Message-ID': messageId,
      'X-Priority': '3',
      'X-Mailer': 'Email-Sending-System',
      'Reply-To': sender.email, // Replies go to MAIN email, not alias
      // Sender header: Shows main email (for SPF/DKIM authentication)
      'Sender': sender.email,
    },
    // Envelope: Use alias for MAIL FROM
    envelope: {
      from: fromEmail,
      to: recipient,
    },
  };

  const info = await transporter.sendMail(mailOptions);

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
      console.error('Failed to store Message-ID:', err);
    }
  }

  return { ...info, messageId, fromEmail, fromName, mainEmail: sender.email };
}
