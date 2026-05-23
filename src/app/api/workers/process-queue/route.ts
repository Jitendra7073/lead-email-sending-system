import { NextResponse } from 'next/server';
import { processDueQueue } from '@/lib/queue/queue-processor';

export async function GET(request: Request) {
  // Check CRON_SECRET authorization
  // Accept secret via either Authorization header OR query parameter
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({
      success: false,
      error: 'CRON_SECRET not configured'
    }, { status: 500 });
  }

  // Check Authorization header OR query parameter
  const isValidAuth = authHeader === `Bearer ${cronSecret}` || secretParam === cronSecret;

  if (!isValidAuth) {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 });
  }

  try {
    const startedAt = Date.now();
    const result = await processDueQueue({ batchSize: 20 });

    return NextResponse.json({
      success: true,
      ...result,
      processing_time_ms: Date.now() - startedAt,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown queue processing error';
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 });
  }
}
