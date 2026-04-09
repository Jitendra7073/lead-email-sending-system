import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Basic campaign stats
    const basicStatsQuery = `
      SELECT
        COUNT(*) as total_emails,
        COUNT(*) FILTER (WHERE status = 'pending') as total_pending,
        COUNT(*) FILTER (WHERE status = 'sending') as total_sending,
        COUNT(*) FILTER (WHERE status = 'sent') as total_sent,
        COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as total_cancelled,
        COUNT(*) FILTER (WHERE status = 'queued') as total_queued,
        COUNT(*) FILTER (WHERE status = 'bounced') as total_bounced
      FROM email_queue
      WHERE campaign_id = $1;
    `;

    // Status breakdown
    const statusBreakdownQuery = `
      SELECT
        status,
        COUNT(*) as count
      FROM email_queue
      WHERE campaign_id = $1
      GROUP BY status
      ORDER BY status;
    `;

    // Progress by position (if applicable)
    const positionStatsQuery = `
      SELECT
        position,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
      FROM email_queue
      WHERE campaign_id = $1
      GROUP BY position
      ORDER BY position;
    `;

    const [basicStats, statusBreakdown, positionStats] = await Promise.all([
      executeQuery(basicStatsQuery, [id]),
      executeQuery(statusBreakdownQuery, [id]),
      executeQuery(positionStatsQuery, [id])
    ]);

    if (basicStats.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          total_emails: 0,
          total_pending: 0,
          total_sending: 0,
          total_sent: 0,
          total_failed: 0,
          total_cancelled: 0,
          total_queued: 0,
          total_bounced: 0,
          status_breakdown: [],
          position_stats: [],
          progress_percentage: 0
        }
      });
    }

    const stats = basicStats[0];
    const total = stats.total_emails || 0;
    const sent = stats.total_sent || 0;
    const failed = stats.total_failed || 0;
    const cancelled = stats.total_cancelled || 0;
    const completed = sent + failed + cancelled;

    const progressPercentage = total > 0
      ? parseFloat(((completed / total) * 100).toFixed(2))
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        status_breakdown: statusBreakdown,
        position_stats: positionStats,
        progress_percentage: progressPercentage
      },
      meta: {
        campaign_id: id,
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
