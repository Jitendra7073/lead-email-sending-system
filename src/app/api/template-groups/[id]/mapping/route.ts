import { NextResponse } from 'next/server';
import { executeQuery, dbPool } from '@/lib/db/postgres';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;
  
  try {
    const body = await request.json();
    const { template_ids } = body;

    // We expect template_ids to be an ordered array of UUIDs. The array index determines the sequence position.
    if (!Array.isArray(template_ids)) {
      return NextResponse.json({ success: false, error: 'template_ids must be an array of UUIDs' }, { status: 400 });
    }

    // Utilize a transaction to safely overwrite the mappings
    const client = await dbPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. Delete all existing mappings for this group
      await client.query('DELETE FROM template_group_mapping WHERE group_id = $1', [groupId]);
      
      // 2. Insert new mappings according to the array order (position = index + 1)
      if (template_ids.length > 0) {
        const values: (string | number)[] = [];
        const placeholders: string[] = [];
        
        template_ids.forEach((templateId, index) => {
          const position = index + 1;
          const paramOffset = index * 3;
          
          values.push(groupId, templateId, position);
          placeholders.push(`($${paramOffset + 1}, $${paramOffset + 2}, $${paramOffset + 3})`);
        });
        
        const insertQuery = `
          INSERT INTO template_group_mapping (group_id, template_id, position)
          VALUES ${placeholders.join(', ')}
        `;
        
        await client.query(insertQuery, values);
      }
      
      await client.query('COMMIT');
      
      return NextResponse.json({ 
        success: true, 
        message: 'Template mappings successfully synchronized',
        mapped_count: template_ids.length 
      });
      
    } catch (dbError: any) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
    
  } catch (error: any) {
    if (error.code === '23503') {
      return NextResponse.json({ success: false, error: 'One or more template UUIDs do not exist' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
