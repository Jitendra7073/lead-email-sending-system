import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Basic sender info
    const senderQuery = `
      SELECT
        id,
        sender_name,
        email,
        is_active,
        service,
        smtp_host,
        smtp_port,
        daily_limit,
        COALESCE(today_sent, 0) as today_sent,
        COALESCE(health_status, 'healthy') as health_status,
        COALESCE(success_rate, 100) as success_rate,
        created_at,
        updated_at
      FROM email_senders
      WHERE id = $1;
    `;

    // Email statistics for this sender
    const emailStatsQuery = `
      SELECT
        COUNT(*) as total_emails,
        COUNT(*) FILTER (WHERE status = 'sent') as total_sent,
        COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
        COUNT(*) FILTER (WHERE status = 'bounced') as total_bounced,
        COUNT(*) FILTER (WHERE status = 'sent' AND sent_at >= CURRENT_DATE) as sent_today,
        COUNT(*) FILTER (WHERE status = 'failed' AND sent_at >= CURRENT_DATE) as failed_today,
        CASE
          WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status = 'sent')::FLOAT / COUNT(*) * 100)::NUMERIC, 2)
          ELSE 0
        END as success_rate
      FROM email_queue
      WHERE sender_id = $1;
    `;

    // Last 30 days breakdown
    const last30DaysQuery = `
      SELECT
        DATE_TRUNC('day', sent_at)::DATE as send_date,
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE status = 'sent') as successful,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'bounced') as bounced
      FROM email_queue
      WHERE sender_id = $1
        AND sent_at >= CURRENT_DATE - INTERVAL '30 days'
        AND sent_at IS NOT NULL
      GROUP BY DATE_TRUNC('day', sent_at)::DATE
      ORDER BY send_date DESC;
    `;

    // Remaining capacity calculation
    const capacityQuery = `
      SELECT
        s.daily_limit,
        COALESCE(s.today_sent, 0) as today_used,
        CASE
          WHEN s.daily_limit > 0 THEN (s.daily_limit - COALESCE(s.today_sent, 0))
          ELSE 0
        END as remaining_today
      FROM email_senders s
      WHERE s.id = $1;
    `;

    const [senderResult, emailStats, last30Days, capacityResult] = await Promise.all([
      executeQuery(senderQuery, [id]),
      executeQuery(emailStatsQuery, [id]),
      executeQuery(last30DaysQuery, [id]),
      executeQuery(capacityQuery, [id])
    ]);

    if (senderResult.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Sender not found'
      }, { status: 404 });
    }

    const sender = senderResult[0];
    const stats = emailStats[0] || {};
    const capacity = capacityResult[0] || {};

    return NextResponse.json({
      success: true,
      data: {
        sender: sender,
        statistics: {
          total_emails: stats.total_emails || 0,
          total_sent: stats.total_sent || 0,
          total_failed: stats.total_failed || 0,
          total_bounced: stats.total_bounced || 0,
          sent_today: stats.sent_today || 0,
          failed_today: stats.failed_today || 0,
          success_rate: stats.success_rate || 100
        },
        capacity: {
          daily_limit: capacity.daily_limit || 0,
          today_used: capacity.today_used || 0,
          remaining_today: capacity.remaining_today || 0
        },
        last_30_days: last30Days
      },
      meta: {
        sender_id: id,
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
