import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import nodemailer from 'nodemailer';

/**
 * POST /api/aliases/verify
 * Verify an alias by sending a test email
 *
 * This sends a test email to the alias address to verify that:
 * 1. The SMTP server accepts the alias as a valid from address
 * 2. The email is deliverable
 *
 * Requirements:
 * - The sender account must be able to send from the alias
 * - The alias domain must have proper SPF/DKIM records (recommended)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { alias_id, test_recipient } = body;

    if (!alias_id) {
      return NextResponse.json({
        success: false,
        error: 'Alias ID is required'
      }, { status: 400 });
    }

    // Get alias and sender information
    const aliasResult = await executeQuery(`
      SELECT
        a.*,
        s.email as sender_email,
        s.name as sender_name,
        s.smtp_host,
        s.smtp_port,
        s.smtp_user,
        s.app_password
      FROM email_aliases a
      LEFT JOIN email_senders s ON a.sender_id = s.id
      WHERE a.id = $1
    `, [alias_id]);

    if (aliasResult.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Alias not found'
      }, { status: 404 });
    }

    const alias = aliasResult[0];

    // Create transporter with sender credentials
    const transporter = nodemailer.createTransport({
      host: alias.smtp_host || 'smtp.gmail.com',
      port: alias.smtp_port || 587,
      secure: alias.smtp_port === 465,
      auth: {
        user: alias.smtp_user || alias.sender_email,
        pass: alias.app_password,
      },
    });

    // Send test email to the alias itself (or provided test recipient)
    const testTo = test_recipient || alias.alias_email;

    try {
      const info = await transporter.sendMail({
        from: `"${alias.alias_name || alias.sender_name}" <${alias.alias_email}>`,
        to: testTo,
        subject: 'Alias Verification Test - Email Sending System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">✓ Alias Verification Successful</h2>
            <p>This is a test email to verify that your email alias is configured correctly.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Alias Email:</strong> ${alias.alias_email}</p>
              <p><strong>Sender Account:</strong> ${alias.sender_email}</p>
              <p><strong>Tested At:</strong> ${new Date().toISOString()}</p>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              If you received this email, your alias is properly configured and ready to use.
            </p>
          </div>
        `,
      });

      // Update alias as verified
      await executeQuery(`
        UPDATE email_aliases
        SET is_verified = true,
            verification_method = 'email_test',
            last_used_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `, [alias_id]);

      return NextResponse.json({
        success: true,
        message: 'Alias verified successfully! Test email sent.',
        data: {
          messageId: info.messageId,
          testRecipient: testTo,
          testSubject: 'Alias Verification Test'
        }
      });

    } catch (smtpError: any) {
      console.error('SMTP verification failed:', smtpError);

      let errorMessage = 'Verification failed. ';

      if (smtpError.code === 'EAUTH') {
        errorMessage += 'Authentication failed. Check sender credentials.';
      } else if (smtpError.code === 'EMESSAGE') {
        errorMessage += 'Sender address rejected. The alias may not be authorized for this SMTP account.';
      } else if (smtpError.responseCode === 550) {
        errorMessage += 'Sender address not allowed. Check SPF/DNS records or contact your email provider.';
      } else {
        errorMessage += smtpError.message || 'Unknown SMTP error.';
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        details: {
          code: smtpError.code,
          responseCode: smtpError.responseCode,
          response: smtpError.response
        }
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Error verifying alias:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
