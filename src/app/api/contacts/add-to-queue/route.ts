import { NextResponse } from 'next/server';
import { executeQuery, dbPool } from '@/lib/db/postgres';
import { detectTimezone } from '@/lib/schedule/timezone-detector';

export async function POST(request: Request) {
  const client = await dbPool.connect();

  try {
    const body = await request.json();
    const { contact_ids, template_id, sequence_id } = body;

    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'contact_ids array is required'
      }, { status: 400 });
    }

    // Validate that either template_id or sequence_id is provided
    if (!template_id && !sequence_id) {
      return NextResponse.json({
        success: false,
        error: 'Either template_id or sequence_id is required'
      }, { status: 400 });
    }

    await client.query('BEGIN');

    // CRITICAL: Check for active senders before queuing emails
    const activeSendersResult = await client.query(
      `SELECT COUNT(*) as count FROM email_senders WHERE is_active = true`
    );

    const activeSenderCount = parseInt(activeSendersResult.rows[0].count);

    if (activeSenderCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: false,
        error: 'NO_ACTIVE_SENDERS',
        message: 'No active email senders found. Please add or activate at least one email sender before queuing emails.',
        requires_sender_setup: true
      }, { status: 400 });
    }

    let templatesToAdd = [];

    if (sequence_id) {
      // Fetch all templates in the sequence
      const sequenceItemsResult = await client.query(`
        SELECT
          si.id as item_id,
          si.template_id,
          si.position,
          si.delay_days,
          si.delay_hours,
          si.send_time,
          t.name as template_name,
          t.subject,
          t.html_content,
          t.text_content
        FROM email_sequence_items si
        LEFT JOIN email_templates t ON si.template_id = t.id
        WHERE si.sequence_id = $1
        ORDER BY si.position ASC
      `, [sequence_id]);

      if (sequenceItemsResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({
          success: false,
          error: 'No templates found in this sequence'
        }, { status: 404 });
      }

      templatesToAdd = sequenceItemsResult.rows.map(row => ({
        item_id: row.item_id,
        template_id: row.template_id,
        position: row.position,
        delay_days: row.delay_days,
        delay_hours: row.delay_hours,
        send_time: row.send_time,
        template_name: row.template_name,
        subject: row.subject,
        html_content: row.html_content,
        text_content: row.text_content
      }));
    } else {
      // Single template mode
      const templateResult = await client.query(
        'SELECT * FROM email_templates WHERE id = $1',
        [template_id]
      );

      if (templateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({
          success: false,
          error: 'Template not found'
        }, { status: 404 });
      }

      const template = templateResult.rows[0];
      templatesToAdd = [{
        template_id: template.id,
        position: 1,
        delay_days: 0,
        subject: template.subject,
        html_content: template.html_content,
        text_content: template.text_content
      }];
    }

    // Get contact details and enrich with timezone
    const contactsResult = await client.query(
      `SELECT c.*, s.country, s.url as site_url
       FROM contacts c
       LEFT JOIN sites s ON c.site_id = s.id
       WHERE c.id = ANY($1) AND c.type = 'email'`,
      [contact_ids]
    );

    if (contactsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: false,
        error: 'No valid email contacts found'
      }, { status: 404 });
    }

    // Create a campaign for tracking
    const campaignName = sequence_id
      ? `Sequence Campaign - ${new Date().toLocaleDateString()}`
      : `Quick Send - ${new Date().toLocaleDateString()}`;

    const campaignResult = await client.query(
      `INSERT INTO email_campaigns (name, status, total_recipients)
       VALUES ($1, 'running', $2)
       RETURNING id`,
      [campaignName, contactsResult.rows.length]
    );

    const campaignId = campaignResult.rows[0].id;

    // Add contacts to queue for each template in the sequence
    const queuedEmails = [];
    const now = new Date();

    for (const contact of contactsResult.rows) {
      // Detect timezone if not present
      if (!contact.timezone || !contact.country_code) {
        const detection = await detectTimezone(contact.value);
        if (detection) {
          await client.query(
            `UPDATE contacts SET timezone = $1, country_code = $2, updated_at = NOW() WHERE id = $3`,
            [detection.timezone, detection.country_code, contact.id]
          );
          contact.timezone = detection.timezone;
          contact.country_code = detection.country_code;
        }
      }

      // Add each template in the sequence to the queue
      for (const templateInfo of templatesToAdd) {
        // Calculate scheduled time based on delay_days/delay_hours
        let scheduledAt = new Date(now);
        if (templateInfo.delay_days) {
          scheduledAt.setDate(scheduledAt.getDate() + templateInfo.delay_days);
        }
        if ('delay_hours' in templateInfo && templateInfo.delay_hours) {
          scheduledAt.setHours(scheduledAt.getHours() + templateInfo.delay_hours);
        }

        // Insert into email queue
        const queueResult = await client.query(
          `INSERT INTO email_queue
           (campaign_id, contact_id, recipient_email, recipient_name, subject, html_content,
            template_id, scheduled_at, adjusted_scheduled_at, status, sequence_position,
            recipient_timezone, country_code, dependency_satisfied)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ready_to_send', $10, $11, $12, true)
           RETURNING id`,
          [
            campaignId,
            contact.id,
            contact.value,
            contact.value.split('@')[0],
            templateInfo.subject,
            templateInfo.html_content,
            templateInfo.template_id,
            scheduledAt,
            scheduledAt, // adjusted_scheduled_at should be the scheduled time, not current time
            templateInfo.position,
            contact.timezone || 'UTC',
            contact.country_code || 'US'
          ]
        );

        queuedEmails.push({
          queue_id: queueResult.rows[0].id,
          contact_id: contact.id,
          template_id: templateInfo.template_id,
          email: contact.value
        });
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Successfully added ${queuedEmails.length} emails to queue (${contactsResult.rows.length} contacts × ${templatesToAdd.length} templates)`,
      data: {
        campaign_id: campaignId,
        queued_emails: queuedEmails,
        total_queued: queuedEmails.length,
        contacts_count: contactsResult.rows.length,
        templates_count: templatesToAdd.length
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
