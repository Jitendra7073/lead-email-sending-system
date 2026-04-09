import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { calculateOptimalSchedule, isValidTimezone } from '@/lib/schedule/timezone-calculator';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      recipient_country,
      recipient_timezone,
      base_time,
      gap_days = 0,
      gap_hours = 0,
      gap_minutes = 0,
      send_time = '10:00'
    } = body;

    // Validate required fields
    if (!recipient_country) {
      return NextResponse.json(
        { success: false, error: 'recipient_country is required' },
        { status: 400 }
      );
    }

    if (!base_time) {
      return NextResponse.json(
        { success: false, error: 'base_time is required' },
        { status: 400 }
      );
    }

    // Validate ISO date format
    const baseDate = new Date(base_time);
    if (isNaN(baseDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'base_time must be a valid ISO 8601 date string' },
        { status: 400 }
      );
    }

    // Validate timezone if provided
    if (recipient_timezone && !isValidTimezone(recipient_timezone)) {
      return NextResponse.json(
        { success: false, error: `Invalid timezone: ${recipient_timezone}` },
        { status: 400 }
      );
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (send_time && !timeRegex.test(send_time)) {
      return NextResponse.json(
        { success: false, error: 'send_time must be in HH:mm format (24-hour)' },
        { status: 400 }
      );
    }

    // Validate gap values
    if (gap_days < 0 || gap_hours < 0 || gap_minutes < 0) {
      return NextResponse.json(
        { success: false, error: 'gap values cannot be negative' },
        { status: 400 }
      );
    }

    // Try to get country-specific data from database
    let countryInfo = null;
    try {
      const query = `
        SELECT *
        FROM country_timezones
        WHERE country_code = $1
      `;
      const result = await executeQuery(query, [recipient_country.toUpperCase()]);

      if (result.length > 0) {
        countryInfo = result[0];
      }
    } catch (dbError) {
      console.warn('Could not fetch country timezone data from database:', dbError);
      // Continue with default timezone calculator behavior
    }

    // Calculate schedule using the timezone calculator
    const calculationResult = await calculateOptimalSchedule({
      recipient_country,
      recipient_timezone: countryInfo?.default_timezone || recipient_timezone,
      base_time,
      gap_days,
      gap_hours,
      gap_minutes,
      send_time
    });

    // If we have database data, override country info with more accurate data
    if (countryInfo) {
      calculationResult.country_info = {
        country_code: countryInfo.country_code,
        country_name: countryInfo.country_name,
        timezone: recipient_timezone || countryInfo.default_timezone,
        business_hours_start: countryInfo.business_hours_start,
        business_hours_end: countryInfo.business_hours_end,
        weekend_days: countryInfo.weekend_days
      };
    }

    return NextResponse.json({
      success: true,
      data: calculationResult
    });
  } catch (error: any) {
    console.error('Error calculating schedule:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
