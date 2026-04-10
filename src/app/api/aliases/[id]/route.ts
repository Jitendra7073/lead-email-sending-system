import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

/**
 * DELETE /api/aliases/[id]
 * Delete an alias
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if alias exists
    const existing = await executeQuery(
      'SELECT * FROM email_aliases WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Alias not found'
      }, { status: 404 });
    }

    // Delete the alias
    await executeQuery('DELETE FROM email_aliases WHERE id = $1', [id]);

    return NextResponse.json({
      success: true,
      message: 'Alias deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting alias:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/aliases/[id]
 * Verify or update an alias
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { is_verified, alias_name, dns_spf_valid, dns_dkim_valid } = body;

    const updates: string[] = [];
    const params_arr: any[] = [];
    let paramIndex = 1;

    if (typeof is_verified === 'boolean') {
      updates.push(`is_verified = $${paramIndex++}`);
      params_arr.push(is_verified);
    }

    if (alias_name !== undefined) {
      updates.push(`alias_name = $${paramIndex++}`);
      params_arr.push(alias_name);
    }

    if (typeof dns_spf_valid === 'boolean') {
      updates.push(`dns_spf_valid = $${paramIndex++}`);
      params_arr.push(dns_spf_valid);
    }

    if (typeof dns_dkim_valid === 'boolean') {
      updates.push(`dns_dkim_valid = $${paramIndex++}`);
      params_arr.push(dns_dkim_valid);
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No updates provided'
      }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    params_arr.push(id);

    const query = `
      UPDATE email_aliases
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await executeQuery(query, params_arr);

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Alias not found'
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result[0] });

  } catch (error: any) {
    console.error('Error updating alias:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/aliases/[id]
 * Get a single alias
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await executeQuery(
      `SELECT
        a.*,
        s.email as sender_email,
        s.name as sender_name,
        s.service as sender_service
      FROM email_aliases a
      LEFT JOIN email_senders s ON a.sender_id = s.id
      WHERE a.id = $1`,
      [id]
    );

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Alias not found'
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result[0] });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
