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

    // 2. Check if email is paused
    if (item.status !== 'paused') {
      return NextResponse.json({
        success: false,
        error: `Cannot resume email with status '${item.status}'. Only paused emails can be resumed.`
      }, { status: 400 });
    }

    // 3. Resume email - set back to pending with original scheduled time or NOW
    const scheduledAt = item.scheduled_at || new Date().toISOString();
    const updatedItem = await executeQuery(`
      UPDATE email_queue
      SET
        status = 'pending',
        scheduled_at = CASE
          WHEN scheduled_at < NOW() THEN NOW()
          ELSE scheduled_at
        END,
        paused_at = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    return NextResponse.json({
      success: true,
      data: updatedItem[0],
      message: 'Email resumed successfully'
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
