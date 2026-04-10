import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET() {
  try {
    // Fetch all unique recipient emails that have at least one successfully sent email
    // Using a simpler, more compatible query
    const recipients = await executeQuery(`
      SELECT
        recipient_email,
        COUNT(*) as email_count,
        MAX(sent_at) as last_sent_at
      FROM email_queue
      WHERE status = 'sent'
        AND recipient_email IS NOT NULL
        AND recipient_email != ''
      GROUP BY recipient_email
      HAVING COUNT(*) > 0
      ORDER BY MAX(sent_at) DESC
    `);

    return NextResponse.json({
      success: true,
      recipients: recipients.map((r: any) => ({
        email: r.recipient_email,
        emailCount: parseInt(r.email_count),
        lastSentAt: r.last_sent_at,
        recentSubjects: [] // Simplified for now
      }))
    });
  } catch (error: any) {
    console.error('Error fetching recipient emails:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch recipient emails'
      },
      { status: 500 }
    );
  }
}
