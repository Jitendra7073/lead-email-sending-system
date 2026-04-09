import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { calculateOptimalSchedule } from '@/lib/schedule/timezone-calculator';

/**
 * POST /api/schedule/preview
 *
 * Preview email schedule before creating campaign
 * Shows complete schedule with timezone adjustments for each contact
 *
 * Body:
 * {
 *   template_group_id: number,
 *   contact_ids: number[],
 *   start_date: string (ISO date)
 * }
 *
 * Returns:
 * - Complete schedule with adjustments shown
 * - Per-contact breakdown
 * - Adjustment reasons
 * - Statistics
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      template_group_id,
      contact_ids,
      start_date
    } = body;

    // Validation
    if (!template_group_id || !contact_ids || !start_date) {
      return NextResponse.json({
        success: false,
        error: 'template_group_id, contact_ids, and start_date are required'
      }, { status: 400 });
    }

    if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'contact_ids must be a non-empty array'
      }, { status: 400 });
    }

    // Validate start_date format
    try {
      new Date(start_date);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid start_date format. Use ISO date string (e.g., 2026-04-07)'
      }, { status: 400 });
    }

    // Get template group details
    const templateQuery = `
      SELECT
        tg.id,
        tg.name,
        tg.gap_days,
        tg.gap_hours,
        tg.gap_minutes,
        tg.send_time,
        json_agg(
          json_build_object(
            'id', t.id,
            'name', t.name,
            'template_order', t.template_order
          ) ORDER BY t.template_order
        ) as templates
      FROM template_groups tg
      LEFT JOIN templates t ON t.group_id = tg.id
      WHERE tg.id = $1
      GROUP BY tg.id
    `;

    const templateResult = await executeQuery(templateQuery, [template_group_id]);

    if (templateResult.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Template group not found'
      }, { status: 404 });
    }

    const templateGroup = templateResult[0];

    if (!templateGroup.templates || templateGroup.templates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Template group has no templates'
      }, { status: 400 });
    }

    // Get contacts with timezone info
    const contactsQuery = `
      SELECT
        c.id,
        c.type,
        c.value,
        c.site_id,
        s.country,
        s.timezone,
        s.url as site_url
      FROM contacts c
      LEFT JOIN sites s ON c.site_id = s.id
      WHERE c.id = ANY($1)
      ORDER BY c.id
    `;

    const contacts = await executeQuery(contactsQuery, [contact_ids]);

    if (contacts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid contacts found'
      }, { status: 404 });
    }

    // Calculate schedule for each contact
    const schedulePreview: any[] = [];
    const stats = {
      total_contacts: contacts.length,
      total_emails: 0,
      total_adjustments: 0,
      weekend_adjustments: 0,
      business_hours_adjustments: 0,
      countries: new Set<string>(),
      timezones: new Set<string>()
    };

    for (const contact of contacts) {
      const contactSchedule: any = {
        contact_id: contact.id,
        contact_value: contact.value,
        contact_type: contact.type,
        country: contact.country || 'Unknown',
        timezone: contact.timezone || 'UTC',
        emails: []
      };

      stats.countries.add(contact.country || 'Unknown');
      stats.timezones.add(contact.timezone || 'UTC');

      // Calculate schedule for each template in the group
      let baseTime = new Date(start_date).toISOString();

      for (let i = 0; i < templateGroup.templates.length; i++) {
        const template = templateGroup.templates[i];
        const isFirstEmail = i === 0;

        const calculation = await calculateOptimalSchedule({
          recipient_country: contact.country || 'US',
          recipient_timezone: contact.timezone,
          base_time: baseTime,
          gap_days: isFirstEmail ? 0 : (templateGroup.gap_days || 0),
          gap_hours: isFirstEmail ? 0 : (templateGroup.gap_hours || 0),
          gap_minutes: isFirstEmail ? 0 : (templateGroup.gap_minutes || 0),
          send_time: templateGroup.send_time || '10:00'
        });

        // Track adjustments
        const hasAdjustments = calculation.adjustments.some(
          adj => adj.type !== 'none'
        );

        if (hasAdjustments) {
          stats.total_adjustments += calculation.adjustments.filter(
            adj => adj.type !== 'none'
          ).length;

          calculation.adjustments.forEach(adj => {
            if (adj.type === 'weekend') {
              stats.weekend_adjustments++;
            } else if (adj.type === 'business_hours') {
              stats.business_hours_adjustments++;
            }
          });
        }

        contactSchedule.emails.push({
          template_id: template.id,
          template_name: template.name,
          template_order: template.template_order,
          scheduled_at: calculation.adjusted_scheduled_at,
          original_scheduled_at: calculation.original_scheduled_at,
          timezone_conversion: calculation.timezone_conversion,
          adjustments: calculation.adjustments,
          country_info: calculation.country_info,
          was_adjusted: hasAdjustments
        });

        stats.total_emails++;

        // Update base time for next email
        baseTime = calculation.adjusted_scheduled_at;
      }

      schedulePreview.push(contactSchedule);
    }

    // Calculate statistics
    const finalStats = {
      total_contacts: stats.total_contacts,
      total_emails: stats.total_emails,
      total_adjustments: stats.total_adjustments,
      weekend_adjustments: stats.weekend_adjustments,
      business_hours_adjustments: stats.business_hours_adjustments,
      unique_countries: stats.countries.size,
      unique_timezones: stats.timezones.size,
      avg_emails_per_contact: (stats.total_emails / stats.total_contacts).toFixed(2),
      adjustment_rate: ((stats.total_adjustments / stats.total_emails) * 100).toFixed(2) + '%'
    };

    return NextResponse.json({
      success: true,
      data: {
        template_group: {
          id: templateGroup.id,
          name: templateGroup.name,
          gap_days: templateGroup.gap_days,
          gap_hours: templateGroup.gap_hours,
          gap_minutes: templateGroup.gap_minutes,
          send_time: templateGroup.send_time,
          template_count: templateGroup.templates.length
        },
        start_date,
        schedule: schedulePreview,
        statistics: finalStats
      }
    });
  } catch (error: any) {
    console.error('Error generating schedule preview:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
