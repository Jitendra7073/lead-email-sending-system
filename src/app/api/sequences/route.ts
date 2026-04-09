import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

// GET /api/sequences - Fetch all sequences with their template items
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';

    let query = `
      SELECT
        s.*,
        COALESCE(json_agg(
          json_build_object(
            'id', si.id,
            'template_id', si.template_id,
            'template_name', t.name,
            'template_subject', t.subject,
            'position', si.position,
            'delay_days', si.delay_days,
            'delay_hours', si.delay_hours
          ) ORDER BY si.position
        ) FILTER (WHERE si.id IS NOT NULL), '[]'
        ) as items
      FROM email_sequences s
      LEFT JOIN email_sequence_items si ON s.id = si.sequence_id
      LEFT JOIN email_templates t ON si.template_id = t.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (!includeInactive) {
      query += ` AND s.is_active = true`;
    }

    query += ` GROUP BY s.id ORDER BY s.created_at DESC`;

    const sequences = await executeQuery(query, params);

    return NextResponse.json({ success: true, data: sequences });
  } catch (error: any) {
    console.error('Error fetching sequences:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/sequences - Create new sequence
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, is_active } = body;

    // Validate inputs
    if (!name || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Sequence name is required' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO email_sequences (name, description, is_active)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const params = [
      name.trim(),
      description || '',
      is_active !== undefined ? is_active : true
    ];

    const result = await executeQuery(query, params);

    return NextResponse.json({ success: true, data: result[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating sequence:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/sequences - Update sequence
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, description, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Sequence ID is required' },
        { status: 400 }
      );
    }

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Sequence name is required' },
        { status: 400 }
      );
    }

    const query = `
      UPDATE email_sequences
      SET name = $1,
          description = $2,
          is_active = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;

    const params = [
      name.trim(),
      description || '',
      is_active !== undefined ? is_active : true,
      id
    ];

    const result = await executeQuery(query, params);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sequence not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error: any) {
    console.error('Error updating sequence:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/sequences - Delete sequence
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Sequence ID is required' },
        { status: 400 }
      );
    }

    // Check if sequence exists
    const checkQuery = `SELECT id FROM email_sequences WHERE id = $1`;
    const existing = await executeQuery(checkQuery, [id]);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sequence not found' },
        { status: 404 }
      );
    }

    // Delete sequence (cascade will delete sequence items)
    const deleteQuery = `DELETE FROM email_sequences WHERE id = $1 RETURNING *`;
    const result = await executeQuery(deleteQuery, [id]);

    return NextResponse.json({
      success: true,
      message: 'Sequence deleted successfully',
      data: result[0]
    });
  } catch (error: any) {
    console.error('Error deleting sequence:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
