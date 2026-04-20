import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);
        const offset = parseInt(searchParams.get('offset') || '0');

        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const recipientEmail = searchParams.get('recipientEmail');
        const campaignId = searchParams.get('campaignId');
        const senderId = searchParams.get('senderId');
        const subjectSearch = searchParams.get('subject');
        const hasReplies = searchParams.get('hasReplies'); // 'true' | 'false' | null

        const params: any[] = [];
        let idx = 1;
        const conditions: string[] = ["q.status = 'sent'", 'q.message_id IS NOT NULL'];

        if (startDate) {
            conditions.push(`q.sent_at >= $${idx++}`);
            params.push(new Date(startDate));
        }
        if (endDate) {
            conditions.push(`q.sent_at <= $${idx++}`);
            params.push(new Date(endDate));
        }
        if (recipientEmail) {
            conditions.push(`q.recipient_email ILIKE $${idx++}`);
            params.push(`%${recipientEmail}%`);
        }
        if (campaignId) {
            conditions.push(`q.campaign_id = $${idx++}`);
            params.push(campaignId);
        }
        if (senderId) {
            conditions.push(`q.sender_id = $${idx++}`);
            params.push(senderId);
        }
        if (subjectSearch) {
            conditions.push(`q.subject ILIKE $${idx++}`);
            params.push(`%${subjectSearch}%`);
        }

        const where = conditions.join(' AND ');

        // hasReplies filter is applied via HAVING after the GROUP BY
        const havingClause = hasReplies === 'true'
            ? 'HAVING COUNT(r.id) > 0'
            : hasReplies === 'false'
                ? 'HAVING COUNT(r.id) = 0'
                : '';

        const dataParams = [...params, limit, offset];
        const limitIdx = idx++;
        const offsetIdx = idx++;

        const rows = await executeQuery(
            `SELECT
         q.id,
         q.message_id,
         q.recipient_email,
         q.recipient_name,
         q.subject,
         q.sent_at,
         q.html_content,
         q.campaign_id,
         c.name  AS campaign_name,
         s.id    AS sender_id,
         s.name  AS sender_name,
         s.email AS sender_email,
         COUNT(r.id)::int AS reply_count
       FROM email_queue q
       LEFT JOIN email_campaigns c ON c.id = q.campaign_id
       LEFT JOIN email_senders   s ON s.id = q.sender_id
       LEFT JOIN email_replies   r ON r.queue_id = q.id
       WHERE ${where}
       GROUP BY q.id, c.name, s.id, s.name, s.email
       ${havingClause}
       ORDER BY q.sent_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
            dataParams
        );

        // Count query (without pagination, with same HAVING if needed)
        const countRows = await executeQuery(
            `SELECT COUNT(*)::int AS total FROM (
         SELECT q.id
         FROM email_queue q
         LEFT JOIN email_replies r ON r.queue_id = q.id
         WHERE ${where}
         GROUP BY q.id
         ${havingClause}
       ) sub`,
            params
        );

        return NextResponse.json({
            success: true,
            data: rows,
            total: countRows[0]?.total ?? 0,
        });
    } catch (err: any) {
        console.error('[sent-emails] error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
