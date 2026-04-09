import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { queue_ids, campaign_id } = body;

    let query = '';
    let params: any[] = [];

    // Allow retrying either specific queue entries or an entire campaign's failed entries
    if (queue_ids && Array.isArray(queue_ids) && queue_ids.length > 0) {
      const placeholders = queue_ids.map((_, i) => `$${i + 1}`).join(',');
      query = `
        UPDATE email_queue 
        SET status = 'queued', attempts = 0, error_message = NULL, updated_at = NOW()
        WHERE id IN (${placeholders}) AND status = 'failed'
        RETURNING id
      `;
      params = queue_ids;
    } 
    else if (campaign_id) {
      query = `
        UPDATE email_queue 
        SET status = 'queued', attempts = 0, error_message = NULL, updated_at = NOW()
        WHERE campaign_id = $1 AND status = 'failed'
        RETURNING id
      `;
      params = [campaign_id];
    } 
    else {
      return NextResponse.json({ success: false, error: 'Must provide either queue_ids array or campaign_id' }, { status: 400 });
    }

    const result = await executeQuery(query, params);

    return NextResponse.json({ 
      success: true, 
      message: `Successfully requeued ${result.length} failed emails for sending.` 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
