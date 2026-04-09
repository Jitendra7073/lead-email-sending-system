import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET(request: Request) {
  try {
    // Get all groups and count how many templates are in each
    const query = `
      SELECT g.*, 
             COUNT(m.template_id)::INTEGER as template_count
      FROM template_groups g
      LEFT JOIN template_group_mapping m ON g.id = m.group_id
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `;
    
    const groups = await executeQuery(query);
    
    return NextResponse.json({ success: true, data: groups });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, gap_days_1 = 2, gap_days_2 = 5, gap_days_3 = 5 } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Group name is required' }, { status: 400 });
    }

    const query = `
      INSERT INTO template_groups (name, gap_days_1, gap_days_2, gap_days_3)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const params = [name, gap_days_1, gap_days_2, gap_days_3];
    
    const result = await executeQuery(query, params);
    
    return NextResponse.json({ success: true, data: result[0] }, { status: 201 });
  } catch (error: any) {
    // Handle unique constraint violations
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'A template group with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
