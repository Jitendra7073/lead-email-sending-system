import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await executeQuery('SELECT * FROM email_senders WHERE id = $1', [id]);
    if (result.length === 0) return NextResponse.json({ success: false, error: 'Sender not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const allowedFields = ['name', 'email', 'app_password', 'is_active', 'daily_limit', 'service', 'smtp_host', 'smtp_port', 'smtp_user'];
    const fieldsToUpdate = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fieldsToUpdate.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields provided for update' }, { status: 400 });
    }

    fieldsToUpdate.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE email_senders SET ${fieldsToUpdate.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await executeQuery(query, values);

    if (result.length === 0) return NextResponse.json({ success: false, error: 'Sender not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: result[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await executeQuery('DELETE FROM email_senders WHERE id = $1 RETURNING id', [id]);
    if (result.length === 0) return NextResponse.json({ success: false, error: 'Sender not found' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Sender successfully removed' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
