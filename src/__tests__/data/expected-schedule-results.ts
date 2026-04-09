/**
 * Expected Schedule Calculation Results
 *
 * Contains expected results for various scheduling scenarios
 * Used to validate timezone-aware scheduling logic
 */

import { ScheduleCalculationResult } from '@/lib/schedule/timezone-calculator';

export interface ExpectedSchedule {
  description: string;
  input: {
    recipient_country: string;
    recipient_timezone?: string;
    base_time: string;
    gap_days?: number;
    gap_hours?: number;
    gap_minutes?: number;
    send_time?: string;
  };
  expected: {
    should_adjust: boolean;
    adjustment_type?: 'weekend' | 'business_hours' | 'both' | 'none';
    expected_delay_hours?: number;
    expected_timezone?: string;
  };
}

export const EXPECTED_SCHEDULE_RESULTS: ExpectedSchedule[] = [
  // Weekend adjustment tests
  {
    description: 'Saturday in US (should adjust to Monday)',
    input: {
      recipient_country: 'US',
      base_time: '2026-04-11T10:00:00Z', // Saturday
      gap_days: 0,
      send_time: '10:00'
    },
    expected: {
      should_adjust: true,
      adjustment_type: 'weekend',
      expected_delay_hours: 48, // 2 days to Monday
      expected_timezone: 'America/New_York'
    }
  },
  {
    description: 'Sunday in US (should adjust to Monday)',
    input: {
      recipient_country: 'US',
      base_time: '2026-04-12T10:00:00Z', // Sunday
      gap_days: 0,
      send_time: '10:00'
    },
    expected: {
      should_adjust: true,
      adjustment_type: 'weekend',
      expected_delay_hours: 24, // 1 day to Monday
      expected_timezone: 'America/New_York'
    }
  },
  {
    description: 'Friday in UAE (should adjust to Sunday)',
    input: {
      recipient_country: 'AE',
      base_time: '2026-04-10T10:00:00Z', // Friday
      gap_days: 0,
      send_time: '10:00'
    },
    expected: {
      should_adjust: true,
      adjustment_type: 'weekend',
      expected_delay_hours: 48, // 2 days to Sunday
      expected_timezone: 'Asia/Dubai'
    }
  },
  {
    description: 'Sunday in India (no adjustment - only Sunday is weekend)',
    input: {
      recipient_country: 'IN',
      base_time: '2026-04-12T10:00:00Z', // Sunday
      gap_days: 0,
      send_time: '10:00'
    },
    expected: {
      should_adjust: true,
      adjustment_type: 'weekend',
      expected_delay_hours: 24, // 1 day to Monday
      expected_timezone: 'Asia/Kolkata'
    }
  },

  // Business hours adjustment tests
  {
    description: 'Before business hours (6 AM)',
    input: {
      recipient_country: 'US',
      base_time: '2026-04-07T06:00:00Z',
      gap_days: 0,
      send_time: '06:00'
    },
    expected: {
      should_adjust: true,
      adjustment_type: 'business_hours',
      expected_delay_hours: 3, // Move to 9 AM
      expected_timezone: 'America/New_York'
    }
  },
  {
    description: 'After business hours (7 PM)',
    input: {
      recipient_country: 'US',
      base_time: '2026-04-07T19:00:00Z',
      gap_days: 0,
      send_time: '19:00'
    },
    expected: {
      should_adjust: true,
      adjustment_type: 'business_hours',
      expected_delay_hours: 16, // Move to next day 9 AM
      expected_timezone: 'America/New_York'
    }
  },
  {
    description: 'Within business hours (2 PM)',
    input: {
      recipient_country: 'US',
      base_time: '2026-04-07T14:00:00Z',
      gap_days: 0,
      send_time: '14:00'
    },
    expected: {
      should_adjust: false,
      adjustment_type: 'none',
      expected_timezone: 'America/New_York'
    }
  },

  // Gap calculation tests
  {
    description: '1 day gap',
    input: {
      recipient_country: 'US',
      base_time: '2026-04-07T10:00:00Z',
      gap_days: 1,
      send_time: '10:00'
    },
    expected: {
      should_adjust: false,
      adjustment_type: 'none',
      expected_delay_hours: 24,
      expected_timezone: 'America/New_York'
    }
  },
  {
    description: '2 hour gap',
    input: {
      recipient_country: 'US',
      base_time: '2026-04-07T10:00:00Z',
      gap_hours: 2,
      send_time: '10:00'
    },
    expected: {
      should_adjust: false,
      adjustment_type: 'none',
      expected_delay_hours: 2,
      expected_timezone: 'America/New_York'
    }
  },
  {
    description: '30 minute gap',
    input: {
      recipient_country: 'US',
      base_time: '2026-04-07T10:00:00Z',
      gap_minutes: 30,
      send_time: '10:00'
    },
    expected: {
      should_adjust: false,
      adjustment_type: 'none',
      expected_delay_hours: 0.5,
      expected_timezone: 'America/New_York'
    }
  },

  // Combined adjustments
  {
    description: 'Weekend + after hours (Saturday 7 PM)',
    input: {
      recipient_country: 'US',
      base_time: '2026-04-11T19:00:00Z', // Saturday
      gap_days: 0,
      send_time: '19:00'
    },
    expected: {
      should_adjust: true,
      adjustment_type: 'both',
      expected_delay_hours: 61, // To Monday 9 AM
      expected_timezone: 'America/New_York'
    }
  },

  // Different timezones
  {
    description: 'UK business hours (9 AM - 5 PM)',
    input: {
      recipient_country: 'GB',
      base_time: '2026-04-07T14:00:00Z',
      gap_days: 0,
      send_time: '14:00'
    },
    expected: {
      should_adjust: false,
      adjustment_type: 'none',
      expected_timezone: 'Europe/London'
    }
  },
  {
    description: 'India business hours (10 AM - 7 PM)',
    input: {
      recipient_country: 'IN',
      base_time: '2026-04-07T15:00:00Z',
      gap_days: 0,
      send_time: '15:00'
    },
    expected: {
      should_adjust: false,
      adjustment_type: 'none',
      expected_timezone: 'Asia/Kolkata'
    }
  },

  // Edge cases
  {
    description: 'Invalid country code (fallback to US)',
    input: {
      recipient_country: 'XX',
      base_time: '2026-04-07T10:00:00Z',
      gap_days: 0,
      send_time: '10:00'
    },
    expected: {
      should_adjust: false,
      adjustment_type: 'none',
      expected_timezone: 'America/New_York'
    }
  },
  {
    description: 'Custom timezone override',
    input: {
      recipient_country: 'US',
      recipient_timezone: 'America/Los_Angeles',
      base_time: '2026-04-07T14:00:00Z',
      gap_days: 0,
      send_time: '14:00'
    },
    expected: {
      should_adjust: false,
      adjustment_type: 'none',
      expected_timezone: 'America/Los_Angeles'
    }
  }
];

