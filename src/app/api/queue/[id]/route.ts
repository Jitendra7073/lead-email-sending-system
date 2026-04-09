import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    // 1. Check if queue item exists
    const queueItems = await executeQuery(
      `SELECT * FROM email_queue WHERE id = $1`,
      [id]
    );

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({ success: false, error: 'Queue item not found' }, { status: 404 });
    }

    const item = queueItems[0];

    // 2. Prevent deletion of currently sending emails
    if (item.status === 'sending') {
      return NextResponse.json({
        success: false,
        error: 'Cannot delete email that is currently being sent. Please wait for it to complete.'
      }, { status: 400 });
    }

    // 3. Delete the queue item (hard delete)
    await executeQuery(
      `DELETE FROM email_queue WHERE id = $1`,
      [id]
    );

    return NextResponse.json({
      success: true,
      message: 'Email deleted successfully from queue',
      data: { id, deletedStatus: item.status }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
