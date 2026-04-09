import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET() {
  try {
    const query = `
      SELECT
        id,
        sender_name,
        email,
        is_active,
        COALESCE(health_status, 'healthy') as health_status,
        COALESCE(today_sent, 0) as today_sent,
        daily_limit,
        CASE
          WHEN daily_limit > 0 THEN ROUND((COALESCE(today_sent, 0)::FLOAT / daily_limit * 100)::NUMERIC, 2)
          ELSE 0
        END as usage_percentage,
        COALESCE(success_rate, 100) as success_rate
      FROM email_senders
      WHERE is_active = true
      ORDER BY today_sent DESC;
    `;

    const result = await executeQuery(query);

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        count: result.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
