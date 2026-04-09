import { NextResponse } from 'next/server';
import { executeQuery, dbPool } from '@/lib/db/postgres';
import { detectTimezone } from '@/lib/schedule/timezone-detector';

/**
 * Import contacts from CSV file
 * Expected CSV format:
 * email,first_name,last_name,phone,linkedin_url,company_name,source_url,country_code
 * or
 * type,value,source_page,site_id
 */
export async function POST(request: Request) {
  const client = await dbPool.connect();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file uploaded'
      }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({
        success: false,
        error: 'File must be a CSV'
      }, { status: 400 });
    }

    // Read file content
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'CSV file is empty or has no data rows'
      }, { status: 400 });
    }

    await client.query('BEGIN');

    // Parse header and detect format
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const dataLines = lines.slice(1);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Determine format based on headers
    const isExtendedFormat = headers.includes('email') && headers.includes('first_name');

    for (let i = 0; i < dataLines.length; i++) {
      try {
        const values = parseCSVLine(dataLines[i]);

        if (values.length === 0) continue;

        let contactData: any = {};

        if (isExtendedFormat) {
          // Extended format: email,first_name,last_name,phone,linkedin_url,company_name,source_url,country_code
          const fieldMap: { [key: string]: number } = {};
          headers.forEach((h, idx) => { fieldMap[h] = idx; });

          // Extract email if present
          if (fieldMap.email !== undefined && values[fieldMap.email]) {
            contactData.type = 'email';
            contactData.value = values[fieldMap.email].trim();
          }

          // Extract phone if present
          if (fieldMap.phone !== undefined && values[fieldMap.phone]) {
            contactData.phone = values[fieldMap.phone].trim();
          }

          // Extract LinkedIn if present
          if (fieldMap.linkedin_url !== undefined && values[fieldMap.linkedin_url]) {
            contactData.linkedin = values[fieldMap.linkedin_url].trim();
          }

          contactData.source_page = fieldMap.source_url !== undefined
            ? values[fieldMap.source_url]?.trim()
            : null;

          contactData.site_id = fieldMap.site_id !== undefined
            ? parseInt(values[fieldMap.site_id]) || null
            : null;

          // Extract country code if present
          if (fieldMap.country_code !== undefined && values[fieldMap.country_code]) {
            contactData.country_code = values[fieldMap.country_code].trim();
          }

          // Skip if no contact info
          if (!contactData.value && !contactData.phone && !contactData.linkedin) {
            errors.push(`Row ${i + 2}: No contact information found`);
            errorCount++;
            continue;
          }

        } else {
          // Simple format: type,value,source_page,site_id
          contactData.type = values[0]?.trim() || 'email';
          contactData.value = values[1]?.trim();
          contactData.source_page = values[2]?.trim() || null;
          contactData.site_id = values[3] ? parseInt(values[3]) : null;
        }

        // Validate required fields
        if (!contactData.type || !contactData.value) {
          errors.push(`Row ${i + 2}: Missing required fields (type, value)`);
          errorCount++;
          continue;
        }

        // Validate type
        if (!['email', 'phone', 'linkedin'].includes(contactData.type)) {
          errors.push(`Row ${i + 2}: Invalid type '${contactData.type}'`);
          errorCount++;
          continue;
        }

        // Detect timezone for email contacts
        if (contactData.type === 'email' && !contactData.timezone) {
          try {
            const detection = await detectTimezone(
              contactData.value,
              contactData.source_page,
              contactData.country_code
            );

            if (detection) {
              contactData.timezone = detection.timezone;
              contactData.country_code = detection.country_code;
            }
          } catch (error) {
            console.warn(`[ContactImport] Failed to detect timezone for ${contactData.value}:`, error);
          }
        }

        // Insert contact (handle duplicates)
        const insertQuery = `
          INSERT INTO contacts (type, value, site_id, source_page, timezone, country_code)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (value, type) DO UPDATE SET
            source_page = EXCLUDED.source_page,
            timezone = COALESCE(EXCLUDED.timezone, contacts.timezone),
            country_code = COALESCE(EXCLUDED.country_code, contacts.country_code),
            updated_at = NOW()
          RETURNING id
        `;

        await client.query(insertQuery, [
          contactData.type,
          contactData.value,
          contactData.site_id,
          contactData.source_page,
          contactData.timezone || null,
          contactData.country_code || null
        ]);

        // If extended format with phone, insert phone contact
        if (isExtendedFormat && contactData.phone) {
          await client.query(insertQuery, [
            'phone',
            contactData.phone,
            contactData.site_id,
            contactData.source_page
          ]);
          successCount++;
        }

        // If extended format with linkedin, insert linkedin contact
        if (isExtendedFormat && contactData.linkedin) {
          await client.query(insertQuery, [
            'linkedin',
            contactData.linkedin,
            contactData.site_id,
            contactData.source_page
          ]);
          successCount++;
        }

        successCount++;

      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
        errorCount++;
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      data: {
        total: dataLines.length,
        imported: successCount,
        failed: errorCount,
        errors: errors.slice(0, 10) // Return first 10 errors
      }
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * Parse CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current) {
    result.push(current.trim());
  }

  return result;
}
