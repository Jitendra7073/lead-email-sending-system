/**
 * Enhanced Timezone-Aware Schedule Calculator
 *
 * Handles timezone conversion, weekend checks, and business hours validation
 * for scheduling emails across different countries and timezones.
 *
 * Enhanced with:
 * - Multiple validation layers
 * - Detailed adjustment tracking
 * - DST transition handling
 * - Dependency scheduling support
 */

import {
  addDays,
  addHours,
  addMinutes,
  format as formatUTC,
  getDay,
  parseISO,
  setHours,
  setMinutes,
  differenceInHours
} from 'date-fns';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';
import { getRegionConfig, isWeekend, isBusinessHours, getNextBusinessDay } from '@/lib/timezone/region-config';

export interface ScheduleCalculationParams {
  recipient_country: string;
  recipient_timezone?: string;
  base_time: string; // ISO string
  gap_days?: number;
  gap_hours?: number;
  gap_minutes?: number;
  send_time?: string; // HH:mm format in recipient timezone
}

export interface ScheduleCalculationResult {
  original_scheduled_at: string;
  adjusted_scheduled_at: string;
  timezone_conversion: {
    from_timezone: string;
    to_timezone: string;
    original_time: string;
    converted_time: string;
  };
  adjustments: Array<{
    type: 'weekend' | 'business_hours' | 'dst' | 'none';
    reason: string;
    from: string;
    to: string;
  }>;
  country_info: {
    country_code: string;
    country_name: string;
    timezone: string;
    business_hours_start: string;
    business_hours_end: string;
    weekend_days: string[];
  };
  metadata: {
    total_adjustments: number;
    final_delay_hours: number;
    dst_transition: boolean;
  };
}

/**
 * Parse time string (HH:mm) to hours and minutes
 */
function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Format time with timezone abbreviation
 */
function formatWithTimezone(date: Date, timezone: string): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss zzz', { timeZone: timezone });
}

/**
 * Check if date is during DST transition period
 */
function isDSTTransition(date: Date, timezone: string): boolean {
  try {
    const before = addHours(date, -1);
    const after = addHours(date, 1);

    const beforeOffset = toZonedTime(before, timezone).getTimezoneOffset();
    const afterOffset = toZonedTime(after, timezone).getTimezoneOffset();

    return beforeOffset !== afterOffset;
  } catch {
    return false;
  }
}

/**
 * Adjust date for DST transition
 */
function handleDSTTransition(date: Date, timezone: string): Date {
  try {
    // If we're in a DST transition, the time might be ambiguous or invalid
    // Use fromZonedTime to handle this correctly
    const zonedDate = toZonedTime(date, timezone);
    return fromZonedTime(zonedDate, timezone);
  } catch {
    return date;
  }
}

/**
 * Calculate optimal schedule with multiple validation layers
 */
