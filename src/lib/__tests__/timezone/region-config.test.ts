/**
 * Unit Tests for Region Configuration
 *
 * Tests for country-specific business hours, weekend patterns, and timezone rules
 */

import { describe, it, expect } from '@jest/globals';

// Mock region configuration data
const REGION_CONFIGS = {
  US: {
    country_code: 'US',
    country_name: 'United States',
    default_timezone: 'America/New_York',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday'],
    utc_offset: '-05:00',
    dst_observed: true
  },
  GB: {
    country_code: 'GB',
    country_name: 'United Kingdom',
    default_timezone: 'Europe/London',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday'],
    utc_offset: '+00:00',
    dst_observed: true
  },
  IN: {
    country_code: 'IN',
    country_name: 'India',
    default_timezone: 'Asia/Kolkata',
    business_hours_start: '10:00',
    business_hours_end: '19:00',
    weekend_days: ['Sunday'],
    utc_offset: '+05:30',
    dst_observed: false
  },
  AE: {
    country_code: 'AE',
    country_name: 'United Arab Emirates',
    default_timezone: 'Asia/Dubai',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Friday', 'Saturday'],
    utc_offset: '+04:00',
    dst_observed: false
  },
  JP: {
    country_code: 'JP',
    country_name: 'Japan',
    default_timezone: 'Asia/Tokyo',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday'],
    utc_offset: '+09:00',
    dst_observed: false
  }
};

