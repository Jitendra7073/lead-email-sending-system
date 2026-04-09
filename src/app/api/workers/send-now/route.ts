import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contact_ids, template_id } = body;

    // Validate input
    if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'contact_ids must be a non-empty array'
      }, { status: 400 });
    }

    if (!template_id) {
      return NextResponse.json({
        success: false,
        error: 'template_id is required'
      }, { status: 400 });
    }

    // Get template
    const templateResult = await executeQuery(
      `SELECT * FROM email_templates WHERE id = $1 AND is_active = true`,
      [template_id]
    );

    if (!templateResult || templateResult.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Template not found or inactive'
      }, { status: 404 });
    }

    const template = templateResult[0];

    // Get an active sender (order by last_used, limit 1)
    const senderResult = await executeQuery(
      `SELECT * FROM email_senders
       WHERE is_active = true
       AND sent_today < daily_limit
       ORDER BY last_used ASC NULLS FIRST
       LIMIT 1`
    );

    if (!senderResult || senderResult.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active sender available with capacity'
      }, { status: 400 });
    }

    const sender = senderResult[0];

    // Get contacts
    const contactsResult = await executeQuery(
      `SELECT * FROM contacts WHERE id = ANY($1) AND type = 'email'`,
      [contact_ids]
    );

    if (!contactsResult || contactsResult.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid email contacts found'
      }, { status: 404 });
    }

    // Configure nodemailer transport
    const transporter = nodemailer.createTransport({
      host: sender.smtp_host || 'smtp.gmail.com',
      port: sender.smtp_port || 587,
      secure: sender.smtp_port === 465,
      auth: {
        user: sender.smtp_user || sender.email,
        pass: sender.app_password,
      },
    });

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Send emails to each contact
    for (const contact of contactsResult) {
      try {
        // Send email
        const info = await transporter.sendMail({
          from: `"${sender.name}" <${sender.email}>`,
          to: contact.value,
          subject: template.subject,
          html: template.html_content,
        });

        // Log successful send
        await executeQuery(`
          INSERT INTO email_send_log (contact_id, contact_email, template_id, send_type, status, sent_at)
          VALUES ($1, $2, $3, 'immediate', 'sent', NOW())
        `, [contact.id, contact.value, template_id]);

        successCount++;

        results.push({
          contact_id: contact.id,
          email: contact.value,
          status: 'sent',
          message_id: info.messageId
        });

      } catch (sendError: any) {
        failureCount++;

        // Log failed send
        await executeQuery(`
          INSERT INTO email_send_log (contact_id, contact_email, template_id, send_type, status, sent_at)
          VALUES ($1, $2, $3, 'immediate', 'failed', NOW())
        `, [contact.id, contact.value, template_id]);

        results.push({
          contact_id: contact.id,
          email: contact.value,
          status: 'failed',
          error: sendError.message
        });
      }
    }

    // Update sender's last_used timestamp and increment sent_today
    await executeQuery(
      `UPDATE email_senders
       SET last_used = NOW(),
           sent_today = sent_today + $1
       WHERE id = $2`,
      [successCount, sender.id]
    );

    return NextResponse.json({
      success: true,
      sender: {
        id: sender.id,
        email: sender.email,
        name: sender.name
      },
      template: {
        id: template.id,
        name: template.name
      },
      summary: {
        total: contactsResult.length,
        success: successCount,
        failure: failureCount
      },
      results
    });

  } catch (err: any) {
    console.error('Error in send-now endpoint:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Internal server error'
    }, { status: 500 });
  }
}
