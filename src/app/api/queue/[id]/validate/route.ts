import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { calculateOptimalSchedule } from '@/lib/schedule/timezone-calculator';

/**
 * POST /api/queue/[id]/validate
 *
 * Revalidate a specific email's schedule
 * Checks if current schedule is still valid and suggests adjustments if needed
 *
 * This is useful when:
 * - Timezone rules have changed
 * - Business hours have been updated
 * - Weekend patterns have changed
 * - Manual schedule review is needed
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const emailId = parseInt(id);

    if (isNaN(emailId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email ID'
      }, { status: 400 });
    }

    // Get the email details
    const emailQuery = `
      SELECT
        eq.id,
        eq.contact_id,
        eq.template_id,
        eq.scheduled_at,
        eq.status,
        eq.created_at,
        c.value as contact_value,
        c.type as contact_type,
        c.country_code,
        c.timezone,
        t.name as template_name,
        t.group_id,
        tg.gap_days,
        tg.gap_hours,
        tg.gap_minutes,
        tg.send_time,
        s.country as site_country,
        s.timezone as site_timezone
      FROM email_queue eq
      LEFT JOIN contacts c ON eq.contact_id = c.id
      LEFT JOIN templates t ON eq.template_id = t.id
      LEFT JOIN template_groups tg ON t.group_id = tg.id
      LEFT JOIN sites s ON c.site_id = s.id
      WHERE eq.id = $1
    `;

    const emailResult = await executeQuery(emailQuery, [emailId]);

    if (emailResult.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Email not found in queue'
      }, { status: 404 });
    }

    const email = emailResult[0];

    // Get the previous email to calculate base time
    let baseTime = new Date(email.created_at).toISOString();
    let isDependent = false;

    if (email.depends_on_email_id) {
      const prevEmailQuery = `
        SELECT scheduled_at, adjusted_scheduled_at
        FROM email_queue
        WHERE id = $1
      `;
      const prevEmailResult = await executeQuery(prevEmailQuery, [email.depends_on_email_id]);

      if (prevEmailResult.length > 0) {
        baseTime = prevEmailResult[0].adjusted_scheduled_at || prevEmailResult[0].scheduled_at;
        isDependent = true;
      }
    }

    // Determine country and timezone
    const country = email.country_code || email.site_country || 'US';
    const timezone = email.timezone || email.site_timezone;

    // Recalculate schedule with current rules
    const recalculatedSchedule = await calculateOptimalSchedule({
      recipient_country: country,
      recipient_timezone: timezone || undefined,
      base_time: baseTime,
      gap_days: isDependent ? (email.gap_days || 0) : 0,
      gap_hours: isDependent ? (email.gap_hours || 0) : 0,
      gap_minutes: isDependent ? (email.gap_minutes || 0) : 0,
      send_time: email.send_time || '10:00'
    });

    // Compare current vs recalculated schedule
    const currentScheduled = new Date(email.scheduled_at);
    const recalculatedScheduled = new Date(recalculatedSchedule.adjusted_scheduled_at);
    const timeDifference = recalculatedScheduled.getTime() - currentScheduled.getTime();
    const hoursDifference = Math.abs(timeDifference / (1000 * 60 * 60));

    // Determine validation status
    const isStillValid = timeDifference === 0;
    const needsAdjustment = !isStillValid && email.status === 'pending';

    // Build validation report
    const validationReport = {
      email_id: email.id,
      contact_value: email.contact_value,
      template_name: email.template_name,
      current_status: email.status,

      current_schedule: {
        scheduled_at: email.scheduled_at,
        timezone: timezone,
        country: country
      },

      recalculated_schedule: {
        scheduled_at: recalculatedSchedule.adjusted_scheduled_at,
        original_scheduled_at: recalculatedSchedule.original_scheduled_at,
        timezone_conversion: recalculatedSchedule.timezone_conversion,
        adjustments: recalculatedSchedule.adjustments,
        country_info: recalculatedSchedule.country_info
      },

      validation: {
        is_valid: isStillValid,
        needs_adjustment: needsAdjustment,
        time_difference_hours: parseFloat(hoursDifference.toFixed(2)),
        difference_direction: timeDifference > 0 ? 'later' : timeDifference < 0 ? 'earlier' : 'none'
      },

      suggested_adjustments: needsAdjustment ? {
        new_scheduled_at: recalculatedSchedule.adjusted_scheduled_at,
        reason: recalculatedSchedule.adjustments.find(a => a.type !== 'none')?.reason || 'Schedule recalculated based on current timezone/business rules',
        adjustment_type: recalculatedSchedule.adjustments.find(a => a.type !== 'none')?.type || 'recalculation'
      } : null,

      metadata: {
        validated_at: new Date().toISOString(),
        validation_method: 'timezone_aware_recalculation',
        rules_version: 'current',
        can_auto_adjust: email.status === 'pending',
        auto_adjusted: false,
        adjusted_at: undefined as string | undefined
      }
    };

    // Auto-adjust if enabled and email is still pending
    const body = await request.json().catch(() => ({}));
    const autoAdjust = body.auto_adjust === true && needsAdjustment && email.status === 'pending';

    if (autoAdjust) {
      const updateQuery = `
        UPDATE email_queue
        SET
          scheduled_at = $1,
          adjusted_scheduled_at = $2,
          adjustment_reason = $3,
          validated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `;

      await executeQuery(updateQuery, [
        recalculatedSchedule.original_scheduled_at,
        recalculatedSchedule.adjusted_scheduled_at,
        'Auto-adjusted after validation',
        emailId
      ]);

      validationReport.metadata.auto_adjusted = true;
      validationReport.metadata.adjusted_at = new Date().toISOString();
    }

    return NextResponse.json({
      success: true,
      data: validationReport
    });
  } catch (error: any) {
    console.error('Error validating email schedule:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
