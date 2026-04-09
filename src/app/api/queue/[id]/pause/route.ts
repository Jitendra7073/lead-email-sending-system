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

    // 2. Check if email can be paused
    if (item.status !== 'pending' && item.status !== 'scheduled') {
      return NextResponse.json({
        success: false,
        error: `Cannot pause email with status '${item.status}'. Only pending or scheduled emails can be paused.`
      }, { status: 400 });
    }

    // 3. Update status to paused
    const updatedItem = await executeQuery(`
      UPDATE email_queue
      SET
        status = 'paused',
        paused_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    return NextResponse.json({
      success: true,
      data: updatedItem[0],
      message: 'Email paused successfully'
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