/**
 * Expected batch schedule results for multiple contacts
 */
export interface ExpectedBatchSchedule {
  description: string;
  contacts: Array<{
    country_code: string;
    timezone?: string;
  }>;
  start_date: string;
  template_count: number;
  expected: {
    total_emails: number;
    expected_adjustments: number;
    unique_timezones: number;
  };
}

export const EXPECTED_BATCH_SCHEDULES: ExpectedBatchSchedule[] = [
  {
    description: '3 US contacts, 2 templates',
    contacts: [
      { country_code: 'US', timezone: 'America/New_York' },
      { country_code: 'US', timezone: 'America/New_York' },
      { country_code: 'US', timezone: 'America/New_York' }
    ],
    start_date: '2026-04-07',
    template_count: 2,
    expected: {
      total_emails: 6,
      expected_adjustments: 0,
      unique_timezones: 1
    }
  },
  {
    description: 'Mixed timezones, weekend start',
    contacts: [
      { country_code: 'US', timezone: 'America/New_York' },
      { country_code: 'GB', timezone: 'Europe/London' },
      { country_code: 'IN', timezone: 'Asia/Kolkata' },
      { country_code: 'AE', timezone: 'Asia/Dubai' }
    ],
    start_date: '2026-04-05', // Saturday
    template_count: 1,
    expected: {
      total_emails: 4,
      expected_adjustments: 2, // US and GB hit weekend
      unique_timezones: 4
    }
  },
  {
    description: 'Single timezone country test',
    contacts: [
      { country_code: 'JP', timezone: 'Asia/Tokyo' },
      { country_code: 'JP', timezone: 'Asia/Tokyo' }
    ],
    start_date: '2026-04-07',
    template_count: 3,
    expected: {
      total_emails: 6,
      expected_adjustments: 0,
      unique_timezones: 1
    }
  }
];

/**
 * Helper function to validate schedule results
 */
export function validateScheduleResult(
  actual: any,
  expected: ExpectedSchedule
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if adjustment was applied
  const hasAdjustment = actual.adjustments.some((adj: any) => adj.type !== 'none');

  if (expected.expected.should_adjust !== hasAdjustment) {
    errors.push(
      `Adjustment mismatch: expected ${expected.expected.should_adjust}, got ${hasAdjustment}`
    );
  }

  // Check timezone
  if (expected.expected.expected_timezone) {
    if (actual.country_info.timezone !== expected.expected.expected_timezone) {
      errors.push(
        `Timezone mismatch: expected ${expected.expected.expected_timezone}, got ${actual.country_info.timezone}`
      );
    }
  }

  // Check adjustment type
  if (expected.expected.adjustment_type && expected.expected.adjustment_type !== 'none') {
    const hasExpectedType = actual.adjustments.some(
      (adj: any) => adj.type === expected.expected.adjustment_type
    );

    if (!hasExpectedType && expected.expected.should_adjust) {
      errors.push(
        `Expected ${expected.expected.adjustment_type} adjustment, got ${actual.adjustments.map((a: any) => a.type).join(', ')}`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Helper to calculate expected time difference
 */
export function calculateExpectedDelay(
  baseTime: string,
  expectedDelayHours: number
): string {
  const base = new Date(baseTime);
  const expected = new Date(base.getTime() + expectedDelayHours * 60 * 60 * 1000);
  return expected.toISOString();
}

/**
 * Test scenarios organized by category
 */
export const SCHEDULE_TEST_SCENARIOS = {
  weekend: EXPECTED_SCHEDULE_RESULTS.filter(r =>
    r.description.includes('Saturday') ||
    r.description.includes('Sunday') ||
    r.description.includes('Friday')
  ),
  businessHours: EXPECTED_SCHEDULE_RESULTS.filter(r =>
    r.description.includes('AM') ||
    r.description.includes('PM') ||
    r.description.includes('business hours')
  ),
  gaps: EXPECTED_SCHEDULE_RESULTS.filter(r =>
    r.description.includes('gap') ||
    r.description.includes('day') ||
    r.description.includes('hour')
  ),
  timezones: EXPECTED_SCHEDULE_RESULTS.filter(r =>
    r.description.includes('timezone') ||
    r.description.includes('UK') ||
    r.description.includes('India')
  ),
  edgeCases: EXPECTED_SCHEDULE_RESULTS.filter(r =>
    r.description.includes('Invalid') ||
    r.description.includes('Custom') ||
    r.description.includes('fallback')
  )
};
