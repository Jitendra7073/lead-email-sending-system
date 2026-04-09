/**
 * Timezone Scheduling Examples
 *
 * Practical examples of using the timezone detection and scheduling utilities
 */

import {
  enrichContactTimezone,
  detectTimezoneFromEmail,
  detectCountryFromPhone,
  getRegionConfig,
  isWeekend,
  isBusinessHours
} from '@/lib/timezone';

import {
  calculateOptimalSchedule,
  calculateQuickSchedule,
  calculateDependentSchedule,
  calculateEmailSequence,
  revalidateSchedule,
  getSuggestedGapDays,
  batchRevalidateSchedules
} from '@/lib/schedule';

/**
 * Example 1: Detect timezone from email
 */
export async function example1_detectFromEmail() {
  console.log('=== Example 1: Detect Timezone from Email ===');

  const result = await enrichContactTimezone({
    email: 'john.doe@example.co.uk'
  });

  console.log('Detected Timezone:', result?.timezone);
  console.log('Country:', result?.country_name);
  console.log('Confidence:', result?.confidence);
  console.log('Source:', result?.source);
}

/**
 * Example 2: Detect timezone from phone number
 */
export async function example2_detectFromPhone() {
  console.log('=== Example 2: Detect Timezone from Phone ===');

  const result = await enrichContactTimezone({
    phone: '+91 98765 43210'
  });

  console.log('Detected Timezone:', result?.timezone);
  console.log('Country:', result?.country_name);
  console.log('Confidence:', result?.confidence);
}

/**
 * Example 3: Detect timezone from multiple sources
 */
export async function example3_detectFromMultipleSources() {
  console.log('=== Example 3: Detect from Multiple Sources ===');

  const result = await enrichContactTimezone({
    email: 'user@example.com',
    phone: '+1 555-123-4567',
    domain: 'example.co.uk'
  });

  console.log('Best Match:', result?.timezone);
  console.log('Source:', result?.source);
}

/**
 * Example 4: Calculate optimal schedule
 */
export async function example4_calculateSchedule() {
  console.log('=== Example 4: Calculate Optimal Schedule ===');

  const result = await calculateOptimalSchedule({
    recipient_country: 'GB',
    base_time: new Date().toISOString(),
    gap_days: 3,
    send_time: '14:00'
  });

  console.log('Original Schedule:', result.original_scheduled_at);
  console.log('Adjusted Schedule:', result.adjusted_scheduled_at);
  console.log('Timezone:', result.timezone_conversion.to_timezone);
  console.log('Adjustments:', result.adjustments);
  console.log('Country Info:', result.country_info);
}

/**
 * Example 5: Calculate dependent schedule (follow-up email)
 */
export async function example5_dependentSchedule() {
  console.log('=== Example 5: Calculate Dependent Schedule ===');

  const previousEmailSent = '2026-04-07T10:00:00Z';

  const result = await calculateDependentSchedule({
    previous_send_time: previousEmailSent,
    gap_days: 7,
    recipient_country: 'US',
    preferred_time: '10:00'
  });

  console.log('Previous Send:', result.dependency_info.previous_send_time);
  console.log('Gap Days:', result.dependency_info.gap_days);
  console.log('New Schedule:', result.adjusted_scheduled_at);
  console.log('Validation:', result.validation);
}

/**
 * Example 6: Calculate email sequence
 */
export async function example6_emailSequence() {
  console.log('=== Example 6: Calculate Email Sequence ===');

  const sequence = await calculateEmailSequence({
    first_send_time: '2026-04-07T10:00:00Z',
    gaps: [3, 7, 14],
    recipient_country: 'CA'
  });

  console.log('Email Sequence:');
  sequence.forEach((email, index) => {
    console.log(`Email ${index + 1}:`);
    console.log(`  Scheduled: ${email.adjusted_scheduled_at}`);
    console.log(`  Adjustments: ${email.adjustments.length}`);
  });
}

/**
 * Example 7: Validate schedule before sending
 */
export async function example7_validateSchedule() {
  console.log('=== Example 7: Validate Schedule ===');

  const queueItem = {
    id: '123',
    recipient_email: 'user@example.com',
    recipient_country: 'US',
    scheduled_at: '2026-04-10T10:00:00Z',
    status: 'pending',
    metadata: {
      created_at: new Date().toISOString()
    }
  };

  const validation = await revalidateSchedule(queueItem);

  console.log('Valid:', validation.valid);
  console.log('Reasons:', validation.reasons);

  if (!validation.valid && validation.new_schedule) {
    console.log('New Schedule:', validation.new_schedule);
  }
}

/**
 * Example 8: Get suggested gap days for country
 */
export async function example8_suggestedGaps() {
  console.log('=== Example 8: Get Suggested Gap Days ===');

  const suggestions = await getSuggestedGapDays('JP');

  console.log('Quick Follow-up:', suggestions.quick_followup, 'days');
  console.log('Standard:', suggestions.standard, 'days');
  console.log('Extended:', suggestions.extended, 'days');
  console.log('Explanation:', suggestions.explanation);
}

/**
 * Example 9: Batch validate schedules
 */
