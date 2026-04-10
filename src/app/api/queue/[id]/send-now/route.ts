import { NextResponse } from "next/server";
import { executeQuery } from "@/lib/db/postgres";
import { sendEmailWithNodemailer } from "@/lib/email/sender";
import { getCountryName } from "@/lib/email-variables";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    // 1. Fetch the queue item with all required data including website URL
    const queueItems = await executeQuery(
      `
      SELECT q.*,
             s.app_password, s.email as sender_email, s.smtp_host, s.smtp_port, s.smtp_user, s.name as sender_name,
             st.url as website_url,
             c.country_code
      FROM email_queue q
      LEFT JOIN email_senders s ON q.sender_id = s.id
      LEFT JOIN contacts c ON q.contact_id = c.id
      LEFT JOIN sites st ON c.site_id = st.id
      WHERE q.id = $1
      LIMIT 1
    `,
      [id],
    );

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "Queue item not found" },
        { status: 404 },
      );
    }

    const item = queueItems[0];

    // Warn if duplicates exist
    if (queueItems.length > 1) {
      console.warn(`⚠️ Multiple queue items found for ID ${id}. This indicates data integrity issues.`);
    }

    // Check if already sent
    if (item.status === "sent") {
      return NextResponse.json(
        { success: false, error: "Email already sent" },
        { status: 400 },
      );
    }

    // 2. Assign sender if not already assigned
    let senderCredentials = item;
    if (!item.sender_id) {
      const avSender = await executeQuery(
        `SELECT * FROM email_senders WHERE is_active = true AND sent_today < daily_limit LIMIT 1`,
      );
      if (avSender.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "No active senders available with capacity",
          },
          { status: 400 },
        );
      }

      senderCredentials = avSender[0];
      await executeQuery(
        `UPDATE email_queue SET sender_id = $1 WHERE id = $2`,
        [senderCredentials.id, item.id],
      );
    }

    // 3. Mark as sending
    await executeQuery(
      `UPDATE email_queue SET status = 'sending', updated_at = NOW() WHERE id = $1`,
      [id],
    );

    // 4. Send the email
    try {
      // Fetch country name if country_code is available
      const countryName = item.country_code ? await getCountryName(item.country_code) : "";

      const info = await sendEmailWithNodemailer(
        senderCredentials.id || item.sender_id,
        item.recipient_email,
        item.subject,
        item.html_content,
        id,
        {
          recipientName: item.recipient_name,
          recipientEmail: item.recipient_email,
          websiteUrl: item.website_url,
          senderName: senderCredentials.name,
          region: countryName
        }
      );

      // 5. Mark as sent (Centralized update)
      const { markAsSent } = await import('@/lib/queue/queue-status-manager');
      await markAsSent(id, info.messageId, {
        provider: senderCredentials.service || 'nodemailer',
        sent_from: senderCredentials.email
      });

      // 7. Increment sender today count
      await executeQuery(
        `UPDATE email_senders SET sent_today = sent_today + 1 WHERE id = $1`,
        [senderCredentials.id || item.sender_id],
      );

      // 8. Fetch updated item
      const updatedItems = await executeQuery(
        `SELECT * FROM email_queue WHERE id = $1 LIMIT 1`,
        [id],
      );

      const updatedItem = updatedItems && updatedItems.length > 0 ? updatedItems[0] : null;

      return NextResponse.json({
        success: true,
        data: updatedItem,
        message: "Email sent successfully",
      });
    } catch (sendError: any) {
      // Mark as failed
      const attempts = (item.attempts || 0) + 1;
      await executeQuery(
        `
        UPDATE email_queue
        SET status = 'failed', attempts = $1, error_message = $2, updated_at = NOW()
        WHERE id = $3
      `,
        [attempts, sendError.message, id],
      );

      return NextResponse.json(
        {
          success: false,
          error: sendError.message,
          data: {
            ...item,
            status: "failed",
            attempts,
            error_message: sendError.message,
          },
        },
        { status: 500 },
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
