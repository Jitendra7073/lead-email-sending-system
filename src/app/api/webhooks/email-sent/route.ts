import { NextResponse } from 'next/server';
import {
  handleEmailSentEvent,
  validateWebhookPayload,
  type EmailSentData
} from '@/lib/webhooks/webhook-handler';

/**
 * POST /api/webhooks/email-sent
 *
 * Webhook endpoint for email sent events
 *
 * Expected payload:
 * {
 *   event: "email.sent",
 *   data: {
 *     queue_id: string,
 *     campaign_id?: string,
 *     contact_email: string,
 *     sent_at: string (ISO timestamp),
 *     sender_id: string,
 *     subject: string,
 *     smtp_response?: string,
 *     timezone?: string
 *   }
 * }
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const payload = await request.json();

    // Validate payload structure
    if (!validateWebhookPayload(payload, 'email.sent')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid payload structure',
          received: payload
        },
        { status: 400 }
      );
    }

    const data: EmailSentData = payload.data;

    // Process the email sent event
    const result = await handleEmailSentEvent(data);

    if (result.success) {
      return NextResponse.json({
        success: true,
        received: true,
        message: result.message,
        data: result.data
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
          data: result.data
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in email-sent webhook:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/email-sent
 *
 * Health check endpoint for the webhook
 */
export async function GET() {
  return NextResponse.json({
    status: 'online',
    webhook: 'email.sent',
    description: 'Webhook endpoint for email sent events',
    version: '1.0.0'
  });
}
