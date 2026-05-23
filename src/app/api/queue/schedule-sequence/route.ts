import { NextResponse } from 'next/server';
import { dbPool } from '@/lib/db/postgres';
import { calculateDependentSchedule, calculateOptimalSchedule } from '@/lib/schedule/schedule-calculator';

interface EmailToSchedule {
  contact_id: number;
  contact_email: string;
  template_id: string;
  position: number;
  scheduled_at: Date;
  status: 'ready' | 'weekend' | 'outside_hours';
  reason?: string;
}

interface SequenceItem {
  id: string;
  template_id: string;
  position: number;
  delay_days: number;
  send_time: string;
  subject: string;
  html_content: string;
}

interface ScheduledEmail {
  queue_id: string;
  contact_id: number;
  contact_email: string;
  template_id: string;
  template_subject: string;
  position: number;
  scheduled_at: Date;
  status: string;
  recipient_timezone: string;
  country_code: string;
  adjustments: unknown[];
}

export async function POST(request: Request) {
  const client = await dbPool.connect();

  try {
    const body = await request.json();
    const { sequence_id, emails, delivery_option = 'immediate', custom_date_time } = body;

    if (!sequence_id || !emails || !Array.isArray(emails)) {
      return NextResponse.json({
        success: false,
        error: 'sequence_id and emails array are required'
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

    // Get sequence info with items
    const sequenceResult = await client.query(
      `SELECT s.*,
        json_agg(
          json_build_object(
            'id', si.id,
            'template_id', si.template_id,
            'position', si.position,
            'delay_days', si.delay_days,
            'send_time', si.send_time,
            'subject', t.subject,
            'html_content', t.html_content
          ) ORDER BY si.position
        ) as items
       FROM email_sequences s
       LEFT JOIN email_sequence_items si ON s.id = si.sequence_id
       LEFT JOIN email_templates t ON si.template_id = t.id
       WHERE s.id = $1
       GROUP BY s.id`,
      [sequence_id]
    );

    if (sequenceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: false,
        error: 'Sequence not found'
      }, { status: 404 });
    }

    const sequence = sequenceResult.rows[0];
    const sequenceItems: SequenceItem[] = (sequence.items as SequenceItem[]).filter((item) => item.template_id);

    if (sequenceItems.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: false,
        error: 'No templates found in this sequence'
      }, { status: 400 });
    }

    // Create campaign
    const campaignResult = await client.query(
      `INSERT INTO email_campaigns (name, status, total_recipients, sequence_id)
       VALUES ($1, 'queued', $2, $3)
       RETURNING id`,
      [
        `${sequence.name} - ${new Date().toLocaleDateString()}`,
        emails.length * sequenceItems.length,
        sequence_id
      ]
    );

    const campaignId = campaignResult.rows[0].id;

    // Group emails by contact
    const emailsByContact = new Map<number, EmailToSchedule[]>();
    for (const email of emails) {
      if (!emailsByContact.has(email.contact_id)) {
        emailsByContact.set(email.contact_id, []);
      }
      emailsByContact.get(email.contact_id)!.push(email);
    }

    // Calculate base time for first email based on delivery option
    let baseTime = new Date();
    if (delivery_option === 'custom' && custom_date_time) {
      baseTime = new Date(custom_date_time);
    }

    // Insert all emails into queue with proper delay calculation
    let queuedCount = 0;
    const now = new Date();
    const scheduledEmails: ScheduledEmail[] = [];

    for (const [contactId, contactEmails] of emailsByContact) {
      // Sort by position to ensure proper ordering
      contactEmails.sort((a, b) => a.position - b.position);

      for (let i = 0; i < sequenceItems.length; i++) {
        const item = sequenceItems[i];
        const contactEmail = contactEmails.find(e => e.position === item.position);

        if (!contactEmail) {
          // If no specific email for this position and this is the first item, skip
          if (i === 0) {
            continue; // Skip if no first email
          }
        }

        // Get the contact email, timezone, and country code
        const contactInfo = await client.query(
          `SELECT value, timezone, country_code FROM contacts WHERE id = $1`,
          [contactId]
        );

        if (contactInfo.rows.length === 0) {
          console.warn(`Contact ${contactId} not found, skipping`);
          continue;
        }

        const recipientEmail = contactInfo.rows[0].value;
        const recipientTimezone = contactInfo.rows[0].timezone || 'UTC';
        const recipientCountryCode = contactInfo.rows[0].country_code || 'US';

        const previousQueueItem = scheduledEmails
          .filter(email => email.contact_id === contactId)
          .sort((a, b) => b.position - a.position)[0];

        const scheduleResult = item.position === 1 || !previousQueueItem
          ? await calculateOptimalSchedule({
              recipient_country: recipientCountryCode,
              recipient_timezone: recipientTimezone,
              base_time: baseTime.toISOString(),
              send_time: item.send_time || '10:00'
            })
          : await calculateDependentSchedule(
              previousQueueItem.scheduled_at.toISOString(),
              item.delay_days || 0,
              {
                recipient_country: recipientCountryCode,
                recipient_timezone: recipientTimezone,
                send_time: item.send_time || '10:00'
              }
            );

        const scheduledAt = new Date(scheduleResult.adjusted_scheduled_at);

        let status = scheduledAt > now ? 'scheduled' : 'ready_to_send';
        let dependencySatisfied = true;

        if (item.position > 1) {
          status = 'pending';
          dependencySatisfied = false;
        }

        // Insert into queue
        const queueResult = await client.query(
          `INSERT INTO email_queue
           (campaign_id, contact_id, recipient_email, recipient_name, subject, html_content,
            template_id, scheduled_at, adjusted_scheduled_at, status, sequence_position,
            recipient_timezone, country_code, dependency_satisfied, depends_on_queue_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING id`,
          [
            campaignId,
            contactId,
            recipientEmail,
            recipientEmail.split('@')[0],
            item.subject,
            item.html_content,
            item.template_id,
            scheduledAt,
            scheduledAt,
            status,
            item.position,
            recipientTimezone,
            recipientCountryCode,
            dependencySatisfied,
            previousQueueItem?.queue_id || null
          ]
        );

        const queueId = queueResult.rows[0].id;
        scheduledEmails.push({
          queue_id: queueId,
          contact_id: contactId,
          contact_email: recipientEmail,
          template_id: item.template_id,
          template_subject: item.subject,
          position: item.position,
          scheduled_at: scheduledAt,
          status: status,
          recipient_timezone: recipientTimezone,
          country_code: recipientCountryCode,
          adjustments: scheduleResult.adjustments
        });

        queuedCount++;
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Successfully queued ${queuedCount} emails for ${emailsByContact.size} contacts`,
      data: {
        campaign_id: campaignId,
        queued_count: queuedCount,
        contacts_count: emailsByContact.size,
        emails_per_contact: sequenceItems.length,
        scheduled_emails: scheduledEmails
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scheduling error';
    await client.query('ROLLBACK');
    console.error('Error scheduling sequence:', error);
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 });
  } finally {
    client.release();
  }
}
