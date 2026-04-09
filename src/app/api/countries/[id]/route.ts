import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

/**
 * GET /api/countries/[id]
 *
 * Get a specific country by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const countryId = parseInt(id);
    if (isNaN(countryId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid country ID'
      }, { status: 400 });
    }

    const query = `
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
      WHERE id = $1
    `;

    const result = await executeQuery(query, [countryId]);

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Country not found'
      }, { status: 404 });
    }

    const row = result[0];
    const country = {
      ...row,
      weekend_days: (typeof row.weekend_days === 'string'
        ? row.weekend_days.split(',').map((d: string) => d.trim()).filter((d: string) => d.length > 0)
        : (Array.isArray(row.weekend_days) ? row.weekend_days.filter((d: string) => d && d.trim().length > 0) : ['Saturday', 'Sunday'])
      ),
      business_hours: {
        start: row.business_hours_start || '09:00',
        end: row.business_hours_end || '17:00'
      }
    };

    return NextResponse.json({
      success: true,
      data: country
    });
  } catch (error: any) {
    console.error('Error fetching country:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * PUT /api/countries/[id]
 *
 * Update a country's configuration
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const countryId = parseInt(id);
    if (isNaN(countryId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid country ID'
      }, { status: 400 });
    }

    const body = await request.json();
    const {
      country_name,
      default_timezone,
      business_hours_start,
      business_hours_end,
      weekend_days,
      region,
      utc_offset,
      dst_observed,
      is_active
    } = body;

    // Validate timezone format if provided
    if (default_timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: default_timezone });
      } catch {
        return NextResponse.json({
          success: false,
          error: 'Invalid IANA timezone format'
        }, { status: 400 });
      }
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (country_name !== undefined) {
      updates.push(`country_name = $${paramIndex++}`);
      values.push(country_name);
    }
    if (default_timezone !== undefined) {
      updates.push(`default_timezone = $${paramIndex++}`);
      values.push(default_timezone);
    }
    if (business_hours_start !== undefined) {
      updates.push(`business_hours_start = $${paramIndex++}`);
      values.push(business_hours_start);
    }
    if (business_hours_end !== undefined) {
      updates.push(`business_hours_end = $${paramIndex++}`);
      values.push(business_hours_end);
    }
    if (weekend_days !== undefined) {
      updates.push(`weekend_days = $${paramIndex++}`);
      values.push(Array.isArray(weekend_days) ? weekend_days.join(',') : weekend_days);
    }
    if (region !== undefined) {
      updates.push(`region = $${paramIndex++}`);
      values.push(region || null);
    }
    if (utc_offset !== undefined) {
      updates.push(`utc_offset = $${paramIndex++}`);
      values.push(utc_offset);
    }
    if (dst_observed !== undefined) {
      updates.push(`dst_observed = $${paramIndex++}`);
      values.push(dst_observed);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No fields to update'
      }, { status: 400 });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(countryId);

    const query = `
      UPDATE country_timezones
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await executeQuery(query, values);

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Country not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'Country updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating country:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * DELETE /api/countries/[id]
 *
 * Delete a country
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const countryId = parseInt(id);
    if (isNaN(countryId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid country ID'
      }, { status: 400 });
    }

    const query = 'DELETE FROM country_timezones WHERE id = $1 RETURNING *';
    const result = await executeQuery(query, [countryId]);

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Country not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'Country deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting country:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
