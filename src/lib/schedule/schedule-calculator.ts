/**
 * Schedule Calculator
 *
 * Wrapper around timezone-calculator with dependency chain support
 * Handles gap-based and dependency-based scheduling
 */

import { calculateOptimalSchedule as calcOptimalSchedule, ScheduleCalculationResult } from './timezone-calculator';

export interface ScheduleCalculationParams {
  recipient_country: string;
  recipient_timezone?: string;
  base_time: string;
  gap_days?: number;
  gap_hours?: number;
  gap_minutes?: number;
  send_time?: string;
}

/**
 * Calculate optimal schedule for the first email in a sequence
 * Uses gap_days = 0 (no dependency on previous email)
 */
export async function calculateOptimalSchedule(params: ScheduleCalculationParams): Promise<ScheduleCalculationResult> {
  return calcOptimalSchedule({
    ...params,
    gap_days: 0 // First email has no gap
  });
}

/**
 * Calculate schedule for follow-up emails based on previous email
 * Uses the previous email's scheduled_at as base_time
 */
export async function calculateDependentSchedule(
  baseTime: string, // Previous email's scheduled_at
  gapDays: number,
  params: Omit<ScheduleCalculationParams, 'base_time' | 'gap_days'>
): Promise<ScheduleCalculationResult> {
  return calcOptimalSchedule({
    ...params,
    base_time: baseTime,
    gap_days: gapDays
  });
}

/**
 * Calculate schedule for a specific position in template group
 * Handles gap days based on position (uses group's gap configuration)
 */
export async function calculatePositionSchedule(
  position: number,
  gapDaysConfig: number[], // Array of gap days [gap_after_1, gap_after_2, ...]
  previousScheduledAt: string | null,
  params: ScheduleCalculationParams
): Promise<ScheduleCalculationResult> {
  if (position === 1) {
    // First email - no gap
    return calculateOptimalSchedule(params);
  }

  // Subsequent emails - use gap from config
  const gapIndex = position - 2; // gap_days_1 is for position 2
  const gapDays = gapDaysConfig[gapIndex] || 5; // Default 5 days

  if (!previousScheduledAt) {
    throw new Error(`Previous scheduled time required for position ${position}`);
  }

  return calculateDependentSchedule(previousScheduledAt, gapDays, params);
}

/**
 * Validate if calculated schedule is acceptable
 * Checks if adjustment is not too far in the future
 */
export function validateScheduleResult(result: ScheduleCalculationResult): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const adjustedDate = new Date(result.adjusted_scheduled_at);
  const originalDate = new Date(result.original_scheduled_at);
  const now = new Date();

  // Check if adjusted date is too far in the future (> 30 days from original)
  const daysDiff = (adjustedDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > 30) {
    warnings.push(`Schedule adjusted ${daysDiff.toFixed(0)} days from original time`);
  }

  // Check if scheduled in the past
  if (adjustedDate < now) {
    warnings.push('Scheduled time is in the past');
  }

  // Check if too many adjustments
  if (result.adjustments.length > 3) {
    warnings.push('Multiple adjustments applied to schedule');
  }

  return {
    isValid: warnings.length === 0 || warnings.length <= 2,
    warnings
  };
}

/**
 * Format schedule result for logging
 */
export function formatScheduleLog(result: ScheduleCalculationResult): string {
  const parts = [
    `Country: ${result.country_info.country_name} (${result.country_info.country_code})`,
    `Timezone: ${result.country_info.timezone}`,
    `Original: ${result.timezone_conversion.converted_time}`,
    `Adjusted: ${result.adjustments.length > 0 ? result.adjustments[result.adjustments.length - 1].to : result.timezone_conversion.converted_time}`,
  ];

  if (result.adjustments.length > 0) {
    parts.push(`Adjustments: ${result.adjustments.map(a => a.type).join(', ')}`);
  }

  return parts.join(' | ');
}
