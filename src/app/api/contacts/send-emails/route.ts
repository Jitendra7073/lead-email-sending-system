import { NextResponse } from 'next/server';
import { executeQuery, dbPool } from '@/lib/db/postgres';

export async function POST(request: Request) {
  const client = await dbPool.connect();

  try {
    const body = await request.json();
    const { contact_ids, sequence_id, sender_id } = body;

    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'contact_ids array is required'
      }, { status: 400 });
    }

    if (!sequence_id) {
      return NextResponse.json({
        success: false,
        error: 'sequence_id is required'
      }, { status: 400 });
    }

    if (!sender_id) {
      return NextResponse.json({
        success: false,
        error: 'sender_id is required'
      }, { status: 400 });
    }

    await client.query('BEGIN');

    // Get sender details
    const senderResult = await client.query(
      'SELECT * FROM email_senders WHERE id = $1',
      [sender_id]
    );

    if (senderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: false,
        error: 'Sender not found'
      }, { status: 404 });
    }

    const sender = senderResult.rows[0];

    // Get the first template from the sequence
    const sequenceResult = await client.query(`
      SELECT
        si.template_id,
        si.position,
        t.name as template_name,
        t.subject,
        t.html_content,
        t.text_content
      FROM email_sequence_items si
      LEFT JOIN email_templates t ON si.template_id = t.id
      WHERE si.sequence_id = $1
      ORDER BY si.position ASC
      LIMIT 1
    `, [sequence_id]);

    if (sequenceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: false,
        error: 'No templates found in this sequence'
      }, { status: 404 });
    }

    const template = sequenceResult.rows[0];

    // Get email contacts
    const contactsResult = await client.query(
      `SELECT id, value FROM contacts WHERE id = ANY($1) AND type = 'email'`,
      [contact_ids]
    );

    if (contactsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: false,
        error: 'No valid email contacts found'
      }, { status: 404 });
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors = [];

    // Send emails (simulated for now - you can integrate actual email sending)
    for (const contact of contactsResult.rows) {
      try {
        // For now, just log the email. In production, integrate with your email service
        console.log(`Sending email to ${contact.value} using sender ${sender.email}`);

        // Create a send log entry
        await client.query(
          `INSERT INTO email_send_log (contact_id, contact_email, template_id, status, sent_at)
           VALUES ($1, $2, $3, 'sent', NOW())`,
          [contact.id, contact.value, template.template_id]
        );

        sentCount++;
      } catch (err: any) {
        console.error(`Failed to send to ${contact.value}:`, err);
        failedCount++;
        errors.push(`${contact.value}: ${err.message}`);
      }
    }

    // Update sender's daily sent count
    await client.query(
      `UPDATE email_senders
       SET sent_today = COALESCE(sent_today, 0) + $1,
           last_reset_date = CASE
             WHEN last_reset_date IS NULL OR last_reset_date::date != CURRENT_DATE
             THEN CURRENT_DATE::text
             ELSE last_reset_date
           END
       WHERE id = $2`,
      [sentCount, sender_id]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Successfully sent ${sentCount} emails`,
      data: {
        sent_count: sentCount,
        failed_count: failedCount,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  } finally {
    client.release();
  }
}