export async function example9_batchValidation() {
  console.log('=== Example 9: Batch Validate Schedules ===');

  const queueItems = [
    {
      id: '1',
      recipient_email: 'user1@example.com',
      recipient_country: 'US',
      scheduled_at: '2026-04-10T10:00:00Z',
      status: 'pending'
    },
    {
      id: '2',
      recipient_email: 'user2@example.co.uk',
      recipient_country: 'GB',
      scheduled_at: '2026-04-11T10:00:00Z',
      status: 'pending'
    }
  ];

  const results = await batchRevalidateSchedules(queueItems);

  results.forEach(({ item, result }) => {
    console.log(`Item ${item.id}:`, result.valid ? 'Valid' : 'Invalid');
    if (!result.valid) {
      console.log('  Reasons:', result.reasons);
    }
  });
}

/**
 * Example 10: Quick schedule calculation
 */
export async function example10_quickSchedule() {
  console.log('=== Example 10: Quick Schedule Calculation ===');

  const scheduledDate = await calculateQuickSchedule(
    new Date(),
    'DE',
    5,
    '11:00'
  );

  console.log('Quick Schedule:', scheduledDate.toISOString());
}

/**
 * Example 11: Check if date is weekend
 */
export async function example11_checkWeekend() {
  console.log('=== Example 11: Check Weekend ===');

  const saturday = new Date('2026-04-12T10:00:00Z'); // Saturday
  const isWeekendDay = await isWeekend(
    saturday,
    'America/New_York',
    ['Saturday', 'Sunday']
  );

  console.log('Is Saturday a weekend?', isWeekendDay);
}

/**
 * Example 12: Check business hours
 */
export async function example12_checkBusinessHours() {
  console.log('=== Example 12: Check Business Hours ===');

  const earlyMorning = new Date('2026-04-07T06:00:00Z'); // 6 AM
  const isInHours = await isBusinessHours(
    earlyMorning,
    'America/New_York',
    '09:00',
    '18:00'
  );

  console.log('Is 6 AM within business hours?', isInHours);
}

/**
 * Example 13: Get region configuration
 */
export async function example13_getRegionConfig() {
  console.log('=== Example 13: Get Region Configuration ===');

  const config = await getRegionConfig('AE');

  console.log('Country:', config?.country_name);
  console.log('Timezone:', config?.default_timezone);
  console.log('Business Hours:', config?.business_hours_start, '-', config?.business_hours_end);
  console.log('Weekend Days:', config?.weekend_days);
}

/**
 * Example 14: Complete workflow
 */
export async function example14_completeWorkflow() {
  console.log('=== Example 14: Complete Workflow ===');

  // Step 1: Detect timezone
  const timezone = await enrichContactTimezone({
    email: 'prospect@example.co.jp',
    phone: '+81 3-1234-5678'
  });

  console.log('Detected:', timezone?.country_name, timezone?.timezone);

  // Step 2: Get suggested gaps
  const gaps = await getSuggestedGapDays(timezone?.country_code || 'JP');
  console.log('Suggested gap:', gaps.standard, 'days');

  // Step 3: Calculate schedule
  const schedule = await calculateOptimalSchedule({
    recipient_country: timezone?.country_code || 'JP',
    base_time: new Date().toISOString(),
    gap_days: gaps.standard,
    send_time: '10:00'
  });

  console.log('Scheduled for:', schedule.adjusted_scheduled_at);

  // Step 4: Validate before sending
  const queueItem = {
    id: '1',
    recipient_email: 'prospect@example.co.jp',
    recipient_country: timezone?.country_code || 'JP',
    scheduled_at: schedule.adjusted_scheduled_at,
    status: 'pending'
  };

  const validation = await revalidateSchedule(queueItem);
  console.log('Ready to send:', validation.valid);

  return {
    timezone,
    gaps,
    schedule,
    validation
  };
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  try {
    await example1_detectFromEmail();
    console.log('\n');

    await example2_detectFromPhone();
    console.log('\n');

    await example3_detectFromMultipleSources();
    console.log('\n');

    await example4_calculateSchedule();
    console.log('\n');

    await example5_dependentSchedule();
    console.log('\n');

    await example6_emailSequence();
    console.log('\n');

    await example7_validateSchedule();
    console.log('\n');

    await example8_suggestedGaps();
    console.log('\n');

    await example9_batchValidation();
    console.log('\n');

    await example10_quickSchedule();
    console.log('\n');

    await example11_checkWeekend();
    console.log('\n');

    await example12_checkBusinessHours();
    console.log('\n');

    await example13_getRegionConfig();
    console.log('\n');

    await example14_completeWorkflow();
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export individual examples for testing
export default {
  example1_detectFromEmail,
  example2_detectFromPhone,
  example3_detectFromMultipleSources,
  example4_calculateSchedule,
  example5_dependentSchedule,
  example6_emailSequence,
  example7_validateSchedule,
  example8_suggestedGaps,
  example9_batchValidation,
  example10_quickSchedule,
  example11_checkWeekend,
  example12_checkBusinessHours,
  example13_getRegionConfig,
  example14_completeWorkflow,
  runAllExamples
};
