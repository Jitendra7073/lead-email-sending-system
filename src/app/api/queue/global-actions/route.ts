import { NextResponse } from "next/server";
import { executeQuery } from "@/lib/db/postgres";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;

        if (!action) {
            return NextResponse.json({ success: false, error: "Action is required" }, { status: 400 });
        }

        let result;

        switch (action) {
            case "cancel_all_queued":
                result = await executeQuery(`
          UPDATE email_queue
          SET status = 'cancelled', error_message = 'Cancelled by user (global)', updated_at = NOW()
          WHERE status IN ('queued', 'pending', 'scheduled', 'ready_to_send')
          RETURNING id
        `);
                break;

            case "pause_all_pending":
                result = await executeQuery(`
          UPDATE email_queue
          SET status = 'paused', paused_at = NOW(), updated_at = NOW()
          WHERE status IN ('pending', 'scheduled')
          RETURNING id
        `);
                break;

            case "resume_all_paused":
                result = await executeQuery(`
          UPDATE email_queue
          SET
            status = 'pending',
            paused_at = NULL,
            scheduled_at = CASE WHEN scheduled_at < NOW() THEN NOW() ELSE scheduled_at END,
            updated_at = NOW()
          WHERE status = 'paused'
          RETURNING id
        `);
                break;

            case "retry_all_failed":
                result = await executeQuery(`
          UPDATE email_queue
          SET status = 'pending', attempts = 0, error_message = NULL, updated_at = NOW()
          WHERE status = 'failed'
          RETURNING id
        `);
                break;

            case "delete_all_failed":
                result = await executeQuery(`
          DELETE FROM email_queue WHERE status = 'failed' RETURNING id
        `);
                break;

            case "delete_all_cancelled":
                result = await executeQuery(`
          DELETE FROM email_queue WHERE status = 'cancelled' RETURNING id
        `);
                break;

            case "delete_all_sent":
                result = await executeQuery(`
          DELETE FROM email_queue WHERE status = 'sent' RETURNING id
        `);
                break;

            default:
                return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: `Action '${action}' completed successfully`,
            affectedCount: Array.isArray(result) ? result.length : 0,
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
