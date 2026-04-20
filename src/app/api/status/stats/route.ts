import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET() {
  try {
    // Campaign statistics
    const campaignStatsQuery = `
      SELECT
        COUNT(*) as total_campaigns,
        COUNT(*) FILTER (WHERE status = 'running') as running_campaigns,
        COUNT(*) FILTER (WHERE status = 'paused') as paused_campaigns,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_campaigns
      FROM email_campaigns;
    `;

    // Contact statistics
    const contactStatsQuery = `
      SELECT
        COUNT(*) as total_contacts,
        COUNT(*) FILTER (WHERE type = 'email') as contacts_with_email,
        COUNT(*) FILTER (WHERE type = 'phone') as contacts_with_phone,
        COUNT(*) FILTER (WHERE type = 'linkedin') as contacts_with_linkedin
      FROM contacts;
    `;

    // Email statistics - overall
    const emailOverallQuery = `
      SELECT
        COUNT(*) as total_emails,
        COUNT(*) FILTER (WHERE status = 'sent') as total_sent,
        COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
        COUNT(*) FILTER (WHERE status = 'pending') as total_pending,
        COUNT(*) FILTER (WHERE status = 'cancelled') as total_cancelled,
        CASE
          WHEN (COUNT(*) FILTER (WHERE status IN ('sent', 'failed'))) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status = 'sent')::FLOAT / COUNT(*) FILTER (WHERE status IN ('sent', 'failed')) * 100)::NUMERIC, 2)
          ELSE 0
        END as success_rate
      FROM email_queue;
    `;

    // Email statistics - today
    const emailTodayQuery = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent' AND sent_at >= CURRENT_DATE) as sent_today,
        COUNT(*) FILTER (WHERE status = 'failed' AND sent_at >= CURRENT_DATE) as failed_today,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_today
      FROM email_queue;
    `;

    // Email statistics - this week (Monday to now)
    const emailWeekQuery = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent' AND sent_at >= date_trunc('week', CURRENT_DATE)) as sent_week,
        COUNT(*) FILTER (WHERE status = 'failed' AND sent_at >= date_trunc('week', CURRENT_DATE)) as failed_week
      FROM email_queue;
    `;

    // Email statistics - this month
    const emailMonthQuery = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent' AND sent_at >= date_trunc('month', CURRENT_DATE)) as sent_this_month,
        COUNT(*) FILTER (WHERE status = 'failed' AND sent_at >= date_trunc('month', CURRENT_DATE)) as failed_this_month
      FROM email_queue;
    `;

    // Sender statistics
    const senderStatsQuery = `
      SELECT
        COUNT(*) as total_senders,
        COUNT(*) FILTER (WHERE is_active = true) as active_senders,
        SUM(daily_limit) as total_daily_capacity,
        SUM(COALESCE(sent_today, 0)) as total_sent_today
      FROM email_senders;
    `;

    // Template statistics
    const templateStatsQuery = `
      SELECT
        (SELECT COUNT(*) FROM email_templates) as total_templates,
        json_object_agg(COALESCE(tag, 'untagged'), count) as templates_by_tag
      FROM (
        SELECT unnest(string_to_array(NULLIF(tags, ''), ',')) as tag, COUNT(*) as count
        FROM email_templates GROUP BY tag
        UNION ALL
        SELECT 'untagged', COUNT(*) FROM email_templates WHERE tags IS NULL OR tags = ''
      ) t
    `;

    const [campaignStats, contactStats, emailOverall, emailToday, emailWeek, emailMonth, senderStats, templateStats] = await Promise.all([
      executeQuery(campaignStatsQuery),
      executeQuery(contactStatsQuery),
      executeQuery(emailOverallQuery),
      executeQuery(emailTodayQuery),
      executeQuery(emailWeekQuery),
      executeQuery(emailMonthQuery),
      executeQuery(senderStatsQuery),
      executeQuery(templateStatsQuery)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        campaigns: campaignStats[0] || {},
        contacts: contactStats[0] || {},
        emails: {
          overall: emailOverall[0] || {},
          today: emailToday[0] || {},
          weekly: emailWeek[0] || {},
          this_month: emailMonth[0] || {}
        },
        senders: senderStats[0] || {},
        templates: templateStats[0] || {}
      },
      meta: {
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
