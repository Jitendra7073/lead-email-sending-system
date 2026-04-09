import { NextRequest, NextResponse } from 'next/server';
import {
  validateWebhookPayload,
  type EmailEventType,
  type WebhookResult
} from './webhook-handler';
import {
  WebhookRateLimiter,
  getClientIP,
  verifyWebhookSignature,
  extractSignature,
  validateTimestamp
} from './webhook-utils';

/**
 * Enhanced webhook route handler with security features
 *
 * Provides:
 * - Rate limiting
 * - Signature verification (optional)
 * - Timestamp validation (optional)
 * - Request logging
 * - Error handling
 */

export interface SecureWebhookOptions {
  /**
   * Event type this handler processes
   */
  eventType: EmailEventType;

  /**
   * Handler function for the event
   */
  handler: (data: any) => Promise<WebhookResult>;

  /**
   * Enable rate limiting (default: true)
   */
  rateLimit?: boolean;

  /**
   * Rate limiter instance (optional, creates default if not provided)
   */
  rateLimiter?: WebhookRateLimiter;

  /**
   * Enable signature verification (default: false)
   */
  verifySignature?: boolean;

  /**
   * Webhook secret for signature verification
   */
  webhookSecret?: string;

  /**
   * Enable timestamp validation (default: false)
   */
  validateTimestamp?: boolean;

  /**
   * Maximum age of timestamp in seconds (default: 300)
   */
  maxTimestampAge?: number;

  /**
   * Log all requests (default: true)
   */
  logRequests?: boolean;
}

/**
 * Create a secure webhook handler
 */
export function createSecureWebhookHandler(options: SecureWebhookOptions) {
  const {
    eventType,
    handler,
    rateLimit = true,
    rateLimiter: customRateLimiter,
    verifySignature = false,
    webhookSecret,
    validateTimestamp: validateTimestampFlag = false,
    maxTimestampAge = 300,
    logRequests = true
  } = options;

  // Create default rate limiter if not provided
  const rateLimiter = customRateLimiter || new WebhookRateLimiter(60000, 100);

  return async (request: NextRequest) => {
    const startTime = Date.now();
    const clientIP = getClientIP(request);

    try {
      // Log incoming request
      if (logRequests) {
        console.log(`[Webhook] ${eventType} request from ${clientIP}`);
      }

      // Check rate limit
      if (rateLimit && rateLimiter.isRateLimited(clientIP)) {
        if (logRequests) {
          console.warn(`[Webhook] Rate limit exceeded for ${clientIP}`);
        }

        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil(rateLimiter['windowMs'] / 1000)
          },
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(Math.ceil(rateLimiter['windowMs'] / 1000))
            }
          }
        );
      }

      // Get raw body for signature verification
      const rawBody = await request.text();

      // Verify signature if enabled
      if (verifySignature && webhookSecret) {
        const signature = extractSignature(request);

        if (!signature) {
          return NextResponse.json(
            {
              success: false,
              error: 'Signature missing'
            },
            { status: 401 }
          );
        }

        const isValidSignature = verifyWebhookSignature(rawBody, signature, webhookSecret);

        if (!isValidSignature) {
          if (logRequests) {
            console.warn(`[Webhook] Invalid signature from ${clientIP}`);
          }

          return NextResponse.json(
            {
              success: false,
              error: 'Invalid signature'
            },
            { status: 401 }
          );
        }
      }

      // Parse payload
      let payload;
      try {
        payload = JSON.parse(rawBody);
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid JSON payload'
          },
          { status: 400 }
        );
      }

      // Validate payload structure
      if (!validateWebhookPayload(payload, eventType)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid payload structure',
            received: payload
          },
          { status: 400 }
        );
      }

      // Validate timestamp if enabled
      if (validateTimestampFlag && payload.data.sent_at) {
        const isValidTimestamp = validateTimestamp(
          payload.data.sent_at,
          maxTimestampAge
        );

        if (!isValidTimestamp) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid timestamp',
              message: `Timestamp must be within ${maxTimestampAge} seconds`
            },
            { status: 400 }
          );
        }
      }

      // Process the webhook
      const result = await handler(payload.data);

      // Log processing time
      const processingTime = Date.now() - startTime;
      if (logRequests) {
        console.log(
          `[Webhook] ${eventType} processed in ${processingTime}ms - Success: ${result.success}`
        );
      }

      // Return response
      if (result.success) {
        return NextResponse.json({
          success: true,
          received: true,
          message: result.message,
          data: result.data,
          processing_time_ms: processingTime
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
      const processingTime = Date.now() - startTime;

      console.error(`[Webhook] Error processing ${eventType}:`, error);

      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          message: error.message,
          processing_time_ms: processingTime
        },
        { status: 500 }
      );
    }
  };
}

/**
 * GET handler for webhook health check
 */
export function createWebhookHealthHandler(eventType: string) {
  return () => {
    return NextResponse.json({
      status: 'online',
      webhook: eventType,
      description: `Webhook endpoint for ${eventType} events`,
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  };
}
