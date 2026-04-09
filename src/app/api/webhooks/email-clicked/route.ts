import { NextResponse } from 'next/server';
import {
  handleEmailClickedEvent,
  validateWebhookPayload,
  type EmailClickedData
} from '@/lib/webhooks/webhook-handler';

/**
 * POST /api/webhooks/email-clicked
 *
 * Webhook endpoint for email clicked events (optional tracking)
 *
 * Expected payload:
 * {
 *   event: "email.clicked",
 *   data: {
 *     queue_id: string,
 *     contact_email: string,
 *     url: string,
 *     clicked_at: string (ISO timestamp),
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
    if (!validateWebhookPayload(payload, 'email.clicked')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid payload structure',
          received: payload
        },
        { status: 400 }
      );
    }

    const data: EmailClickedData = payload.data;

    // Process the email clicked event
    const result = await handleEmailClickedEvent(data);

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
    console.error('Error in email-clicked webhook:', error);

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
 * GET /api/webhooks/email-clicked
 *
 * Health check endpoint for the webhook
 */
export async function GET() {
  return NextResponse.json({
    status: 'online',
    webhook: 'email.clicked',
    description: 'Webhook endpoint for email clicked events (optional tracking)',
    version: '1.0.0'
  });
}
