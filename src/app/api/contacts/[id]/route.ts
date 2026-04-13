import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const query = `
      SELECT c.*, s.url as site_url, s.country, s.is_wordpress
      FROM contacts c
      LEFT JOIN sites s ON c.site_id = s.id
      WHERE c.id = $1
    `;
    const result = await executeQuery(query, [id]);

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Contact not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result[0]
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const allowedFields = ['type', 'value', 'site_id', 'source_page'];
    const fieldsToUpdate = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        fieldsToUpdate.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid fields provided for update'
      }, { status: 400 });
    }

    fieldsToUpdate.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE contacts
      SET ${fieldsToUpdate.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    const result = await executeQuery(query, values);

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Contact not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result[0]
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Delete dependent records first to satisfy foreign key constraints
    const query = `
      WITH deleted_logs AS (
        DELETE FROM email_send_log WHERE contact_id = $1
      ),
      deleted_queue AS (
        DELETE FROM email_queue WHERE contact_id = $1
      )
      DELETE FROM contacts WHERE id = $1 RETURNING id;
    `;
    const result = await executeQuery(query, [id]);

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Contact not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Contact successfully deleted'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
