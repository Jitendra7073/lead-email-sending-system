import { NextResponse } from 'next/server';
import {
  handleEmailFailedEvent,
  validateWebhookPayload,
  type EmailFailedData
} from '@/lib/webhooks/webhook-handler';

/**
 * POST /api/webhooks/email-failed
 *
 * Webhook endpoint for email failed events
 *
 * Expected payload:
 * {
 *   event: "email.failed",
 *   data: {
 *     queue_id: string,
 *     campaign_id?: string,
 *     contact_email: string,
 *     failed_at: string (ISO timestamp),
 *     error: string,
 *     sender_id?: string,
 *     subject?: string
 *   }
 * }
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const payload = await request.json();

    // Validate payload structure
    if (!validateWebhookPayload(payload, 'email.failed')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid payload structure',
          received: payload
        },
        { status: 400 }
      );
    }

    const data: EmailFailedData = payload.data;

    // Process the email failed event
    const result = await handleEmailFailedEvent(data);

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
    console.error('Error in email-failed webhook:', error);

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
 * GET /api/webhooks/email-failed
 *
 * Health check endpoint for the webhook
 */
export async function GET() {
  return NextResponse.json({
    status: 'online',
    webhook: 'email.failed',
    description: 'Webhook endpoint for email failed events',
    version: '1.0.0'
  });
}
