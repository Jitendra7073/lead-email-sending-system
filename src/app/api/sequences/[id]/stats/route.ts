import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get all queue items and sent logs for this sequence
    const queueQuery = `
      SELECT
        q.sequence_position,
        q.status,
        q.sent_at,
        q.scheduled_at,
        q.recipient_email,
        q.template_id,
        q.campaign_id,
        c.name as campaign_name
      FROM email_queue q
      LEFT JOIN email_campaigns c ON q.campaign_id = c.id
      WHERE q.campaign_id IN (
        SELECT id FROM email_campaigns WHERE sequence_id = $1
      )
      ORDER BY q.created_at DESC
    `;

    const logQuery = `
      SELECT
        l.send_type,
        l.status,
        l.sent_at,
        l.contact_email,
        l.template_id,
        l.campaign_id,
        c.name as campaign_name
      FROM email_send_log l
      LEFT JOIN email_campaigns c ON l.campaign_id = c.id
      WHERE l.campaign_id IN (
        SELECT id FROM email_campaigns WHERE sequence_id = $1
      )
      ORDER BY l.sent_at DESC
    `;

    const [queueData, logData] = await Promise.all([
      executeQuery(queueQuery, [id]),
      executeQuery(logQuery, [id])
    ]);

    // Combine data and extract position from send_type
    const allData = [
      ...queueData.map((row: any) => ({
        ...row,
        position: row.sequence_position || 1,
        source: 'queue'
      })),
      ...logData.map((row: any) => {
        // Extract position from send_type like "sequence_pos_1"
        const posMatch = row.send_type?.match(/sequence_pos_(\d+)/);
        return {
          ...row,
          position: posMatch ? parseInt(posMatch[1]) : 1,
          source: 'log'
        };
      })
    ];

    // Group by position (email in sequence)
    const byPosition = new Map<number, {
      position: number;
      total: number;
      sent: number;
      failed: number;
      queued: number;
      recipients: string[];
      latest_sent: string | null;
    }>();

    for (const item of allData) {
      const pos = item.position || 1;
      if (!byPosition.has(pos)) {
        byPosition.set(pos, {
          position: pos,
          total: 0,
          sent: 0,
          failed: 0,
          queued: 0,
          recipients: [],
          latest_sent: null
        });
      }

      const stat = byPosition.get(pos)!;
      stat.total++;
      stat.recipients.push(item.recipient_email);

      const status = (item.status || '').toLowerCase();
      if (status === 'sent') {
        stat.sent++;
        if (!stat.latest_sent || new Date(item.sent_at) > new Date(stat.latest_sent)) {
          stat.latest_sent = item.sent_at;
        }
      } else if (status === 'failed') {
        stat.failed++;
      } else {
        stat.queued++;
      }
    }

    // Get unique contacts
    const uniqueContacts = new Set(allData.map((d: any) => d.recipient_email));
    const completedSequence = allData.filter((d: any) => d.status === 'sent').length;

    // Get sequence items to calculate total emails per contact
    const sequenceItemsQuery = `
      SELECT position, template_id, template_name
      FROM email_sequence_items
      WHERE sequence_id = $1
      ORDER BY position
    `;
    const sequenceItems = await executeQuery(sequenceItemsQuery, [id]);

    return NextResponse.json({
      success: true,
      data: {
        sequence_id: id,
        total_contacts: uniqueContacts.size,
        total_emails: allData.length,
        emails_per_contact: sequenceItems.length,
        positions: Array.from(byPosition.values()).sort((a, b) => a.position - b.position),
        sequence_items: sequenceItems,
        campaigns: [...new Set(allData.map((d: any) => d.campaign_name).filter(Boolean))],
        recent_activity: allData.slice(0, 20)
      }
    });
  } catch (error: any) {
    console.error('Error fetching sequence stats:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
