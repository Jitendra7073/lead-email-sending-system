import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const country_code = searchParams.get('country_code');

    let query = `
      SELECT
        country_code,
        country_name,
        default_timezone,
        business_hours_start,
        business_hours_end,
        weekend_days
      FROM country_timezones
    `;

    const params: any[] = [];

    // Filter by country code if provided
    if (country_code) {
      query += ` WHERE country_code = $1`;
      params.push(country_code.toUpperCase());
    }

    query += ` ORDER BY country_name ASC`;

    const result = await executeQuery(query, params);

    // Transform weekend_days array to a more readable format
    const transformed = result.map((row: any) => ({
      ...row,
      weekend_days: row.weekend_days || [],
      business_hours: {
        start: row.business_hours_start,
        end: row.business_hours_end
      }
    }));

    return NextResponse.json({
      success: true,
      data: transformed,
      count: transformed.length
    });
  } catch (error: any) {
    console.error('Error fetching timezones:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
