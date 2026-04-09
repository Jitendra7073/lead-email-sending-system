/**
 * Dependency Schedule Calculator
 *
 * Handles scheduling of emails that depend on previous emails being sent.
 * Uses actual send times from previous emails to calculate optimal next send times.
 */

import { addDays, parseISO, differenceInMinutes } from 'date-fns';
import { toZonedTime, format } from 'date-fns-tz';
import { calculateOptimalSchedule, ScheduleCalculationResult } from './timezone-calculator';
import { getRegionConfig } from '@/lib/timezone/region-config';

/**
 * Dependency schedule calculation parameters
 */
export interface DependencyScheduleParams {
  previous_send_time: string;    // Actual time previous email was sent (ISO string)
  gap_days: number;              // Days to wait after previous send
  recipient_country: string;     // Recipient country code
  recipient_timezone?: string;   // Optional timezone override
  preferred_time?: string;       // Preferred send time (HH:mm)
  max_retries?: number;          // Maximum retry attempts for validation
}

/**
 * Dependency schedule calculation result
 */
export interface DependencyScheduleResult extends ScheduleCalculationResult {
  dependency_info: {
    previous_send_time: string;
    gap_days: number;
    actual_gap_days: number;    // Actual days between sends including adjustments
    previous_send_local: string; // Previous send time in recipient's timezone
  };
  validation: {
    valid: boolean;
    checks: {
      weekend_passed: boolean;
      business_hours_valid: boolean;
      gap_respected: boolean;
    };
  };
}

/**
 * Calculate dependent email schedule
 *
 * Uses the actual send time from the previous email to calculate the optimal
 * send time for the next email, respecting:
 * - Gap days between sends
 * - Recipient's timezone
 * - Weekend restrictions
 * - Business hours
 */
export async function calculateDependentSchedule(
  params: DependencyScheduleParams
): Promise<DependencyScheduleResult> {
  const {
    previous_send_time,
    gap_days,
    recipient_country,
    recipient_timezone,
    preferred_time = '10:00',
    max_retries = 3
  } = params;

  // Validate inputs
  if (!previous_send_time) {
    throw new Error('previous_send_time is required');
  }

  if (gap_days < 0) {
    throw new Error('gap_days must be non-negative');
  }

  // Get region config
  const regionConfig = await getRegionConfig(recipient_country);
  const timezone = recipient_timezone || regionConfig?.default_timezone || 'America/New_York';

  // Calculate the base time (previous send + gap days)
  const previousSendDate = parseISO(previous_send_time);
  const baseTime = addDays(previousSendDate, gap_days);

  // Calculate optimal schedule using the main calculator
  const scheduleResult = await calculateOptimalSchedule({
    recipient_country,
    recipient_timezone,
    base_time: baseTime.toISOString(),
    gap_days: 0, // Gap already applied to base_time
    send_time: preferred_time
  });

  // Calculate dependency-specific information
  const previousSendLocal = format(toZonedTime(previousSendDate, timezone), 'yyyy-MM-dd HH:mm:ss zzz', { timeZone: timezone });
  const actualGapDays = differenceInMinutes(parseISO(scheduleResult.adjusted_scheduled_at), previousSendDate) / (24 * 60);

  // Validate the calculated schedule
  const validation = await validateDependencySchedule({
    previous_send_time,
    gap_days,
    calculated_schedule: scheduleResult.adjusted_scheduled_at,
    recipient_country,
    recipient_timezone
  });

  return {
    ...scheduleResult,
    dependency_info: {
      previous_send_time,
      gap_days,
      actual_gap_days: Math.round(actualGapDays * 100) / 100, // Round to 2 decimal places
      previous_send_local: previousSendLocal
    },
    validation
  };
}

/**
 * Validate a dependency schedule
 */
async function validateDependencySchedule(params: {
  previous_send_time: string;
  gap_days: number;
  calculated_schedule: string;
  recipient_country: string;
  recipient_timezone?: string;
}): Promise<DependencyScheduleResult['validation']> {
  const { previous_send_time, gap_days, calculated_schedule, recipient_country, recipient_timezone } = params;

  const regionConfig = await getRegionConfig(recipient_country);
  const timezone = recipient_timezone || regionConfig?.default_timezone || 'America/New_York';

  const previousDate = parseISO(previous_send_time);
  const scheduledDate = parseISO(calculated_schedule);

  // Check 1: Weekend passed
  const scheduledZoned = toZonedTime(scheduledDate, timezone);
  const weekendDays = regionConfig?.weekend_days || ['Saturday', 'Sunday'];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const scheduledDayName = dayNames[scheduledZoned.getDay()];
  const weekendPassed = !weekendDays.includes(scheduledDayName);

  // Check 2: Business hours valid
  const scheduledHour = scheduledZoned.getHours();
  const businessHoursStart = parseInt(regionConfig?.business_hours_start?.split(':')[0] || '9');
  const businessHoursEnd = parseInt(regionConfig?.business_hours_end?.split(':')[0] || '18');
  const businessHoursValid = scheduledHour >= businessHoursStart && scheduledHour < businessHoursEnd;

  // Check 3: Gap respected (should be at least gap_days, possibly more due to weekend/hours adjustments)
  const actualGapDays = differenceInMinutes(scheduledDate, previousDate) / (24 * 60);
  const gapRespected = actualGapDays >= gap_days;

  return {
    valid: weekendPassed && businessHoursValid && gapRespected,
    checks: {
      weekend_passed: weekendPassed,
      business_hours_valid: businessHoursValid,
      gap_respected: gapRespected
    }
  };
}

