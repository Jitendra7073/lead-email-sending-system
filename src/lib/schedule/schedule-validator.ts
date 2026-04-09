/**
 * Schedule Validator
 *
 * Validates and revalidates email schedules to ensure they are still valid
 * before sending. Handles cases where business rules may have changed.
 */

import { parseISO, differenceInHours, differenceInDays } from 'date-fns';
import { toZonedTime, format } from 'date-fns-tz';
import { calculateOptimalSchedule } from './timezone-calculator';
import { getRegionConfig, isWeekend, isBusinessHours } from '@/lib/timezone/region-config';

/**
 * Email queue item interface
 */
export interface QueueItem {
  id: string;
  recipient_email: string;
  recipient_country: string;
  recipient_timezone?: string;
  scheduled_at: string;          // Original scheduled time
  adjusted_scheduled_at?: string; // Adjusted scheduled time (if any)
  scheduled_timezone?: string;   // Timezone used for scheduling
  status: 'pending' | 'scheduled' | 'sent' | 'failed';
  metadata?: {
    original_calculation?: string;
    adjustments?: any[];
    created_at?: string;
  };
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  reasons: string[];
  new_schedule?: string;
  adjustments?: any[];
}

/**
 * Validation options
 */
export interface ValidationOptions {
  revalidate_timezone?: boolean;
  revalidate_business_hours?: boolean;
  revalidate_weekend?: boolean;
  allow_retrospective?: boolean;  // Allow schedules in the past
}

/**
 * Revalidate a schedule before sending
 *
 * This should be called before actually sending an email to ensure
 * the schedule is still valid based on current business rules.
 */
export async function revalidateSchedule(
  queueItem: QueueItem,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const {
    revalidate_timezone = true,
    revalidate_business_hours = true,
    revalidate_weekend = true,
    allow_retrospective = false
  } = options;

  const reasons: string[] = [];

  try {
    // Use adjusted_scheduled_at if available, otherwise use scheduled_at
    const scheduledTime = queueItem.adjusted_scheduled_at || queueItem.scheduled_at;
    const scheduledDate = parseISO(scheduledTime);

    // Check 1: Schedule is in the future (unless retrospective is allowed)
    if (!allow_retrospective && scheduledDate < new Date()) {
      return {
        valid: false,
        reasons: ['Scheduled time is in the past']
      };
    }

    // Get current region config
    const regionConfig = await getRegionConfig(queueItem.recipient_country);
    if (!regionConfig) {
      return {
        valid: true, // Assume valid if no config found
        reasons: ['No region configuration found, assuming valid']
      };
    }

    const timezone = queueItem.recipient_timezone || regionConfig.default_timezone;
    const zonedDate = toZonedTime(scheduledDate, timezone);

    // Check 2: Weekend validation (if enabled)
    if (revalidate_weekend) {
      const isWeekendDay = isWeekend(zonedDate, timezone, regionConfig.weekend_days);
      if (isWeekendDay) {
        reasons.push('Scheduled date falls on a weekend');

        // Calculate new schedule
        const newSchedule = await getAdjustmentIfNeeded(queueItem);
        if (newSchedule.new_schedule) {
          return {
            valid: false,
            reasons,
            new_schedule: newSchedule.new_schedule,
            adjustments: newSchedule.adjustments
          };
        }
      }
    }

    // Check 3: Business hours validation (if enabled)
    if (revalidate_business_hours) {
      const isInBusinessHours = isBusinessHours(
        zonedDate,
        timezone,
        regionConfig.business_hours_start,
        regionConfig.business_hours_end
      );

      if (!isInBusinessHours) {
        reasons.push('Scheduled time is outside business hours');

        // Calculate new schedule
        const newSchedule = await getAdjustmentIfNeeded(queueItem);
        if (newSchedule.new_schedule) {
          return {
            valid: false,
            reasons,
            new_schedule: newSchedule.new_schedule,
            adjustments: newSchedule.adjustments
          };
        }
      }
    }

    // Check 4: Timezone validation (if enabled and timezone provided)
    if (revalidate_timezone && queueItem.recipient_timezone && queueItem.scheduled_timezone) {
      if (queueItem.recipient_timezone !== queueItem.scheduled_timezone) {
        reasons.push(
          `Recipient timezone changed from ${queueItem.scheduled_timezone} to ${queueItem.recipient_timezone}`
        );

        // Recalculate with new timezone
        const newSchedule = await getAdjustmentIfNeeded(queueItem);
        if (newSchedule.new_schedule) {
          return {
            valid: false,
            reasons,
            new_schedule: newSchedule.new_schedule,
            adjustments: newSchedule.adjustments
          };
        }
      }
    }

    // All checks passed
    return {
      valid: true,
      reasons: reasons.length > 0 ? reasons : ['Schedule is valid']
    };

  } catch (error) {
    console.error('Error revalidating schedule:', error);
    return {
      valid: true, // Assume valid if validation fails
      reasons: ['Validation error, assuming valid']
    };
  }
}

/**
 * Check if a schedule is still valid
 * Lightweight version that returns boolean only
 */
export async function isScheduleStillValid(
  queueItem: QueueItem,
  options: ValidationOptions = {}
): Promise<boolean> {
  const result = await revalidateSchedule(queueItem, options);
  return result.valid;
}

/**
 * Get adjustment if schedule is invalid
 */
