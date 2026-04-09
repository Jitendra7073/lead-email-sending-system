import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const query = `
      SELECT c.*, 
             g.name as group_name,
             (SELECT COUNT(*) FROM email_queue WHERE campaign_id = c.id) as total_emails,
             (SELECT COUNT(*) FROM email_queue WHERE campaign_id = c.id AND status = 'queued') as pending_count,
             (SELECT COUNT(*) FROM email_queue WHERE campaign_id = c.id AND status = 'sent') as sent_count,
             (SELECT COUNT(*) FROM email_queue WHERE campaign_id = c.id AND status = 'failed') as failed_count
      FROM email_campaigns c
      LEFT JOIN template_groups g ON c.group_id = g.id
      WHERE c.id = $1
    `;
    
    const result = await executeQuery(query, [id]);
    
    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: result[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body; // action could be "pause", "resume"

    let newStatus = '';
    if (action === 'pause') newStatus = 'paused';
    else if (action === 'resume') newStatus = 'running'; // Or 'queued'
    else return NextResponse.json({ success: false, error: 'Invalid action. Use pause or resume.' }, { status: 400 });

    const query = `
      UPDATE email_campaigns
      SET status = $1
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await executeQuery(query, [newStatus, id]);
    
    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }

    // Also cascade pause/unpause to the queue where appropriate
    if (newStatus === 'paused') {
        await executeQuery(`UPDATE email_queue SET status = 'paused' WHERE campaign_id = $1 AND status = 'queued'`, [id]);
    } else if (newStatus === 'running') {
        await executeQuery(`UPDATE email_queue SET status = 'queued' WHERE campaign_id = $1 AND status = 'paused'`, [id]);
    }
    
    return NextResponse.json({ success: true, data: result[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Note: Due to ON DELETE CASCADE on the queue table, this will wipe associated email queue entries!
    const query = `DELETE FROM email_campaigns WHERE id = $1 RETURNING id`;
    
    const result = await executeQuery(query, [id]);
    
    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, message: 'Campaign and associated queue successfully destroyed' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
