import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const query = `
      UPDATE email_senders
      SET is_active = NOT is_active,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;

    const result = await executeQuery(query, [id]);

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Sender not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result[0],
      meta: {
        message: `Sender ${result[0].is_active ? 'activated' : 'deactivated'} successfully`
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