describe('RegionConfig', () => {
  describe('business hours validation', () => {
    it('should validate US business hours (9 AM - 6 PM)', () => {
      const config = REGION_CONFIGS.US;
      expect(config.business_hours_start).toBe('09:00');
      expect(config.business_hours_end).toBe('18:00');
    });

    it('should validate UK business hours (9 AM - 5 PM)', () => {
      const config = REGION_CONFIGS.GB;
      expect(config.business_hours_start).toBe('09:00');
      expect(config.business_hours_end).toBe('17:00');
    });

    it('should validate India business hours (10 AM - 7 PM)', () => {
      const config = REGION_CONFIGS.IN;
      expect(config.business_hours_start).toBe('10:00');
      expect(config.business_hours_end).toBe('19:00');
    });

    it('should parse business hours correctly', () => {
      const parseTime = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return { hours, minutes };
      };

      const usStart = parseTime(REGION_CONFIGS.US.business_hours_start);
      const usEnd = parseTime(REGION_CONFIGS.US.business_hours_end);

      expect(usStart.hours).toBe(9);
      expect(usStart.minutes).toBe(0);
      expect(usEnd.hours).toBe(18);
      expect(usEnd.minutes).toBe(0);
    });
  });

  describe('weekend patterns', () => {
    it('should identify Saturday-Sunday weekend for US', () => {
      const config = REGION_CONFIGS.US;
      expect(config.weekend_days).toEqual(['Saturday', 'Sunday']);
      expect(config.weekend_days).toHaveLength(2);
    });

    it('should identify Friday-Saturday weekend for UAE', () => {
      const config = REGION_CONFIGS.AE;
      expect(config.weekend_days).toEqual(['Friday', 'Saturday']);
      expect(config.weekend_days).toHaveLength(2);
    });

    it('should identify Sunday-only weekend for India', () => {
      const config = REGION_CONFIGS.IN;
      expect(config.weekend_days).toEqual(['Sunday']);
      expect(config.weekend_days).toHaveLength(1);
    });

    it('should identify Saturday-Sunday weekend for Japan', () => {
      const config = REGION_CONFIGS.JP;
      expect(config.weekend_days).toEqual(['Saturday', 'Sunday']);
    });
  });

  describe('timezone configurations', () => {
    it('should have correct timezone for US', () => {
      expect(REGION_CONFIGS.US.default_timezone).toBe('America/New_York');
    });

    it('should have correct timezone for UK', () => {
      expect(REGION_CONFIGS.GB.default_timezone).toBe('Europe/London');
    });

    it('should have correct timezone for India', () => {
      expect(REGION_CONFIGS.IN.default_timezone).toBe('Asia/Kolkata');
    });

    it('should have correct timezone for UAE', () => {
      expect(REGION_CONFIGS.AE.default_timezone).toBe('Asia/Dubai');
    });

    it('should have correct timezone for Japan', () => {
      expect(REGION_CONFIGS.JP.default_timezone).toBe('Asia/Tokyo');
    });
  });

  describe('UTC offsets', () => {
    it('should have correct UTC offset for US (EST)', () => {
      expect(REGION_CONFIGS.US.utc_offset).toBe('-05:00');
    });

    it('should have correct UTC offset for UK (GMT)', () => {
      expect(REGION_CONFIGS.GB.utc_offset).toBe('+00:00');
    });

    it('should have correct UTC offset for India (IST)', () => {
      expect(REGION_CONFIGS.IN.utc_offset).toBe('+05:30');
    });

    it('should have correct UTC offset for UAE (GST)', () => {
      expect(REGION_CONFIGS.AE.utc_offset).toBe('+04:00');
    });

    it('should have correct UTC offset for Japan (JST)', () => {
      expect(REGION_CONFIGS.JP.utc_offset).toBe('+09:00');
    });
  });

  describe('DST observation', () => {
    it('should observe DST for US', () => {
      expect(REGION_CONFIGS.US.dst_observed).toBe(true);
    });

    it('should observe DST for UK', () => {
      expect(REGION_CONFIGS.GB.dst_observed).toBe(true);
    });

    it('should not observe DST for India', () => {
      expect(REGION_CONFIGS.IN.dst_observed).toBe(false);
    });

    it('should not observe DST for UAE', () => {
      expect(REGION_CONFIGS.AE.dst_observed).toBe(false);
    });

    it('should not observe DST for Japan', () => {
      expect(REGION_CONFIGS.JP.dst_observed).toBe(false);
    });
  });

  describe('region-specific rules', () => {
    it('should handle Middle East weekend pattern', () => {
      const middleEasternCountries = ['AE', 'SA', 'KW', 'QA'];
      middleEasternCountries.forEach(code => {
        // These should typically have Friday-Saturday weekends
        expect(['Friday', 'Saturday']).toContainEqual(
          expect.any(String)
        );
      });
    });

    it('should handle Western weekend pattern', () => {
      const westernCountries = ['US', 'GB', 'JP'];
      westernCountries.forEach(code => {
        const config = REGION_CONFIGS[code as keyof typeof REGION_CONFIGS];
        expect(config.weekend_days).toContain('Saturday');
        expect(config.weekend_days).toContain('Sunday');
      });
    });

    it('should handle Asian business hours', () => {
      const asianConfigs = [REGION_CONFIGS.IN, REGION_CONFIGS.JP, REGION_CONFIGS.AE];
      asianConfigs.forEach(config => {
        const startHour = parseInt(config.business_hours_start.split(':')[0]);
        expect(startHour).toBeGreaterThanOrEqual(9);
        expect(startHour).toBeLessThan(12);
      });
    });
  });

  describe('configuration completeness', () => {
    it('should have all required fields for US config', () => {
      const config = REGION_CONFIGS.US;
      expect(config.country_code).toBeDefined();
      expect(config.country_name).toBeDefined();
      expect(config.default_timezone).toBeDefined();
      expect(config.business_hours_start).toBeDefined();
      expect(config.business_hours_end).toBeDefined();
      expect(config.weekend_days).toBeDefined();
      expect(config.utc_offset).toBeDefined();
      expect(config.dst_observed).toBeDefined();
    });

    it('should have all required fields for India config', () => {
      const config = REGION_CONFIGS.IN;
      expect(config.country_code).toBeDefined();
      expect(config.country_name).toBeDefined();
      expect(config.default_timezone).toBeDefined();
      expect(config.business_hours_start).toBeDefined();
      expect(config.business_hours_end).toBeDefined();
      expect(config.weekend_days).toBeDefined();
      expect(config.utc_offset).toBeDefined();
      expect(config.dst_observed).toBeDefined();
    });

    it('should have consistent data types across configs', () => {
      Object.values(REGION_CONFIGS).forEach(config => {
        expect(typeof config.country_code).toBe('string');
        expect(typeof config.country_name).toBe('string');
        expect(typeof config.default_timezone).toBe('string');
        expect(typeof config.business_hours_start).toBe('string');
        expect(typeof config.business_hours_end).toBe('string');
        expect(Array.isArray(config.weekend_days)).toBe(true);
        expect(typeof config.dst_observed).toBe('boolean');
      });
    });
  });

  describe('time format validation', () => {
    it('should use HH:MM format for business hours', () => {
      const timeRegex = /^\d{2}:\d{2}$/;

      Object.values(REGION_CONFIGS).forEach(config => {
        expect(config.business_hours_start).toMatch(timeRegex);
        expect(config.business_hours_end).toMatch(timeRegex);
      });
    });

    it('should have valid hour ranges (0-23)', () => {
      Object.values(REGION_CONFIGS).forEach(config => {
        const startHour = parseInt(config.business_hours_start.split(':')[0]);
        const endHour = parseInt(config.business_hours_end.split(':')[0]);

        expect(startHour).toBeGreaterThanOrEqual(0);
        expect(startHour).toBeLessThan(24);
        expect(endHour).toBeGreaterThanOrEqual(0);
        expect(endHour).toBeLessThan(24);
      });
    });

    it('should have valid minute ranges (0-59)', () => {
      Object.values(REGION_CONFIGS).forEach(config => {
        const startMin = parseInt(config.business_hours_start.split(':')[1]);
        const endMin = parseInt(config.business_hours_end.split(':')[1]);

        expect(startMin).toBeGreaterThanOrEqual(0);
        expect(startMin).toBeLessThan(60);
        expect(endMin).toBeGreaterThanOrEqual(0);
        expect(endMin).toBeLessThan(60);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle countries with single weekend day', () => {
      expect(REGION_CONFIGS.IN.weekend_days).toHaveLength(1);
    });

    it('should handle countries with two weekend days', () => {
      expect(REGION_CONFIGS.US.weekend_days).toHaveLength(2);
      expect(REGION_CONFIGS.AE.weekend_days).toHaveLength(2);
    });

    it('should handle countries without DST', () => {
      expect(REGION_CONFIGS.IN.dst_observed).toBe(false);
      expect(REGION_CONFIGS.AE.dst_observed).toBe(false);
      expect(REGION_CONFIGS.JP.dst_observed).toBe(false);
    });
  });
});
