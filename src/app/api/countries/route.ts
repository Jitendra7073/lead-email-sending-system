import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

/**
 * GET /api/countries
 *
 * Query parameters:
 * - search: Search by country name or code
 * - limit: Limit results (default: all)
 *
 * Returns list of countries with timezone configuration
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');

    let query = `
      SELECT
        id,
        country_code,
        country_name,
        default_timezone,
        business_hours_start,
        business_hours_end,
        weekend_days,
        region,
        utc_offset,
        dst_observed,
        is_active,
        created_at,
        updated_at
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

    // Order by country name
    query += ` ORDER BY country_name ASC`;

    // Apply limit if specified
    if (limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(parseInt(limit));
    }

    const result = await executeQuery(query, params);

    // Parse weekend_days from string or JSON
    const enrichedData = result.map((row: any) => ({
      ...row,
      weekend_days: (typeof row.weekend_days === 'string'
        ? row.weekend_days.split(',').map((d: string) => d.trim()).filter((d: string) => d.length > 0)
        : (Array.isArray(row.weekend_days) ? row.weekend_days.filter((d: string) => d && d.trim().length > 0) : ['Saturday', 'Sunday'])
      ),
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
        query: { search, limit }
      }
    });
  } catch (error: any) {
    console.error('Error fetching countries:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/countries
 *
 * Create a new country timezone configuration
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
      region,
      utc_offset,
      dst_observed = false,
      is_active = true
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
      'SELECT id, country_code FROM country_timezones WHERE country_code = $1',
      [country_code.toUpperCase()]
    );

    if (existingCheck.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Country with code "${country_code}" already exists. Use PUT to update.`
      }, { status: 409 });
    }

    // Insert new country
    const insertQuery = `
      INSERT INTO country_timezones (
        country_code, country_name, default_timezone,
        business_hours_start, business_hours_end,
        weekend_days, region, utc_offset, dst_observed, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const result = await executeQuery(insertQuery, [
      country_code.toUpperCase(),
      country_name,
      default_timezone,
      business_hours_start,
      business_hours_end,
      Array.isArray(weekend_days) ? weekend_days.join(',') : weekend_days,
      region || null,
      utc_offset,
      dst_observed,
      is_active
    ]);

    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'Country created successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating country:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
