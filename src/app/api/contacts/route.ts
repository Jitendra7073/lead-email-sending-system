import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { detectTimezone, getTimezoneConfidence } from '@/lib/schedule/timezone-detector';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const type = searchParams.get('type'); // email, phone, linkedin
    const country_code = searchParams.get('country_code');
    const timezone = searchParams.get('timezone');
    const site_id = searchParams.get('site_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Build query with filters
    let query = `
      SELECT DISTINCT ON (c.id)
        c.*,
        s.url as site_url,
        s.country,
        s.is_wordpress,
        s.timezone as detected_timezone,
        ev.status as verification_status,
        ev.reason as verification_reason,
        ev.checked_at as verification_checked_at,
        ev.details->>'overall_score' as overall_score
      FROM contacts c
      LEFT JOIN sites s ON c.site_id = s.id
      LEFT JOIN contact_email_verifications cev ON c.id = cev.contact_id
      LEFT JOIN email_verifications ev ON cev.email_verification_id = ev.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Search filter (search in value, source_page)
    if (search) {
      query += ` AND (c.value ILIKE $${paramIndex++} OR c.source_page ILIKE $${paramIndex++})`;
      params.push(`%${search}%`, `%${search}%`);
    }

    // Type filter
    if (type && ['email', 'phone', 'linkedin'].includes(type)) {
      query += ` AND c.type = $${paramIndex++}`;
      params.push(type);
    }

    // Country code filter (via sites table)
    if (country_code) {
      query += ` AND s.country = $${paramIndex++}`;
      params.push(country_code);
    }

    // Timezone filter (exact match or partial)
    if (timezone) {
      query += ` AND (s.timezone ILIKE $${paramIndex} OR c.timezone ILIKE $${paramIndex})`;
      params.push(`%${timezone}%`);
      paramIndex++;
    }

    // Site ID filter
    if (site_id) {
      query += ` AND c.site_id = $${paramIndex++}`;
      params.push(site_id);
    }

    // Get total count for pagination
    const countQuery = query.replace(
      /SELECT c\.\*, s\.url as site_url, s\.country, s\.is_wordpress, s\.timezone as detected_timezone/,
      'SELECT COUNT(*) as total'
    );
    const countData = await executeQuery(countQuery, params);
    const total = parseInt(countData[0]?.total || '0');

    // Add ordering and pagination
    // Note: DISTINCT ON requires ORDER BY to include the DISTINCT column
    query += ` ORDER BY c.id, c.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const data = await executeQuery(query, params);

    // Get overall stats for all contact types
    const statsQuery = `
      SELECT
        type,
        COUNT(*) as count
      FROM contacts
      GROUP BY type
    `;
    const statsData = await executeQuery(statsQuery, []);
    const stats = {
      email: 0,
      phone: 0,
      linkedin: 0,
      total: 0
    };
    statsData.forEach((row: any) => {
      const contactType = row.type as 'email' | 'phone' | 'linkedin';
      if (contactType in stats) {
        stats[contactType] = parseInt(row.count);
        stats.total += parseInt(row.count);
      }
    });

    // Enrich results with timezone confidence scores and verification status
    const enrichedData = data.map((contact: any) => {
      const tz = contact.timezone || contact.detected_timezone;
      return {
        ...contact,
        timezone_confidence: tz ? getTimezoneConfidence(tz, contact.country) : null,
        verification_status: contact.verification_status || null,
        verification_reason: contact.verification_reason || null,
        verification_checked_at: contact.verification_checked_at || null
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      stats
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      type,
      value,
      site_id,
      source_page,
      country_code,
      timezone
    } = body;

    // Validation
    if (!type || !value) {
      return NextResponse.json({
        success: false,
        error: 'Type and value are required fields'
      }, { status: 400 });
    }

    if (!['email', 'phone', 'linkedin'].includes(type)) {
      return NextResponse.json({
        success: false,
        error: 'Type must be one of: email, phone, linkedin'
      }, { status: 400 });
    }

    // Check if contact already exists
    const existingCheck = await executeQuery(
      'SELECT id FROM contacts WHERE value = $1 AND type = $2',
      [value, type]
    );

    if (existingCheck.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Contact with this value and type already exists',
        data: existingCheck[0]
      }, { status: 409 });
    }

    // Auto-detect timezone if not provided
    let detectedTimezone = timezone;
    let detectionConfidence = null;
    let detectionSource = 'provided';

    if (!detectedTimezone && country_code) {
      const detection = await detectTimezone(country_code);
      detectedTimezone = detection?.timezone;
      detectionConfidence = detection?.confidence;
      detectionSource = 'auto-detected';
    } else if (detectedTimezone) {
      detectionConfidence = getTimezoneConfidence(detectedTimezone, country_code);
    }

    // Insert new contact with timezone data
    const query = `
      INSERT INTO contacts (type, value, site_id, source_page, country_code, timezone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const params = [
      type,
      value,
      site_id || null,
      source_page || null,
      country_code || null,
      detectedTimezone || null
    ];

    const result = await executeQuery(query, params);

    // Enrich response with detection metadata
    const response = {
      ...result[0],
      timezone_detection: {
        timezone: detectedTimezone,
        confidence: detectionConfidence,
        source: detectionSource
      }
    };

    return NextResponse.json({
      success: true,
      data: response
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
