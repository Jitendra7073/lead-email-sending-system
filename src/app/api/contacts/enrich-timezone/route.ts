import { NextResponse } from 'next/server';
import { executeQuery, dbPool } from '@/lib/db/postgres';
import { detectTimezone, batchDetectTimezones } from '@/lib/schedule/timezone-detector';

/**
 * Enrich existing contacts with timezone data
 *
 * POST /api/contacts/enrich-timezone
 *
 * Request body:
 * {
 *   contact_ids?: string[],  // Optional: specific contact IDs to enrich
 *   limit?: number,          // Optional: max contacts to process (default: 100)
 *   dry_run?: boolean        // Optional: simulate without updating (default: false)
 * }
 */
export async function POST(request: Request) {
  const client = await dbPool.connect();

  try {
    const body = await request.json();
    const { contact_ids, limit = 100, dry_run = false } = body;

    await client.query('BEGIN');

    // Fetch contacts to enrich
    let query = `
      SELECT id, value as email, type, timezone, country_code
      FROM contacts
      WHERE type = 'email'
    `;

    const params: any[] = [];

    // Filter by specific IDs if provided
    if (contact_ids && Array.isArray(contact_ids) && contact_ids.length > 0) {
      query += ` AND id = ANY($1)`;
      params.push(contact_ids);
    } else {
      // Only fetch contacts without timezone
      query += ` AND (timezone IS NULL OR timezone = '')`;
    }

    // Apply limit
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await client.query(query, params);
    const contacts = result.rows;

    if (contacts.length === 0) {
      await client.query('COMMIT');
      return NextResponse.json({
        success: true,
        message: 'No contacts found to enrich',
        data: {
          processed: 0,
          updated: 0,
          failed: 0,
          details: []
        }
      });
    }

    console.log(`[ContactEnrichment] Processing ${contacts.length} contacts...`);

    // Batch detect timezones
    const detections = await batchDetectTimezones(
      contacts.map(c => ({
        email: c.email,
        country_code: c.country_code
      }))
    );

    // Process results
    let successCount = 0;
    let failedCount = 0;
    const details: any[] = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const detection = detections[i];

      if (!detection) {
        failedCount++;
        details.push({
          contact_id: contact.id,
          email: contact.email,
          status: 'failed',
          error: 'Timezone detection returned null'
        });
        continue;
      }

      // Prepare detail record
      const detail: any = {
        contact_id: contact.id,
        email: contact.email,
        previous_timezone: contact.timezone,
        new_timezone: detection.timezone,
        previous_country: contact.country_code,
        new_country: detection.country_code,
        detection_method: detection.detection_method,
        confidence: detection.confidence
      };

      // Update contact (unless dry run)
      if (!dry_run) {
        try {
          await client.query(
            `UPDATE contacts
             SET timezone = $1, country_code = $2, updated_at = NOW()
             WHERE id = $3`,
            [detection.timezone, detection.country_code, contact.id]
          );
          detail.status = 'updated';
          successCount++;
        } catch (error: any) {
          detail.status = 'failed';
          detail.error = error.message;
          failedCount++;
        }
      } else {
        detail.status = 'dry_run';
        successCount++;
      }

      details.push(detail);
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Processed ${contacts.length} contacts: ${successCount} updated, ${failedCount} failed`,
      data: {
        processed: contacts.length,
        updated: successCount,
        failed: failedCount,
        dry_run,
        details: details.slice(0, 50) // Return first 50 details
      }
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[ContactEnrichment] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  } finally {
    client.release();
  }
}
