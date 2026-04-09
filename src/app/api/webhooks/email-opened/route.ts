import { NextResponse } from 'next/server';
import {
  handleEmailOpenedEvent,
  validateWebhookPayload,
  type EmailOpenedData
} from '@/lib/webhooks/webhook-handler';

/**
 * POST /api/webhooks/email-opened
 *
 * Webhook endpoint for email opened events (optional tracking)
 *
 * Expected payload:
 * {
 *   event: "email.opened",
 *   data: {
 *     queue_id: string,
 *     contact_email: string,
 *     opened_at: string (ISO timestamp),
 *     ip_address?: string,
 *     user_agent?: string
 *   }
 * }
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const payload = await request.json();

    // Validate payload structure
    if (!validateWebhookPayload(payload, 'email.opened')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid payload structure',
          received: payload
        },
        { status: 400 }
      );
    }

    const data: EmailOpenedData = payload.data;

    // Process the email opened event
    const result = await handleEmailOpenedEvent(data);

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
    console.error('Error in email-opened webhook:', error);

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
 * GET /api/webhooks/email-opened
 *
 * Health check endpoint for the webhook
 */
export async function GET() {
  return NextResponse.json({
    status: 'online',
    webhook: 'email.opened',
    description: 'Webhook endpoint for email opened events (optional tracking)',
    version: '1.0.0'
  });
}
