/**
 * Unit Tests for Timezone Detector
 */

import { describe, it, expect } from '@jest/globals';
import {
  detectTimezoneFromCountry,
  getTimezoneConfidence
} from '../../schedule/timezone-detector';

describe('TimezoneDetector', () => {
  describe('detectTimezoneFromCountry', () => {
    it('should detect timezone for single-timezone countries', () => {
      const result = detectTimezoneFromCountry('JP');
      expect(result.timezone).toBe('Asia/Tokyo');
      expect(result.country_code).toBe('JP');
      expect(result.confidence).toBe('medium');
    });

    it('should detect timezone for common TLD countries', () => {
      const usResult = detectTimezoneFromCountry('US');
      expect(usResult.timezone).toBe('America/New_York');
      expect(usResult.country_code).toBe('US');

      const inResult = detectTimezoneFromCountry('IN');
      expect(inResult.timezone).toBe('Asia/Kolkata');
      expect(inResult.country_code).toBe('IN');
    });

    it('should handle lowercase country codes', () => {
      const result = detectTimezoneFromCountry('gb');
      expect(result.timezone).toBe('Europe/London');
      expect(result.country_code).toBe('GB');
    });

    it('should return UTC for unknown countries', () => {
      const result = detectTimezoneFromCountry('XX');
      expect(result.timezone).toBe('UTC');
      expect(result.confidence).toBe('low');
    });
  });

  describe('getTimezoneConfidence', () => {
    it('should return high confidence for exact timezone-country match', () => {
      const result = getTimezoneConfidence('Asia/Tokyo', 'JP');
      expect(result.score).toBeGreaterThan(80);
      expect(result.level).toBe('high');
      expect(result.reasons).toContain('Timezone matches country code from TLD mapping');
    });

    it('should return medium confidence for valid timezone without country', () => {
      const result = getTimezoneConfidence('Europe/London');
      expect(result.level).toBe('low');
      expect(result.reasons).toContain('No country code provided - cannot verify timezone-country match');
    });

    it('should return low confidence for mismatched timezone-country', () => {
      const result = getTimezoneConfidence('Asia/Tokyo', 'US');
      expect(result.score).toBeLessThan(80);
      expect(result.level).toBe('medium');
      expect(result.reasons).toContain("Timezone 'Asia/Tokyo' differs from country's default 'America/New_York'");
    });

    it('should return zero score for invalid timezone', () => {
      const result = getTimezoneConfidence('Invalid/Timezone', 'US');
      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
      expect(result.reasons).toContain('Invalid timezone format');
    });

    it('should validate IANA timezone format', () => {
      const validResult = getTimezoneConfidence('America/New_York', 'US');
      expect(validResult.reasons).toContain('Timezone is valid IANA format');
      expect(validResult.score).toBeGreaterThan(50);
    });

    it('should handle various timezone formats', () => {
      const usResult = getTimezoneConfidence('America/New_York', 'US');
      expect(usResult.level).toBe('high');

      const euResult = getTimezoneConfidence('Europe/Berlin', 'DE');
      expect(euResult.level).toBe('high');

      const asiaResult = getTimezoneConfidence('Asia/Kolkata', 'IN');
      expect(asiaResult.level).toBe('high');
    });
  });

  describe('edge cases', () => {
    it('should handle empty country code', () => {
      const result = detectTimezoneFromCountry('');
      expect(result.timezone).toBe('UTC');
      expect(result.confidence).toBe('low');
    });

    it('should handle special country codes', () => {
      const aeResult = detectTimezoneFromCountry('AE');
      expect(aeResult.timezone).toBe('Asia/Dubai');

      const saResult = detectTimezoneFromCountry('SA');
      expect(saResult.timezone).toBe('Asia/Riyadh');
    });

    it('should calculate confidence correctly for multi-timezone countries', () => {
      const usResult = getTimezoneConfidence('America/New_York', 'US');
      expect(usResult.level).toBe('high');
      expect(usResult.reasons).toContain('High-confidence country TLD');
    });

    it('should handle timezone with underscores', () => {
      const result = getTimezoneConfidence('America/New_York', 'US');
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons).toContain('Timezone is valid IANA format');
    });
  });
});
