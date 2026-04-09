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

    // 2. Check if email can be cancelled
    if (item.status === 'sent') {
      return NextResponse.json({
        success: false,
        error: 'Cannot cancel email that has already been sent'
      }, { status: 400 });
    }

    if (item.status === 'sending') {
      return NextResponse.json({
        success: false,
        error: 'Cannot cancel email that is currently being sent'
      }, { status: 400 });
    }

    if (item.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        error: 'Email is already cancelled'
      }, { status: 400 });
    }

    if (item.status === 'failed') {
      return NextResponse.json({
        success: false,
        error: 'Cannot cancel email that has already failed'
      }, { status: 400 });
    }

    // 3. Update status to cancelled
    const updatedItem = await executeQuery(`
      UPDATE email_queue
      SET
        status = 'cancelled',
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    return NextResponse.json({
      success: true,
      data: updatedItem[0],
      message: 'Email cancelled successfully'
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
