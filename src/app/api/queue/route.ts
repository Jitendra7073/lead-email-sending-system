import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const campaign_id = searchParams.get('campaign_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build WHERE clause conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`q.status = $${paramIndex++}`);
      params.push(status);
    }

    if (campaign_id) {
      conditions.push(`q.campaign_id = $${paramIndex++}`);
      params.push(campaign_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get data from email_queue (for pending/queued emails)
    const queueQuery = `
      SELECT
        q.id,
        q.campaign_id,
        c.name as campaign_name,
        q.recipient_email,
        q.recipient_name,
        q.subject,
        q.status,
        q.attempts,
        q.error_message,
        q.sent_at,
        q.scheduled_at,
        q.adjusted_scheduled_at,
        q.country_code,
        q.tag,
        q.sequence_position,
        q.depends_on_queue_id,
        q.template_id,
        q.contact_id,
        q.created_at,
        q.updated_at,
        'queue' as source
      FROM email_queue q
      LEFT JOIN email_campaigns c ON q.campaign_id = c.id
      ${whereClause}
    `;

    // Get data from email_send_log (for sent emails)
    const logQuery = `
      SELECT
        l.id,
        l.campaign_id,
        c.name as campaign_name,
        l.contact_email as recipient_email,
        l.contact_id,
        l.template_id,
        t.subject,
        l.status,
        l.sent_at,
        l.created_at,
        'log' as source
      FROM email_send_log l
      LEFT JOIN email_campaigns c ON l.campaign_id = c.id
      LEFT JOIN email_templates t ON l.template_id = t.id
      ${whereClause}
    `;

    const [queueData, logData] = await Promise.all([
      executeQuery(queueQuery, params),
      executeQuery(logQuery, params)
    ]);

    // Combine and format data
    const combinedData = [
      ...queueData.map((row: any) => ({
        id: row.id,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        recipient_email: row.recipient_email,
        recipient_name: row.recipient_name,
        subject: row.subject,
        status: row.status,
        attempts: row.attempts || 0,
        error_message: row.error_message,
        sent_at: row.sent_at,
        scheduled_at: row.scheduled_at,
        adjusted_scheduled_at: row.adjusted_scheduled_at,
        country_code: row.country_code,
        tag: row.tag,
        sequence_position: row.sequence_position,
        depends_on_queue_id: row.depends_on_queue_id,
        template_id: row.template_id,
        contact_id: row.contact_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        source: row.source
      })),
      ...logData.map((row: any) => ({
        id: `log-${row.id}`,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        recipient_email: row.recipient_email,
        recipient_name: null,
        subject: row.subject,
        status: row.status,
        attempts: 1,
        error_message: null,
        sent_at: row.sent_at,
        scheduled_at: row.sent_at,
        adjusted_scheduled_at: null,
        country_code: null,
        tag: null,
        sequence_position: null,
        depends_on_queue_id: null,
        template_id: row.template_id,
        contact_id: row.contact_id,
        created_at: row.created_at,
        updated_at: row.created_at,
        source: row.source
      }))
    ];

    // Sort by created_at descending (newest first)
    combinedData.sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Apply pagination
    const paginatedData = combinedData.slice(offset, offset + limit);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM email_queue ${whereClause ? 'WHERE ' + conditions.join(' AND ') : ''}`;
    let countParams: any[] = [...params];

    const countData = await executeQuery(countQuery, countParams);
    let total = parseInt(countData[0]?.total || '0');

    // Add log count to total
    const logCountQuery = `SELECT COUNT(*) as total FROM email_send_log ${whereClause ? 'WHERE ' + conditions.join(' AND ') : ''}`;
    const logCountData = await executeQuery(logCountQuery, [...params]);
    total += parseInt(logCountData[0]?.total || '0');

    return NextResponse.json({
      success: true,
      data: paginatedData,
      pagination: { total, limit, offset, totalPages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
