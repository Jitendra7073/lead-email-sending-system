import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    // 1. Fetch the queue item
    const queueItems = await executeQuery(
      `SELECT * FROM email_queue WHERE id = $1`,
      [id]
    );

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({ success: false, error: 'Queue item not found' }, { status: 404 });
    }

    const item = queueItems[0];

    // 2. Check if status is 'failed'
    if (item.status !== 'failed') {
      return NextResponse.json({
        success: false,
        error: `Cannot resend email with status '${item.status}'. Only failed emails can be resent.`
      }, { status: 400 });
    }

    // 3. Reset for resend
    const retryCount = (item.retry_count || 0) + 1;
    const updatedItem = await executeQuery(`
      UPDATE email_queue
      SET
        status = 'pending',
        scheduled_at = NOW(),
        retry_count = $1,
        error_message = NULL,
        attempts = 0,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [retryCount, id]);

    return NextResponse.json({
      success: true,
      data: updatedItem[0],
      message: `Email queued for resend (attempt #${retryCount})`
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
