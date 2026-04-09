import { NextResponse } from 'next/server';
import { verifyContactsBulk, getVerificationStats } from '@/lib/services/email-verification/verification-service';

/**
 * POST /api/email-verification/bulk-verify
 * Bulk verify selected email contacts
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contact_ids, force } = body;

    console.log(`[DEBUG] Received verification request for contact IDs:`, contact_ids);

    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'contact_ids array is required'
      }, { status: 400 });
    }

    // Verify contacts in bulk
    const results = await verifyContactsBulk(contact_ids, !!force);

    // Calculate summary
    const summary = {
      total: results.length,
      valid: results.filter(r => r.status === 'valid').length,
      invalid: results.filter(r => r.status === 'invalid').length,
      risky: results.filter(r => r.status === 'risky').length,
      unknown: results.filter(r => r.status === 'unknown').length,
      newly_verified: results.filter(r => r.is_new).length,
      reused: results.filter(r => !r.is_new).length
    };

    console.log(`[DEBUG] Returning verification results:`, results);
    return NextResponse.json({
      success: true,
      results,
      summary
    });
  } catch (error: any) {
    console.error('Error in bulk verification:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/email-verification/stats
 * Get verification statistics
 */
export async function GET() {
  try {
    const stats = await getVerificationStats();

    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Error getting verification stats:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
