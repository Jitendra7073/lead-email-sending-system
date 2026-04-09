import { NextResponse } from "next/server";
import { executeQuery } from "@/lib/db/postgres";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, recipientEmail } = body;

    if (!action || !recipientEmail) {
      return NextResponse.json({
        success: false,
        error: "Action and recipientEmail are required"
      }, { status: 400 });
    }

    // Fetch all queue items for this recipient
    const queueItems = await executeQuery(`
      SELECT id, status FROM email_queue
      WHERE recipient_email = $1
    `, [recipientEmail]);

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No emails found for this recipient"
      }, { status: 404 });
    }

    const queueIds = queueItems.map((item: any) => item.id);
    let result;

    switch (action) {
      case 'delete_all':
        // Delete all emails for this recipient
        result = await executeQuery(`
          DELETE FROM email_queue
          WHERE recipient_email = $1
          AND status NOT IN ('sending', 'sent')
        `, [recipientEmail]);
        break;

      case 'stop_all':
        // Pause/cancel all pending emails
        result = await executeQuery(`
          UPDATE email_queue
          SET status = 'cancelled',
              error_message = 'Stopped by user',
              updated_at = NOW()
          WHERE recipient_email = $1
          AND status IN ('queued', 'pending', 'scheduled', 'ready_to_send', 'paused')
        `, [recipientEmail]);
        break;

      case 'cancel_all':
        // Cancel all queued/pending emails
        result = await executeQuery(`
          UPDATE email_queue
          SET status = 'cancelled',
              error_message = 'Cancelled by user',
              updated_at = NOW()
          WHERE recipient_email = $1
          AND status IN ('queued', 'pending', 'scheduled', 'ready_to_send')
        `, [recipientEmail]);
        break;

      case 'delete_sent':
        // Delete only sent emails
        result = await executeQuery(`
          DELETE FROM email_queue
          WHERE recipient_email = $1
          AND status = 'sent'
        `, [recipientEmail]);
        break;

      case 'delete_failed':
        // Delete only failed emails
        result = await executeQuery(`
          DELETE FROM email_queue
          WHERE recipient_email = $1
          AND status = 'failed'
        `, [recipientEmail]);
        break;

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid action"
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully performed ${action} for ${recipientEmail}`,
      affectedCount: Array.isArray(result) ? result.length : queueIds.length
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
