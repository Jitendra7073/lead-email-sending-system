import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

/**
 * GET /api/timezones
 *
 * Query parameters:
 * - search: Search by country name or code
 * - country_code: Get specific timezone by country code
 * - limit: Limit results (default: all)
 *
 * Returns list of available timezones with business hours and weekend patterns
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const country_code = searchParams.get('country_code');
    const limit = searchParams.get('limit');

    let query = `
      SELECT
        country_code,
        country_name,
        default_timezone,
        business_hours_start,
        business_hours_end,
        weekend_days,
        utc_offset,
        dst_observed
      FROM country_timezones
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Search by country name or code
    if (search) {
      query += ` AND (country_name ILIKE $${paramIndex++} OR country_code ILIKE $${paramIndex++})`;
      params.push(`%${search}%`, `%${search}%`);
    }

    // Filter by specific country code
    if (country_code) {
      query += ` AND country_code = $${paramIndex++}`;
      params.push(country_code.toUpperCase());
    }

    // Order by country name
    query += ` ORDER BY country_name ASC`;

    // Apply limit if specified
    if (limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(parseInt(limit));
    }

    const result = await executeQuery(query, params);

    // Enrich with additional metadata
    const enrichedData = result.map((row: any) => ({
      ...row,
      weekend_days: row.weekend_days || ['Saturday', 'Sunday'],
      business_hours: {
        start: row.business_hours_start || '09:00',
        end: row.business_hours_end || '17:00'
      },
      timezone_info: {
        iana_timezone: row.default_timezone,
        utc_offset: row.utc_offset || null,
        observes_dst: row.dst_observed || false
      }
    }));

    return NextResponse.json({
      success: true,
      data: enrichedData,
      meta: {
        total: enrichedData.length,
        query: {
          search,
          country_code,
          limit
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching timezones:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/timezones
 *
 * Create or update country timezone configuration
 * (Admin only - should add authentication middleware)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      country_code,
      country_name,
      default_timezone,
      business_hours_start = '09:00',
      business_hours_end = '17:00',
      weekend_days = ['Saturday', 'Sunday'],
      utc_offset,
      dst_observed = false
    } = body;

    // Validation
    if (!country_code || !country_name || !default_timezone) {
      return NextResponse.json({
        success: false,
        error: 'country_code, country_name, and default_timezone are required'
      }, { status: 400 });
    }

    // Validate timezone format
    try {
      Intl.DateTimeFormat(undefined, { timeZone: default_timezone });
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid IANA timezone format'
      }, { status: 400 });
    }

    // Check if country already exists
    const existingCheck = await executeQuery(
      'SELECT country_code FROM country_timezones WHERE country_code = $1',
      [country_code.toUpperCase()]
    );

    let result;

    if (existingCheck.length > 0) {
      // Update existing
      const updateQuery = `
        UPDATE country_timezones
        SET
          country_name = $2,
          default_timezone = $3,
          business_hours_start = $4,
          business_hours_end = $5,
          weekend_days = $6,
          utc_offset = $7,
          dst_observed = $8,
          updated_at = CURRENT_TIMESTAMP
        WHERE country_code = $1
        RETURNING *
      `;
      result = await executeQuery(updateQuery, [
        country_code.toUpperCase(),
        country_name,
        default_timezone,
        business_hours_start,
        business_hours_end,
        JSON.stringify(weekend_days),
        utc_offset,
        dst_observed
      ]);
    } else {
      // Insert new
      const insertQuery = `
        INSERT INTO country_timezones (
          country_code, country_name, default_timezone,
          business_hours_start, business_hours_end,
          weekend_days, utc_offset, dst_observed
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      result = await executeQuery(insertQuery, [
        country_code.toUpperCase(),
        country_name,
        default_timezone,
        business_hours_start,
        business_hours_end,
        JSON.stringify(weekend_days),
        utc_offset,
        dst_observed
      ]);
    }

    return NextResponse.json({
      success: true,
      data: result[0]
    }, { status: existingCheck.length > 0 ? 200 : 201 });
  } catch (error: any) {
    console.error('Error creating/updating timezone:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
