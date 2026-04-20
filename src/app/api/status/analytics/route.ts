import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export const dynamic = 'force-dynamic';

// Returns time-series + sender breakdown for a given period
// period: 'day' | 'week' | 'month' | 'year'
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week';

    // ── Determine bucket size and window ──────────────────────────────────────
    // day   → 24 hourly buckets for today
    // week  → 7 daily buckets for Mon–Sun this week
    // month → daily buckets for current calendar month
    // year  → 12 monthly buckets for current year

    let timeSeriesQuery = '';

    if (period === 'day') {
      timeSeriesQuery = `
        SELECT
          to_char(date_trunc('hour', gs), 'HH24:00') AS label,
          date_trunc('hour', gs)                      AS bucket,
          COALESCE(SUM(s.sent),    0)::int            AS sent,
          COALESCE(SUM(s.failed),  0)::int            AS failed,
          COALESCE(SUM(s.replies), 0)::int            AS replies
        FROM generate_series(
          date_trunc('day',  CURRENT_TIMESTAMP),
          date_trunc('hour', CURRENT_TIMESTAMP),
          '1 hour'::interval
        ) AS gs
        LEFT JOIN (
          SELECT
            date_trunc('hour', sent_at)                                   AS bucket,
            COUNT(*) FILTER (WHERE status = 'sent')                       AS sent,
            COUNT(*) FILTER (WHERE status = 'failed')                     AS failed,
            0                                                             AS replies
          FROM email_queue
          WHERE sent_at >= CURRENT_DATE
          GROUP BY 1
          UNION ALL
          SELECT
            date_trunc('hour', received_at),
            0, 0,
            COUNT(*)
          FROM email_replies
          WHERE received_at >= CURRENT_DATE
          GROUP BY 1
        ) s ON s.bucket = date_trunc('hour', gs)
        GROUP BY 1, 2
        ORDER BY 2
      `;
    } else if (period === 'week') {
      timeSeriesQuery = `
        SELECT
          to_char(gs, 'Dy')                           AS label,
          gs::date                                    AS bucket,
          COALESCE(SUM(s.sent),    0)::int            AS sent,
          COALESCE(SUM(s.failed),  0)::int            AS failed,
          COALESCE(SUM(s.replies), 0)::int            AS replies
        FROM generate_series(
          date_trunc('week', CURRENT_DATE),
          date_trunc('week', CURRENT_DATE) + INTERVAL '6 days',
          '1 day'::interval
        ) AS gs
        LEFT JOIN (
          SELECT
            sent_at::date                                                  AS bucket,
            COUNT(*) FILTER (WHERE status = 'sent')                        AS sent,
            COUNT(*) FILTER (WHERE status = 'failed')                      AS failed,
            0                                                              AS replies
          FROM email_queue
          WHERE sent_at >= date_trunc('week', CURRENT_DATE)
          GROUP BY 1
          UNION ALL
          SELECT
            received_at::date,
            0, 0,
            COUNT(*)
          FROM email_replies
          WHERE received_at >= date_trunc('week', CURRENT_DATE)
          GROUP BY 1
        ) s ON s.bucket = gs::date
        GROUP BY 1, 2
        ORDER BY 2
      `;
    } else if (period === 'month') {
      timeSeriesQuery = `
        SELECT
          to_char(gs, 'DD Mon')                       AS label,
          gs::date                                    AS bucket,
          COALESCE(SUM(s.sent),    0)::int            AS sent,
          COALESCE(SUM(s.failed),  0)::int            AS failed,
          COALESCE(SUM(s.replies), 0)::int            AS replies
        FROM generate_series(
          date_trunc('month', CURRENT_DATE),
          (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'),
          '1 day'::interval
        ) AS gs
        LEFT JOIN (
          SELECT
            sent_at::date                                                  AS bucket,
            COUNT(*) FILTER (WHERE status = 'sent')                        AS sent,
            COUNT(*) FILTER (WHERE status = 'failed')                      AS failed,
            0                                                              AS replies
          FROM email_queue
          WHERE sent_at >= date_trunc('month', CURRENT_DATE)
          GROUP BY 1
          UNION ALL
          SELECT
            received_at::date,
            0, 0,
            COUNT(*)
          FROM email_replies
          WHERE received_at >= date_trunc('month', CURRENT_DATE)
          GROUP BY 1
        ) s ON s.bucket = gs::date
        GROUP BY 1, 2
        ORDER BY 2
      `;
    } else {
      // year
      timeSeriesQuery = `
        SELECT
          to_char(gs, 'Mon')                          AS label,
          gs::date                                    AS bucket,
          COALESCE(SUM(s.sent),    0)::int            AS sent,
          COALESCE(SUM(s.failed),  0)::int            AS failed,
          COALESCE(SUM(s.replies), 0)::int            AS replies
        FROM generate_series(
          date_trunc('year', CURRENT_DATE),
          date_trunc('year', CURRENT_DATE) + INTERVAL '11 months',
          '1 month'::interval
        ) AS gs
        LEFT JOIN (
          SELECT
            date_trunc('month', sent_at)::date                             AS bucket,
            COUNT(*) FILTER (WHERE status = 'sent')                        AS sent,
            COUNT(*) FILTER (WHERE status = 'failed')                      AS failed,
            0                                                              AS replies
          FROM email_queue
          WHERE sent_at >= date_trunc('year', CURRENT_DATE)
          GROUP BY 1
          UNION ALL
          SELECT
            date_trunc('month', received_at)::date,
            0, 0,
            COUNT(*)
          FROM email_replies
          WHERE received_at >= date_trunc('year', CURRENT_DATE)
          GROUP BY 1
        ) s ON s.bucket = gs::date
        GROUP BY 1, 2
        ORDER BY 2
      `;
    }

    // ── Window boundaries for sender leaderboard ──────────────────────────────
    const windowMap: Record<string, string> = {
      day: "CURRENT_DATE",
      week: "date_trunc('week',  CURRENT_DATE)",
      month: "date_trunc('month', CURRENT_DATE)",
      year: "date_trunc('year',  CURRENT_DATE)",
    };
    const windowStart = windowMap[period] || windowMap.week;

    const senderQuery = `
      SELECT
        s.name                                        AS sender_name,
        s.email                                       AS sender_email,
        COUNT(*) FILTER (WHERE q.status = 'sent')::int AS sent,
        COUNT(*) FILTER (WHERE q.status = 'failed')::int AS failed
      FROM email_queue q
      JOIN email_senders s ON s.id = q.sender_id
      WHERE q.sent_at >= ${windowStart}
        AND q.sender_id IS NOT NULL
      GROUP BY s.id, s.name, s.email
      ORDER BY sent DESC
      LIMIT 10
    `;

    // ── Summary totals for the period ─────────────────────────────────────────
    const summaryQuery = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent')::int   AS sent,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
      FROM email_queue
      WHERE sent_at >= ${windowStart}
    `;

    const replySummaryQuery = `
      SELECT COUNT(*)::int AS replies
      FROM email_replies
      WHERE received_at >= ${windowStart}
    `;

    const [timeSeries, senderRows, summaryRows, replySummaryRows] = await Promise.all([
      executeQuery(timeSeriesQuery),
      executeQuery(senderQuery),
      executeQuery(summaryQuery),
      executeQuery(replySummaryQuery),
    ]);

    const summary = summaryRows[0] || { sent: 0, failed: 0 };
    const replySummary = replySummaryRows[0] || { replies: 0 };

    return NextResponse.json({
      success: true,
      period,
      data: {
        timeSeries,
        senders: senderRows,
        summary: {
          sent: summary.sent,
          failed: summary.failed,
          replies: replySummary.replies,
          replyRate: summary.sent > 0
            ? Math.round((replySummary.replies / summary.sent) * 100 * 10) / 10
            : 0,
        },
      },
    });
  } catch (err: any) {
    console.error('[analytics]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
