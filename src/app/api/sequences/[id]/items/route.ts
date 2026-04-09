import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

// GET /api/sequences/[id]/items - Get items in a sequence
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const query = `
      SELECT
        si.*,
        t.name as template_name,
        t.subject as template_subject,
        t.category as template_category
      FROM email_sequence_items si
      LEFT JOIN email_templates t ON si.template_id = t.id
      WHERE si.sequence_id = $1
      ORDER BY si.position ASC
    `;

    const items = await executeQuery(query, [id]);

    return NextResponse.json({ success: true, data: items });
  } catch (error: any) {
    console.error('Error fetching sequence items:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/sequences/[id]/items - Add item to sequence
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { template_id, delay_days, send_time } = body;

    // Validate inputs
    if (!template_id) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Check if sequence exists
    const sequenceCheck = await executeQuery(
      'SELECT id FROM email_sequences WHERE id = $1',
      [id]
    );

    if (sequenceCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sequence not found' },
        { status: 404 }
      );
    }

    // Check if template exists
    const templateCheck = await executeQuery(
      'SELECT id FROM email_templates WHERE id = $1',
      [template_id]
    );

    if (templateCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Check if template already exists in this sequence
    const duplicateCheck = await executeQuery(
      'SELECT id FROM email_sequence_items WHERE sequence_id = $1 AND template_id = $2',
      [id, template_id]
    );

    if (duplicateCheck.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Template already exists in this sequence' },
        { status: 400 }
      );
    }

    // Get the next position
    const positionQuery = `
      SELECT COALESCE(MAX(position), 0) + 1 as next_position
      FROM email_sequence_items
      WHERE sequence_id = $1
    `;
    const positionResult = await executeQuery(positionQuery, [id]);
    const nextPosition = positionResult[0].next_position;

    // Insert the new item
    const insertQuery = `
      INSERT INTO email_sequence_items (sequence_id, template_id, position, delay_days, send_time)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const queryParams = [
      id,
      template_id,
      nextPosition,
      delay_days || 0,
      send_time || '09:00'
    ];

    const result = await executeQuery(insertQuery, queryParams);

    return NextResponse.json({ success: true, data: result[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding sequence item:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/sequences/[id]/items - Update item (position, delay)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { item_id, position, delay_days, send_time } = body;

    if (!item_id) {
      return NextResponse.json(
        { success: false, error: 'Item ID is required' },
        { status: 400 }
      );
    }

    // Check if item belongs to this sequence
    const checkQuery = `
      SELECT id FROM email_sequence_items
      WHERE id = $1 AND sequence_id = $2
    `;
    const existing = await executeQuery(checkQuery, [item_id, id]);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sequence item not found' },
        { status: 404 }
      );
    }

    // If position is being updated, we need to reorder other items
    if (position !== undefined) {
      await executeQuery(
        'BEGIN'
      );

      try {
        // Get current position
        const currentQuery = `
          SELECT position FROM email_sequence_items WHERE id = $1
        `;
        const currentResult = await executeQuery(currentQuery, [item_id]);
        const currentPosition = currentResult[0].position;

        if (currentPosition !== position) {
          // Step 1: Move the item to a temporary position to avoid conflicts
          await executeQuery(`
            UPDATE email_sequence_items
            SET position = -1
            WHERE id = $1
          `, [item_id]);

          // Step 2: Shift items between old and new position
          if (currentPosition < position) {
            // Moving down: decrement items in (currentPosition, position]
            await executeQuery(`
              UPDATE email_sequence_items
              SET position = position - 1
              WHERE sequence_id = $1
                AND position > $2
                AND position <= $3
            `, [id, currentPosition, position]);
          } else {
            // Moving up: increment items in [position, currentPosition)
            await executeQuery(`
              UPDATE email_sequence_items
              SET position = position + 1
              WHERE sequence_id = $1
                AND position >= $2
                AND position < $3
            `, [id, position, currentPosition]);
          }

          // Step 3: Update the item's position to final position
          await executeQuery(`
            UPDATE email_sequence_items
            SET position = $1
            WHERE id = $2
          `, [position, item_id]);
        }

        // Update delay values
        await executeQuery(`
          UPDATE email_sequence_items
          SET delay_days = COALESCE($1, delay_days),
              send_time = COALESCE($2, send_time),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [delay_days, send_time, item_id]);

        await executeQuery('COMMIT');

        // Fetch updated item
        const result = await executeQuery(`
          SELECT
            si.*,
            t.name as template_name,
            t.subject as template_subject
          FROM email_sequence_items si
          LEFT JOIN email_templates t ON si.template_id = t.id
          WHERE si.id = $1
        `, [item_id]);

        return NextResponse.json({ success: true, data: result[0] });
      } catch (error) {
        await executeQuery('ROLLBACK');
        throw error;
      }
    } else {
      // Only updating delay values
      const query = `
        UPDATE email_sequence_items
        SET delay_days = COALESCE($1, delay_days),
            send_time = COALESCE($2, send_time),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND sequence_id = $4
        RETURNING *
      `;

      const queryParams = [delay_days, send_time, item_id, id];
      const result = await executeQuery(query, queryParams);

      return NextResponse.json({ success: true, data: result[0] });
    }
  } catch (error: any) {
    console.error('Error updating sequence item:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/sequences/[id]/items - Remove item from sequence
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('item_id');

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'Item ID is required' },
        { status: 400 }
      );
    }

    // Get the position of the item being deleted
    const positionQuery = `
      SELECT position FROM email_sequence_items
      WHERE id = $1 AND sequence_id = $2
    `;
    const positionResult = await executeQuery(positionQuery, [itemId, id]);

    if (positionResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sequence item not found' },
        { status: 404 }
      );
    }

    const deletedPosition = positionResult[0].position;

    // Delete the item
    const deleteQuery = `
      DELETE FROM email_sequence_items
      WHERE id = $1 AND sequence_id = $2
      RETURNING *
    `;
    const result = await executeQuery(deleteQuery, [itemId, id]);

    // Reorder remaining items
    await executeQuery(`
      UPDATE email_sequence_items
      SET position = position - 1
      WHERE sequence_id = $1 AND position > $2
    `, [id, deletedPosition]);

    return NextResponse.json({
      success: true,
      message: 'Item removed from sequence successfully',
      data: result[0]
    });
  } catch (error: any) {
    console.error('Error deleting sequence item:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