export async function calculateOptimalSchedule(params: ScheduleCalculationParams): Promise<ScheduleCalculationResult> {
  const {
    recipient_country,
    recipient_timezone,
    base_time,
    gap_days = 0,
    gap_hours = 0,
    gap_minutes = 0,
    send_time = '10:00' // Default 10:00 AM
  } = params;

  // Get region configuration from database
  let regionConfig = await getRegionConfig(recipient_country);

  if (!regionConfig) {
    // Use fallback config if database lookup fails
    regionConfig = {
      country_code: recipient_country,
      country_name: recipient_country,
      default_timezone: recipient_timezone || 'America/New_York',
      business_hours_start: '09:00',
      business_hours_end: '18:00',
      weekend_days: ['Saturday', 'Sunday'],
      confidence: 'low',
      source: 'fallback'
    };
  }

  // Use user-provided timezone if available, otherwise use default from config
  const targetTimezone = recipient_timezone || regionConfig.default_timezone;

  // Parse base time and apply gap
  let baseDate = parseISO(base_time);

  if (gap_days > 0) baseDate = addDays(baseDate, gap_days);
  if (gap_hours > 0) baseDate = addHours(baseDate, gap_hours);
  if (gap_minutes > 0) baseDate = addMinutes(baseDate, gap_minutes);

  // Set the preferred send time
  const { hours: sendHour, minutes: sendMinute } = parseTimeString(send_time);
  let scheduledDate = setMinutes(setHours(baseDate, sendHour), sendMinute);

  // Store original scheduled time
  const original_scheduled_at = scheduledDate.toISOString();
  const originalInRecipientTz = formatWithTimezone(toZonedTime(scheduledDate, targetTimezone), targetTimezone);

  // Collect all adjustments
  const adjustments: ScheduleCalculationResult['adjustments'] = [];
  let dstTransition = false;

  // Validation Layer 1: Check for DST transition
  if (isDSTTransition(scheduledDate, targetTimezone)) {
    dstTransition = true;
    const beforeDate = scheduledDate;
    scheduledDate = handleDSTTransition(scheduledDate, targetTimezone);
    const afterDate = scheduledDate;

    if (beforeDate.getTime() !== afterDate.getTime()) {
      adjustments.push({
        type: 'dst',
        reason: 'Adjusted for DST transition',
        from: formatWithTimezone(toZonedTime(beforeDate, targetTimezone), targetTimezone),
        to: formatWithTimezone(toZonedTime(afterDate, targetTimezone), targetTimezone)
      });
    }
  }

  // Validation Layer 2: Check for weekend
  const zonedDate = toZonedTime(scheduledDate, targetTimezone);
  if (isWeekend(zonedDate, targetTimezone, regionConfig.weekend_days)) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = dayNames[getDay(zonedDate)];

    const nextBusinessDay = getNextBusinessDay(scheduledDate, targetTimezone, regionConfig.weekend_days);
    const nextDayName = dayNames[getDay(toZonedTime(nextBusinessDay, targetTimezone))];

    adjustments.push({
      type: 'weekend',
      reason: `Date falls on ${currentDay} (weekend in ${regionConfig.country_name}), moved to ${nextDayName}`,
      from: formatWithTimezone(zonedDate, targetTimezone),
      to: formatWithTimezone(toZonedTime(nextBusinessDay, targetTimezone), targetTimezone)
    });

    scheduledDate = fromZonedTime(nextBusinessDay, targetTimezone);
  }

  // Validation Layer 3: Check for business hours
  const currentZonedDate = toZonedTime(scheduledDate, targetTimezone);
  if (!isBusinessHours(currentZonedDate, targetTimezone, regionConfig.business_hours_start, regionConfig.business_hours_end)) {
    const { hours: startHour, minutes: startMinute } = parseTimeString(regionConfig.business_hours_start);
    const currentTotalMinutes = currentZonedDate.getHours() * 60 + currentZonedDate.getMinutes();
    const startTotalMinutes = startHour * 60 + startMinute;

    let adjustedZonedDate: Date;
    let reason: string;

    if (currentTotalMinutes < startTotalMinutes) {
      // Before business hours — set to start time on the same day in recipient tz
      adjustedZonedDate = setMinutes(setHours(currentZonedDate, startHour), startMinute);
      reason = `Time ${currentZonedDate.getHours()}:${String(currentZonedDate.getMinutes()).padStart(2, '0')} is before business hours (${regionConfig.business_hours_start}), adjusted to ${regionConfig.business_hours_start}`;
    } else {
      // After business hours — move to next day at start time in recipient tz
      const nextDayZoned = addDays(currentZonedDate, 1);
      adjustedZonedDate = setMinutes(setHours(nextDayZoned, startHour), startMinute);
      reason = `Time ${currentZonedDate.getHours()}:${String(currentZonedDate.getMinutes()).padStart(2, '0')} is after business hours (${regionConfig.business_hours_end}), moved to next day at ${regionConfig.business_hours_start}`;
    }

    // Convert the zoned adjusted time back to UTC for storage
    const adjustedDate = fromZonedTime(adjustedZonedDate, targetTimezone);

    adjustments.push({
      type: 'business_hours',
      reason,
      from: formatWithTimezone(currentZonedDate, targetTimezone),
      to: formatWithTimezone(toZonedTime(adjustedDate, targetTimezone), targetTimezone)
    });

    scheduledDate = adjustedDate;
  }

  // If no adjustments, add a "none" entry for clarity
  if (adjustments.length === 0) {
    adjustments.push({
      type: 'none',
      reason: 'Scheduled time is valid (within business hours and not a weekend)',
      from: originalInRecipientTz,
      to: originalInRecipientTz
    });
  }

  // Calculate metadata
  const adjusted_scheduled_at = scheduledDate.toISOString();
  const totalDelayHours = differenceInHours(scheduledDate, parseISO(original_scheduled_at));

  return {
    original_scheduled_at,
    adjusted_scheduled_at,
    timezone_conversion: {
      from_timezone: 'UTC',
      to_timezone: targetTimezone,
      original_time: formatUTC(parseISO(original_scheduled_at), 'yyyy-MM-dd HH:mm:ss'),
      converted_time: formatWithTimezone(toZonedTime(scheduledDate, targetTimezone), targetTimezone)
    },
    adjustments,
    country_info: {
      country_code: regionConfig.country_code,
      country_name: regionConfig.country_name,
      timezone: targetTimezone,
      business_hours_start: regionConfig.business_hours_start,
      business_hours_end: regionConfig.business_hours_end,
      weekend_days: regionConfig.weekend_days
    },
    metadata: {
      total_adjustments: adjustments.filter(a => a.type !== 'none').length,
      final_delay_hours: totalDelayHours,
      dst_transition: dstTransition
    }
  };
}

