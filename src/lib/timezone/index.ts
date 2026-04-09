/**
 * Timezone Detection and Region Configuration
 * Main export file for timezone utilities
 */

export {
  detectTimezoneFromWebsite,
  detectTimezoneFromEmail,
  detectCountryFromPhone,
  getCountryTimezone,
  enrichContactTimezone,
  clearTimezoneCache,
  getCacheStats,
  type TimezoneDetectionResult,
  type ContactTimezoneInfo
} from './timezone-detector';

export {
  getRegionConfig,
  getDefaultRegionConfig,
  isWeekend,
  isBusinessHours,
  getNextBusinessDay,
  adjustToBusinessHours,
  getBusinessHoursForDate,
  isValidSendTime,
  getAllCountryConfigs,
  searchCountries,
  type CountryConfig,
  type RegionConfig
} from './region-config';