/**
 * Calculate multiple dependent schedules (email sequence)
 */
export async function calculateEmailSequence(params: {
  first_send_time: string;          // Time first email was sent
  gaps: number[];                    // Gap days between each email (e.g., [3, 7, 14])
  recipient_country: string;
  recipient_timezone?: string;
  preferred_time?: string;
}): Promise<DependencyScheduleResult[]> {
  const { first_send_time, gaps, recipient_country, recipient_timezone, preferred_time } = params;

  const results: DependencyScheduleResult[] = [];
  let previousSendTime = first_send_time;

  for (let i = 0; i < gaps.length; i++) {
    const gapDays = gaps[i];

    try {
      const result = await calculateDependentSchedule({
        previous_send_time: previousSendTime,
        gap_days: gapDays,
        recipient_country,
        recipient_timezone,
        preferred_time
      });

      results.push(result);

      // Use the adjusted schedule time as the previous send time for next calculation
      previousSendTime = result.adjusted_scheduled_at;
    } catch (error) {
      console.error(`Error calculating schedule for email ${i + 1}:`, error);
      // Break sequence on error
      break;
    }
  }

  return results;
}

/**
 * Quick dependency schedule calculation (lightweight version)
 */
export async function calculateQuickDependencySchedule(
  previousSendTime: string,
  gapDays: number,
  countryCode: string,
  preferredTime: string = '10:00'
): Promise<string> {
  try {
    const result = await calculateDependentSchedule({
      previous_send_time: previousSendTime,
      gap_days: gapDays,
      recipient_country: countryCode,
      preferred_time: preferredTime
    });

    return result.adjusted_scheduled_at;
  } catch (error) {
    console.error('Error in quick dependency schedule calculation:', error);
    // Fallback: simple gap calculation
    const previousDate = parseISO(previousSendTime);
    const baseTime = addDays(previousDate, gapDays);
    return baseTime.toISOString();
  }
}

/**
 * Get suggested gap days for a country
 * Returns common gap patterns based on business culture
 */
export async function getSuggestedGapDays(countryCode: string): Promise<{
  quick_followup: number;    // 2-3 days
  standard: number;          // 5-7 days
  extended: number;          // 14-21 days
  explanation: string;
}> {
  try {
    const regionConfig = await getRegionConfig(countryCode);

    // Default suggestions
    const suggestions = {
      quick_followup: 3,
      standard: 7,
      extended: 14,
      explanation: 'Standard business follow-up timing'
    };

    // Customize based on country/culture
    if (regionConfig) {
      switch (regionConfig.country_code) {
        case 'US':
        case 'CA':
        case 'GB':
        case 'AU':
          suggestions.quick_followup = 2;
          suggestions.standard = 5;
          suggestions.explanation = 'Western business culture prefers faster follow-ups';
          break;

        case 'JP':
        case 'KR':
        case 'SG':
          suggestions.quick_followup = 5;
          suggestions.standard = 10;
          suggestions.explanation = 'East Asian business culture requires more formal intervals';
          break;

        case 'IN':
        case 'AE':
          suggestions.quick_followup = 3;
          suggestions.standard = 7;
          suggestions.explanation = 'Standard international business timing';
          break;

        default:
          // Use defaults
          break;
      }
    }

    return suggestions;
  } catch (error) {
    console.error('Error getting suggested gap days:', error);
    return {
      quick_followup: 3,
      standard: 7,
      extended: 14,
      explanation: 'Standard business follow-up timing'
    };
  }
}

/**
 * Validate if a dependent schedule is still valid
 * Use this to recheck schedules before sending
 */
export async function revalidateDependencySchedule(
  originalCalculation: DependencyScheduleResult,
  currentRecipientsCountry?: string,
  currentRecipientsTimezone?: string
): Promise<{
  still_valid: boolean;
  reasons: string[];
  new_schedule?: string;
}> {
  const reasons: string[] = [];
  let stillValid = true;

  // Check if country code changed
  if (currentRecipientsCountry && currentRecipientsCountry !== originalCalculation.country_info.country_code) {
    stillValid = false;
    reasons.push(`Recipient country changed from ${originalCalculation.country_info.country_code} to ${currentRecipientsCountry}`);

    // Recalculate with new country
    try {
      const newSchedule = await calculateDependentSchedule({
        previous_send_time: originalCalculation.dependency_info.previous_send_time,
        gap_days: originalCalculation.dependency_info.gap_days,
        recipient_country: currentRecipientsCountry,
        recipient_timezone: currentRecipientsTimezone,
        preferred_time: '10:00' // Could be extracted from original
      });

      return {
        still_valid: false,
        reasons,
        new_schedule: newSchedule.adjusted_scheduled_at
      };
    } catch (error) {
      console.error('Error recalculating schedule:', error);
    }
  }

  // Check if timezone changed
  if (currentRecipientsTimezone && currentRecipientsTimezone !== originalCalculation.country_info.timezone) {
    stillValid = false;
    reasons.push(`Recipient timezone changed from ${originalCalculation.country_info.timezone} to ${currentRecipientsTimezone}`);
  }

  return {
    still_valid: stillValid,
    reasons
  };
}
