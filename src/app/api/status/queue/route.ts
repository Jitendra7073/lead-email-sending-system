import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET() {
  try {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as total_pending,
        COUNT(*) FILTER (WHERE status = 'sending') as total_sending,
        COUNT(*) FILTER (WHERE sent_at >= CURRENT_DATE) as total_sent_today,
        COUNT(*) FILTER (WHERE status = 'failed' AND sent_at >= CURRENT_DATE) as total_failed_today,
        COUNT(DISTINCT sender_id) FILTER (WHERE status = 'sending') as active_senders,
        MIN(scheduled_at) FILTER (WHERE status = 'pending') as next_send_at
      FROM email_queue;
    `;

    const result = await executeQuery(query);

    if (result.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          total_pending: 0,
          total_sending: 0,
          total_sent_today: 0,
          total_failed_today: 0,
          active_senders: 0,
          next_send_at: null
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: result[0]
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
