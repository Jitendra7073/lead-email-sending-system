import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Fetch group details
    const groupQuery = `SELECT * FROM template_groups WHERE id = $1`;
    const groupResult = await executeQuery(groupQuery, [id]);
    
    if (groupResult.length === 0) {
      return NextResponse.json({ success: false, error: 'Template group not found' }, { status: 404 });
    }
    
    const group = groupResult[0];

    // Fetch mapped templates ordered by their absolute position within the group
    const templatesQuery = `
      SELECT m.position, t.id, t.name, t.subject, t.category, t.is_active
      FROM template_group_mapping m
      JOIN email_templates t ON m.template_id = t.id
      WHERE m.group_id = $1
      ORDER BY m.position ASC
    `;
    
    const templates = await executeQuery(templatesQuery, [id]);
    group.templates = templates;
    
    return NextResponse.json({ success: true, data: group });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const allowedFields = ['name', 'gap_days_1', 'gap_days_2', 'gap_days_3'];
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

    const query = `
      UPDATE template_groups
      SET ${fieldsToUpdate.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await executeQuery(query, values);
    
    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'Template group not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: result[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const query = `
      DELETE FROM template_groups
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await executeQuery(query, [id]);
    
    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'Template group not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, message: 'Template group deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
