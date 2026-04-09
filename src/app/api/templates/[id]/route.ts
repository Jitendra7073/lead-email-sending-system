import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const query = `
      SELECT t.*, 
             COALESCE(
               json_agg(
                 json_build_object('group_id', g.id, 'group_name', g.name, 'position', m.position)
               ) FILTER (WHERE g.id IS NOT NULL), '[]'
             ) as groups
      FROM email_templates t
      LEFT JOIN template_group_mapping m ON t.id = m.template_id
      LEFT JOIN template_groups g ON m.group_id = g.id
      WHERE t.id = $1
      GROUP BY t.id
    `;
    
    const result = await executeQuery(query, [id]);
    
    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
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
    
    // Safety check to only allow specific fields
    const allowedFields = ['name', 'subject', 'html_content', 'text_content', 'description', 'category', 'tags', 'is_active'];
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
      return NextResponse.json({ success: false, error: 'No valid fields provided for update' }, { status: 400 });
    }

    fieldsToUpdate.push(`updated_at = NOW()`);
    values.push(id); // Where condition

    const query = `
      UPDATE email_templates
      SET ${fieldsToUpdate.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await executeQuery(query, values);
    
    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
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
      DELETE FROM email_templates
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await executeQuery(query, [id]);
    
    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, message: 'Template deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
