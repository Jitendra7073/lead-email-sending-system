import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let query = `
      SELECT t.*,
             COALESCE(
               json_agg(
                 json_build_object('group_id', g.id, 'group_name', g.name, 'position', m.position)
               ) FILTER (WHERE g.id IS NOT NULL), '[]'
             ) as groups
      FROM email_templates t
      LEFT JOIN template_group_mapping m ON t.id = m.template_id
      LEFT JOIN template_groups g ON m.group_id = g.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`t.category = $${paramIndex++}`);
      params.push(category);
    }

    if (search) {
      conditions.push(`(t.name ILIKE $${paramIndex++} OR t.subject ILIKE $${paramIndex++})`);
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` GROUP BY t.id ORDER BY t.created_at DESC`;

    const templates = await executeQuery(query, params);

    return NextResponse.json({ success: true, data: templates });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, subject, html_content, text_content, description, category, tags } = body;

    // Validate inputs
    if (!name || !subject || !html_content) {
      return NextResponse.json({ success: false, error: 'Name, subject, and html_content are required' }, { status: 400 });
    }

    const query = `
      INSERT INTO email_templates (name, subject, html_content, text_content, description, category, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const params = [
      name, subject, html_content, 
      text_content || '', 
      description || '', 
      category || 'general', 
      tags || ''
    ];
    
    const result = await executeQuery(query, params);
    
    return NextResponse.json({ success: true, data: result[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
