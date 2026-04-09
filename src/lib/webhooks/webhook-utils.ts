import { NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * Webhook security utilities
 */

/**
 * Verify webhook signature (HMAC-based)
 * Useful if your email service signs webhook payloads
 *
 * @param payload - Raw request body as string
 * @param signature - Signature from request header
 * @param secret - Webhook secret key
 * @returns boolean indicating if signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const digest = hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Extract signature from common webhook header formats
 */
export function extractSignature(request: NextRequest): string | null {
  // Common header names for webhook signatures
  const headers = [
    'x-webhook-signature',
    'x-hub-signature-256',
    'x-hub-signature',
    'webhook-signature',
    'signature'
  ];

  for (const header of headers) {
    const signature = request.headers.get(header);
    if (signature) {
      // Remove hash algorithm prefix if present (e.g., "sha256=")
      return signature.replace(/^[a-z0-9]+=/i, '');
    }
  }

  return null;
}

/**
 * Rate limiter for webhook endpoints
 * Prevents abuse by limiting requests from same IP
 */
export class WebhookRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly _windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this._windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request should be rate limited
   * @param identifier - IP address or unique identifier
   * @returns true if rate limited, false if allowed
   */
  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this._windowMs;

    // Get existing requests for this identifier
    let timestamps = this.requests.get(identifier) || [];

    // Filter out timestamps outside the current window
    timestamps = timestamps.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (timestamps.length >= this.maxRequests) {
      return true;
    }

    // Add current request timestamp
    timestamps.push(now);
    this.requests.set(identifier, timestamps);

    return false;
  }

  /**
   * Get remaining requests allowed for identifier
   */
  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const windowStart = now - this._windowMs;
    const timestamps = this.requests.get(identifier) || [];
    const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);

    return Math.max(0, this.maxRequests - validTimestamps.length);
  }

  /**
   * Reset rate limit for identifier
   */
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * Get the rate limiter window size in milliseconds
   */
  get windowMs(): number {
    return this._windowMs;
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this._windowMs;

    for (const [identifier, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);

      if (validTimestamps.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, validTimestamps);
      }
    }
  }
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers for IP address
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
    'x-client-ip',
    'x-forwarded',
    'forwarded-for'
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ips = value.split(',').map(ip => ip.trim());
      return ips[0];
    }
  }

  // Fallback to request IP
  return 'unknown';
}

/**
 * Validate webhook timestamp
 * Prevents replay attacks by ensuring timestamps are within allowed window
 *
 * @param timestamp - ISO timestamp string
 * @param maxAgeSeconds - Maximum age in seconds (default: 5 minutes)
 * @returns boolean indicating if timestamp is valid
 */
export function validateTimestamp(timestamp: string, maxAgeSeconds: number = 300): boolean {
  try {
    const webhookTime = new Date(timestamp).getTime();
    const now = Date.now();
    const ageSeconds = (now - webhookTime) / 1000;

    // Timestamp should be within the allowed window and not in the future
    return ageSeconds >= 0 && ageSeconds <= maxAgeSeconds;
  } catch (error) {
    console.error('Timestamp validation error:', error);
    return false;
  }
}

/**
 * Middleware-style rate limiter for Next.js routes
 */
export function createRateLimiterMiddleware(
  rateLimiter: WebhookRateLimiter,
  options: {
    onRateLimited?: (identifier: string) => Response;
    identifier?: (request: NextRequest) => string;
  } = {}
) {
  return async (request: NextRequest) => {
    const getIdentifier = options.identifier || getClientIP;
    const identifier = getIdentifier(request);

    if (rateLimiter.isRateLimited(identifier)) {
      if (options.onRateLimited) {
        return options.onRateLimited(identifier);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil(rateLimiter.windowMs / 1000)
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(rateLimiter.windowMs / 1000))
          }
        }
      );
    }

    return null; // Allow request to proceed
  };
}
