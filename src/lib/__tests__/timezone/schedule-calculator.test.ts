/**
 * Unit Tests for Schedule Calculator
 */

import { describe, it, expect } from '@jest/globals';
import { calculateSchedule } from '../../schedule/timezone-calculator';

describe('ScheduleCalculator', () => {
  describe('basic scheduling', () => {
    it('should calculate schedule for business day within hours', () => {
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: '2026-04-07T10:00:00Z',
        gap_days: 1,
        send_time: '10:00'
      });

      expect(result.original_scheduled_at).toBeDefined();
      expect(result.adjusted_scheduled_at).toBeDefined();
      expect(result.timezone_conversion).toBeDefined();
    });

    it('should handle zero gap', () => {
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: '2026-04-07T10:00:00Z',
        gap_days: 0,
        send_time: '10:00'
      });

      expect(result.adjustments).toBeDefined();
      expect(result.adjustments.length).toBeGreaterThan(0);
    });
  });

  describe('weekend adjustments', () => {
    it('should adjust Saturday to Monday for US', () => {
      // Saturday, April 11, 2026
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: '2026-04-10T10:00:00Z',
        gap_days: 1,
        send_time: '10:00'
      });

      const hasWeekendAdjustment = result.adjustments.some(
        adj => adj.type === 'weekend'
      );
      expect(hasWeekendAdjustment).toBe(true);
    });

    it('should adjust Sunday to Monday for US', () => {
      // Sunday, April 12, 2026
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: '2026-04-11T10:00:00Z',
        gap_days: 1,
        send_time: '10:00'
      });

      const hasWeekendAdjustment = result.adjustments.some(
        adj => adj.type === 'weekend'
      );
      expect(hasWeekendAdjustment).toBe(true);
    });

    it('should not adjust weekdays', () => {
      // Monday, April 13, 2026
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: '2026-04-13T10:00:00Z',
        gap_days: 0,
        send_time: '10:00'
      });

      const hasWeekendAdjustment = result.adjustments.some(
        adj => adj.type === 'weekend'
      );
      expect(hasWeekendAdjustment).toBe(false);
    });
  });

  describe('business hours adjustments', () => {
    it('should adjust time before business hours', () => {
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: '2026-04-07T06:00:00Z',
        gap_days: 0,
        send_time: '06:00'
      });

      const hasBusinessHoursAdjustment = result.adjustments.some(
        adj => adj.type === 'business_hours'
      );
      expect(hasBusinessHoursAdjustment).toBe(true);
    });

    it('should adjust time after business hours', () => {
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: '2026-04-07T18:00:00Z',
        gap_days: 0,
        send_time: '19:00'
      });

      const hasBusinessHoursAdjustment = result.adjustments.some(
        adj => adj.type === 'business_hours'
      );
      expect(hasBusinessHoursAdjustment).toBe(true);
    });

    it('should not adjust within business hours', () => {
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: '2026-04-07T14:00:00Z',
        gap_days: 0,
        send_time: '14:00'
      });

      const hasBusinessHoursAdjustment = result.adjustments.some(
        adj => adj.type === 'business_hours'
      );
      expect(hasBusinessHoursAdjustment).toBe(false);
    });
  });

  describe('different countries', () => {
    it('should handle India timezone', () => {
      const result = calculateSchedule({
        recipient_country: 'IN',
        base_time: '2026-04-07T10:00:00Z',
        gap_days: 0,
        send_time: '10:00'
      });

      expect(result.country_info.country_code).toBe('IN');
      expect(result.country_info.timezone).toBe('Asia/Kolkata');
      expect(result.country_info.weekend_days).toEqual(['Sunday']);
    });

    it('should handle UAE weekend (Friday-Saturday)', () => {
      const result = calculateSchedule({
        recipient_country: 'AE',
        base_time: '2026-04-07T10:00:00Z',
        gap_days: 0,
        send_time: '10:00'
      });

      expect(result.country_info.country_code).toBe('AE');
      expect(result.country_info.weekend_days).toEqual(['Friday', 'Saturday']);
    });

    it('should handle Japan timezone', () => {
      const result = calculateSchedule({
        recipient_country: 'JP',
        base_time: '2026-04-07T10:00:00Z',
        gap_days: 0,
        send_time: '10:00'
      });

      expect(result.country_info.country_code).toBe('JP');
      expect(result.country_info.timezone).toBe('Asia/Tokyo');
    });
  });

  describe('gap calculations', () => {
    it('should add days correctly', () => {
      const base = '2026-04-07T10:00:00Z';
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: base,
        gap_days: 3,
        send_time: '10:00'
      });

      const baseDate = new Date(base);
      const scheduledDate = new Date(result.original_scheduled_at);
      const daysDiff = Math.floor((scheduledDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBe(3);
    });

    it('should add hours correctly', () => {
      const base = '2026-04-07T10:00:00Z';
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: base,
        gap_hours: 5,
        send_time: '10:00'
      });

      const baseDate = new Date(base);
      const scheduledDate = new Date(result.original_scheduled_at);
      const hoursDiff = (scheduledDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60);

      expect(hoursDiff).toBeCloseTo(5, 1);
    });

    it('should add minutes correctly', () => {
      const base = '2026-04-07T10:00:00Z';
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: base,
        gap_minutes: 30,
        send_time: '10:00'
      });

      const baseDate = new Date(base);
      const scheduledDate = new Date(result.original_scheduled_at);
      const minutesDiff = (scheduledDate.getTime() - baseDate.getTime()) / (1000 * 60);

      expect(minutesDiff).toBeCloseTo(30, 1);
    });

    it('should combine days, hours, and minutes', () => {
      const base = '2026-04-07T10:00:00Z';
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: base,
        gap_days: 1,
        gap_hours: 2,
        gap_minutes: 30,
        send_time: '10:00'
      });

      const baseDate = new Date(base);
      const scheduledDate = new Date(result.original_scheduled_at);
      const totalMinutes = (scheduledDate.getTime() - baseDate.getTime()) / (1000 * 60);

      // 1 day + 2 hours + 30 minutes = 24 + 2 + 0.5 = 26.5 hours = 1590 minutes
      expect(totalMinutes).toBeCloseTo(1590, 1);
    });
  });

  describe('timezone conversion', () => {
    it('should convert UTC to recipient timezone', () => {
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: '2026-04-07T14:00:00Z',
        gap_days: 0,
        send_time: '10:00'
      });

      expect(result.timezone_conversion.from_timezone).toBe('UTC');
      expect(result.timezone_conversion.to_timezone).toBe('America/New_York');
      expect(result.timezone_conversion.original_time).toBeDefined();
      expect(result.timezone_conversion.converted_time).toBeDefined();
    });

    it('should handle different timezones correctly', () => {
      const usResult = calculateSchedule({
        recipient_country: 'US',
        base_time: '2026-04-07T14:00:00Z',
        gap_days: 0,
        send_time: '10:00'
      });

      const inResult = calculateSchedule({
        recipient_country: 'IN',
        base_time: '2026-04-07T14:00:00Z',
        gap_days: 0,
        send_time: '10:00'
      });

      expect(usResult.timezone_conversion.to_timezone).not.toBe(
        inResult.timezone_conversion.to_timezone
      );
    });
  });

  describe('custom timezones', () => {
    it('should use custom timezone when provided', () => {
      const customTz = 'America/Los_Angeles';
      const result = calculateSchedule({
        recipient_country: 'US',
        recipient_timezone: customTz,
        base_time: '2026-04-07T10:00:00Z',
        gap_days: 0,
        send_time: '10:00'
      });

      expect(result.country_info.timezone).toBe(customTz);
    });

    it('should fallback to default timezone when custom not provided', () => {
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: '2026-04-07T10:00:00Z',
        gap_days: 0,
        send_time: '10:00'
      });

      expect(result.country_info.timezone).toBe('America/New_York');
    });
  });

  describe('adjustment tracking', () => {
    it('should track no adjustments when schedule is valid', () => {
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: '2026-04-07T14:00:00Z',
        gap_days: 0,
        send_time: '14:00'
      });

      expect(result.adjustments.length).toBeGreaterThan(0);
      expect(result.adjustments[0].type).toBe('none');
    });

    it('should track multiple adjustments if needed', () => {
      // This would need a specific case where both weekend and business hours apply
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: '2026-04-10T18:00:00Z',
        gap_days: 1,
        send_time: '19:00'
      });

      expect(result.adjustments.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle unknown country codes', () => {
      const result = calculateSchedule({
        recipient_country: 'XX',
        base_time: '2026-04-07T10:00:00Z',
        gap_days: 0,
        send_time: '10:00'
      });

      expect(result.country_info).toBeDefined();
      expect(result.adjusted_scheduled_at).toBeDefined();
    });

    it('should handle default send time', () => {
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: '2026-04-07T10:00:00Z',
        gap_days: 0
      });

      expect(result.adjusted_scheduled_at).toBeDefined();
    });

    it('should handle custom send time', () => {
      const customTime = '15:30';
      const result = calculateSchedule({
        recipient_country: 'US',
        base_time: '2026-04-07T10:00:00Z',
        gap_days: 0,
        send_time: customTime
      });

      expect(result.adjusted_scheduled_at).toBeDefined();
    });
  });
});
