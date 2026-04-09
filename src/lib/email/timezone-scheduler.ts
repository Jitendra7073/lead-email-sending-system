/**
 * Legacy Timezone Scheduler (Deprecated)
 *
 * This file is maintained for backward compatibility.
 * New code should use the enhanced timezone calculator at:
 * @/lib/schedule/timezone-calculator
 *
 * The new calculator provides:
 * - Full timezone-aware scheduling using date-fns-tz
 * - Country-specific business hours and weekends
 * - Detailed adjustment tracking and logging
 * - Database integration for country timezone data
 */

import { addDays, setHours, setMinutes, isWeekend, getDay } from 'date-fns';

/**
 * @deprecated Use calculateSchedule from @/lib/schedule/timezone-calculator instead
 * Ensures the scheduled date does not fall on a weekend.
 * If it does, it pushes the date to the next Monday.
 */
function skipWeekends(date: Date): Date {
  let adjustedDate = new Date(date);
  if (isWeekend(adjustedDate)) {
    // If Saturday (6), push 2 days. If Sunday (0), push 1 day.
    const daysToAdd = getDay(adjustedDate) === 6 ? 2 : 1;
    adjustedDate = addDays(adjustedDate, daysToAdd);
  }
  return adjustedDate;
}

/**
 * @deprecated Use calculateSchedule from @/lib/schedule/timezone-calculator instead
 * Calculates the exact UTC timestamp an email should be sent,
 * ensuring it arrives during business hours in the target timezone.
 *
 * @param baseTime Date denoting when the calculation starts (e.g., previous email send time)
 * @param targetTimezone The destination timezone (e.g., 'America/New_York')
 * @param gapDays Days to wait before sending
 * @param preferredTimeStr 'HH:mm' string (24hr format) representing local time in target timezone
 *
 * @deprecated This function has basic timezone support. Use the enhanced version for production.
 */
export function calculateExecutionTime(
  baseTime: Date,
  targetTimezone: string,
  gapDays: number,
  preferredTimeStr: string
): Date {
  const [hours, minutes] = preferredTimeStr.split(':').map(Number);

  // 1. Add the gap days
  let scheduledDate = addDays(baseTime, gapDays);

  // 2. Set the preferred local time
  scheduledDate = setHours(scheduledDate, hours);
  scheduledDate = setMinutes(scheduledDate, minutes);

  // 3. Prevent weekend sends
  scheduledDate = skipWeekends(scheduledDate);

  // TODO: Add complex date-fns-tz logic here to ensure "hours/minutes" are applied
  // relatively to the `targetTimezone` strictly, not the server's local time.
  // For now, this assumes server local time is the target time.

  return scheduledDate;
}

/**
 * Export the enhanced calculator for easy migration
 * @deprecated Use calculateOptimalSchedule from @/lib/schedule/timezone-calculator instead
 */
export { calculateOptimalSchedule } from '@/lib/schedule/timezone-calculator';