export async function getAdjustmentIfNeeded(
  queueItem: QueueItem
): Promise<{ new_schedule?: string; adjustments?: any[] }> {
  try {
    // Recalculate schedule with current rules
    const result = await calculateOptimalSchedule({
      recipient_country: queueItem.recipient_country,
      recipient_timezone: queueItem.recipient_timezone,
      base_time: new Date().toISOString(), // Recalculate from now
      gap_days: 0, // Start fresh
      send_time: '10:00' // Default time
    });

    return {
      new_schedule: result.adjusted_scheduled_at,
      adjustments: result.adjustments
    };
  } catch (error) {
    console.error('Error getting adjustment:', error);
    return {};
  }
}

/**
 * Batch revalidate multiple queue items
 */
export async function batchRevalidateSchedules(
  queueItems: QueueItem[],
  options: ValidationOptions = {}
): Promise<Array<{ item: QueueItem; result: ValidationResult }>> {
  const results = await Promise.all(
    queueItems.map(async (item) => {
      try {
        const result = await revalidateSchedule(item, options);
        return { item, result };
      } catch (error) {
        console.error(`Error revalidating queue item ${item.id}:`, error);
        return {
          item,
          result: {
            valid: true, // Assume valid on error
            reasons: ['Validation error, assuming valid']
          }
        };
      }
    })
  );

  return results;
}

/**
 * Check if schedule needs refresh
 * Returns true if schedule is old enough to need revalidation
 */
export function needsRefresh(queueItem: QueueItem, maxAge: number = 24): boolean {
  if (!queueItem.metadata?.created_at) {
    return true; // No creation date, assume needs refresh
  }

  const createdAt = parseISO(queueItem.metadata.created_at);
  const ageInHours = differenceInHours(new Date(), createdAt);

  return ageInHours > maxAge;
}

/**
 * Auto-fix invalid schedules
 */
export async function autoFixSchedule(
  queueItem: QueueItem,
  options: ValidationOptions = {}
): Promise<QueueItem | null> {
  const validation = await revalidateSchedule(queueItem, options);

  if (validation.valid) {
    return queueItem; // No fix needed
  }

  if (!validation.new_schedule) {
    return null; // Cannot fix
  }

  // Return updated queue item
  return {
    ...queueItem,
    adjusted_scheduled_at: validation.new_schedule,
    metadata: {
      ...queueItem.metadata,
      original_calculation: queueItem.scheduled_at,
      adjustments: validation.adjustments || []
    }
  };
}

/**
 * Get schedule health metrics
 */
export async function getScheduleHealthMetrics(queueItems: QueueItem[]): Promise<{
  total: number;
  valid: number;
  invalid: number;
  needs_refresh: number;
  issues_by_type: Record<string, number>;
}> {
  const metrics = {
    total: queueItems.length,
    valid: 0,
    invalid: 0,
    needs_refresh: 0,
    issues_by_type: {} as Record<string, number>
  };

  for (const item of queueItems) {
    // Check if needs refresh
    if (needsRefresh(item)) {
      metrics.needs_refresh++;
    }

    // Validate
    const isValid = await isScheduleStillValid(item);
    if (isValid) {
      metrics.valid++;
    } else {
      metrics.invalid++;

      // Track issues
      const validation = await revalidateSchedule(item);
      for (const reason of validation.reasons) {
        const issueType = reason.split(' ').slice(0, 3).join(' '); // First 3 words as type
        metrics.issues_by_type[issueType] = (metrics.issues_by_type[issueType] || 0) + 1;
      }
    }
  }

  return metrics;
}

/**
 * Get suggested fixes for invalid schedules
 */
export function getSuggestedFixes(validationResult: ValidationResult): string[] {
  const fixes: string[] = [];

  if (validationResult.valid) {
    return ['No fixes needed'];
  }

  for (const reason of validationResult.reasons) {
    if (reason.includes('weekend')) {
      fixes.push('Move to next business day (Monday or first non-weekend day)');
    } else if (reason.includes('business hours')) {
      fixes.push('Adjust to within business hours (9 AM - 6 PM)');
    } else if (reason.includes('timezone')) {
      fixes.push('Recalculate with current timezone settings');
    } else if (reason.includes('past')) {
      fixes.push('Reschedule to future date/time');
    }
  }

  return fixes.length > 0 ? fixes : ['Recalculate schedule with current rules'];
}

/**
 * Export validation results as summary
 */
export function exportValidationSummary(
  results: Array<{ item: QueueItem; result: ValidationResult }>
): {
  total_checked: number;
  valid_count: number;
  invalid_count: number;
  issues_summary: Record<string, number>;
  recommendations: string[];
} {
  const summary = {
    total_checked: results.length,
    valid_count: 0,
    invalid_count: 0,
    issues_summary: {} as Record<string, number>,
    recommendations: [] as string[]
  };

  for (const { item, result } of results) {
    if (result.valid) {
      summary.valid_count++;
    } else {
      summary.invalid_count++;

      // Track issues
      for (const reason of result.reasons) {
        const issueType = reason.split(' ').slice(0, 3).join(' ');
        summary.issues_summary[issueType] = (summary.issues_summary[issueType] || 0) + 1;
      }

      // Add recommendations
      const fixes = getSuggestedFixes(result);
      summary.recommendations.push(...fixes);
    }
  }

  // Deduplicate recommendations
  summary.recommendations = [...new Set(summary.recommendations)];

  return summary;
}
