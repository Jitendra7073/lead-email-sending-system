/**
 * Timezone Calculator Test Suite
 *
 * Run with: npm test (if jest is configured) or use these examples for manual testing
 */

import { calculateOptimalSchedule, isValidTimezone } from '../timezone-calculator';

describe('Timezone Calculator', () => {
  describe('calculateOptimalSchedule', () => {
    test('should adjust weekend date to Monday', async () => {
      const result = await calculateOptimalSchedule({
        recipient_country: 'US',
        recipient_timezone: 'America/New_York',
        base_time: '2026-04-06T09:00:00Z', // Sunday
        gap_days: 0,
        send_time: '10:00'
      });

      console.log('Weekend Adjustment Test:', JSON.stringify(result, null, 2));

      // Should be Monday April 8th
      expect(result.adjustments[0].type).toBe('weekend');
      expect(result.adjustments[0].reason).toContain('Sunday');
    });

    test('should respect different weekend days for Middle East', async () => {
      const result = await calculateOptimalSchedule({
        recipient_country: 'AE', // UAE - Friday/Saturday weekend
        recipient_timezone: 'Asia/Dubai',
        base_time: '2026-04-04T09:00:00Z', // Friday
        gap_days: 0,
        send_time: '10:00'
      });

      console.log('Middle East Weekend Test:', JSON.stringify(result, null, 2));

      expect(result.country_info.weekend_days).toContain('Friday');
      expect(result.country_info.weekend_days).toContain('Saturday');
    });

    test('should adjust time outside business hours', async () => {
      const result = await calculateOptimalSchedule({
        recipient_country: 'US',
        recipient_timezone: 'America/New_York',
        base_time: '2026-04-07T20:00:00Z', // Monday 8PM
        gap_days: 0,
        send_time: '20:00'
      });

      console.log('Business Hours Test:', JSON.stringify(result, null, 2));

      // Should adjust to next day at 9AM
      expect(result.adjustments.some((a: any) => a.type === 'business_hours')).toBe(true);
    });

    test('should apply gap correctly', async () => {
      const result = await calculateOptimalSchedule({
        recipient_country: 'US',
        recipient_timezone: 'America/New_York',
        base_time: '2026-04-07T09:00:00Z',
        gap_days: 3,
        gap_hours: 2,
        gap_minutes: 30,
        send_time: '10:00'
      });

      console.log('Gap Application Test:', JSON.stringify(result, null, 2));

      // Should be 3 days, 2 hours, 30 minutes later
      const originalDate = new Date('2026-04-07T09:00:00Z');
      const expectedDate = new Date(result.adjusted_scheduled_at);
      const timeDiff = expectedDate.getTime() - originalDate.getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

      expect(daysDiff).toBeGreaterThan(3);
      expect(daysDiff).toBeLessThan(3.2); // Approximately 3.1 days
    });

    test('should handle India timezone correctly', async () => {
      const result = await calculateOptimalSchedule({
        recipient_country: 'IN',
        recipient_timezone: 'Asia/Kolkata',
        base_time: '2026-04-07T09:00:00Z',
        gap_days: 0,
        send_time: '11:00'
      });

      console.log('India Timezone Test:', JSON.stringify(result, null, 2));

      expect(result.country_info.country_name).toBe('India');
      expect(result.country_info.timezone).toBe('Asia/Kolkata');
      expect(result.country_info.weekend_days).toEqual(['Sunday']);
    });

    test('should work with default timezone when none provided', async () => {
      const result = await calculateOptimalSchedule({
        recipient_country: 'GB',
        base_time: '2026-04-07T09:00:00Z',
        gap_days: 0,
        send_time: '10:00'
      });

      console.log('Default Timezone Test:', JSON.stringify(result, null, 2));

      expect(result.country_info.timezone).toBe('Europe/London');
    });
  });

  describe('isValidTimezone', () => {
    test('should validate correct timezones', () => {
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
    });

    test('should reject invalid timezones', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
    });
  });
});

// Example usage for manual testing
export async function runManualTests() {
  console.log('=== Manual Timezone Calculator Tests ===\n');

  // Test 1: Weekend adjustment
  console.log('Test 1: Weekend Adjustment (Sunday -> Monday)');
  const test1 = await calculateOptimalSchedule({
    recipient_country: 'US',
    recipient_timezone: 'America/New_York',
    base_time: '2026-04-06T09:00:00Z', // Sunday
    gap_days: 0,
    send_time: '10:00'
  });
  console.log(JSON.stringify(test1, null, 2));
  console.log('\n');

  // Test 2: Business hours adjustment
  console.log('Test 2: Business Hours Adjustment (8PM -> Next Day 9AM)');
  const test2 = await calculateOptimalSchedule({
    recipient_country: 'US',
    recipient_timezone: 'America/New_York',
    base_time: '2026-04-07T20:00:00Z', // Monday 8PM
    gap_days: 0,
    send_time: '20:00'
  });
  console.log(JSON.stringify(test2, null, 2));
  console.log('\n');

  // Test 3: Gap application
  console.log('Test 3: Gap Application (3 days, 2 hours, 30 minutes)');
  const test3 = await calculateOptimalSchedule({
    recipient_country: 'US',
    recipient_timezone: 'America/New_York',
    base_time: '2026-04-07T09:00:00Z',
    gap_days: 3,
    gap_hours: 2,
    gap_minutes: 30,
    send_time: '10:00'
  });
  console.log(JSON.stringify(test3, null, 2));
  console.log('\n');

  // Test 4: Multi-day gap across weekend
  console.log('Test 4: Multi-day Gap Across Weekend');
  const test4 = await calculateOptimalSchedule({
    recipient_country: 'US',
    recipient_timezone: 'America/New_York',
    base_time: '2026-04-03T09:00:00Z', // Friday
    gap_days: 2, // Would land on Sunday
    send_time: '10:00'
  });
  console.log(JSON.stringify(test4, null, 2));
  console.log('\n');

  // Test 5: Different country (India - only Sunday weekend)
  console.log('Test 5: India Timezone (Saturday business day)');
  const test5 = await calculateOptimalSchedule({
    recipient_country: 'IN',
    recipient_timezone: 'Asia/Kolkata',
    base_time: '2026-04-05T09:00:00Z', // Saturday
    gap_days: 0,
    send_time: '11:00'
  });
  console.log(JSON.stringify(test5, null, 2));
  console.log('\n');

  // Test 6: Middle East weekend (Friday-Saturday)
  console.log('Test 6: UAE Timezone (Friday-Saturday weekend)');
  const test6 = await calculateOptimalSchedule({
    recipient_country: 'AE',
    recipient_timezone: 'Asia/Dubai',
    base_time: '2026-04-04T09:00:00Z', // Friday
    gap_days: 0,
    send_time: '10:00'
  });
  console.log(JSON.stringify(test6, null, 2));
  console.log('\n');
}