/**
 * Quick schedule calculation without full validation
 * Useful for previews or batch operations
 */
export async function calculateQuickSchedule(
  baseTime: Date,
  countryCode: string,
  gapDays: number = 0,
  preferredTime: string = '10:00'
): Promise<Date> {
  try {
    const regionConfig = await getRegionConfig(countryCode);
    const timezone = regionConfig?.default_timezone || 'America/New_York';

    // Apply gap days
    let scheduledDate = addDays(baseTime, gapDays);

    // Set preferred time
    const { hours, minutes } = parseTimeString(preferredTime);
    scheduledDate = setMinutes(setHours(scheduledDate, hours), minutes);

    // Quick weekend check
    const zonedDate = toZonedTime(scheduledDate, timezone);
    const weekendDays = regionConfig?.weekend_days || ['Saturday', 'Sunday'];

    if (isWeekend(zonedDate, timezone, weekendDays)) {
      scheduledDate = getNextBusinessDay(scheduledDate, timezone, weekendDays);
    }

    return scheduledDate;
  } catch (error) {
    console.error('Error in quick schedule calculation:', error);
    return baseTime;
  }
}

/**
 * Batch calculate schedules for multiple recipients
 */
export async function calculateBatchSchedules(
  items: Array<{
    country_code: string;
    timezone?: string;
    base_time: string;
    gap_days?: number;
  }>
): Promise<Array<ScheduleCalculationResult & { id?: string }>> {
  const results = await Promise.all(
    items.map(async (item, index) => {
      try {
        const result = await calculateOptimalSchedule({
          recipient_country: item.country_code,
          recipient_timezone: item.timezone,
          base_time: item.base_time,
          gap_days: item.gap_days || 0
        });

        return { ...result, id: `item_${index}` };
      } catch (error) {
        console.error(`Error calculating schedule for item ${index}:`, error);
        return null;
      }
    })
  );

  return results.filter(r => r !== null) as Array<ScheduleCalculationResult & { id?: string }>;
}

/**
 * Validate if a timezone string is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get timezone offset for a specific date and timezone
 */
export function getTimezoneOffset(date: Date, timezone: string): number {
  try {
    const zonedDate = toZonedTime(date, timezone);
    return zonedDate.getTimezoneOffset();
  } catch {
    return 0;
  }
}
