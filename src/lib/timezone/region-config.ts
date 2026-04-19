/**
 * Region Configuration Service
 *
 * Provides country-specific business rules for email scheduling:
 * - Weekend days
 * - Business hours
 * - Timezone information
 */

import { toZonedTime } from 'date-fns-tz';
import { getDay, addDays, setHours, setMinutes } from 'date-fns';

/**
 * Country configuration interface
 */
export interface CountryConfig {
  country_code: string;
  country_name: string;
  default_timezone: string;
  business_hours_start: string; // HH:mm format
  business_hours_end: string;   // HH:mm format
  weekend_days: string[];        // ['Saturday', 'Sunday'] or ['Friday', 'Saturday']
}

/**
 * Region configuration with metadata
 */
export interface RegionConfig extends CountryConfig {
  confidence: 'high' | 'medium' | 'low';
  source: 'database' | 'fallback';
}

/**
 * Parse time string (HH:mm) to hours and minutes
 */
function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Get region configuration from database or fallback
 */
export async function getRegionConfig(countryCode: string): Promise<RegionConfig | null> {
  try {
    const { executeQuery } = await import('@/lib/db/postgres');

    // Query database
    const result = await executeQuery(
      `SELECT
        country_code,
        country_name,
        default_timezone,
        business_hours_start,
        business_hours_end,
        weekend_days
       FROM country_timezones
       WHERE country_code = $1
       LIMIT 1`,
      [countryCode.toUpperCase()]
    );

    if (result.length > 0) {
      const row = result[0];
      // weekend_days may be stored as a comma-separated string or already an array
      const weekendDays: string[] = Array.isArray(row.weekend_days)
        ? row.weekend_days
        : (typeof row.weekend_days === 'string'
          ? row.weekend_days.split(',').map((d: string) => d.trim()).filter(Boolean)
          : ['Saturday', 'Sunday']);

      return {
        country_code: row.country_code,
        country_name: row.country_name,
        default_timezone: row.default_timezone,
        business_hours_start: row.business_hours_start,
        business_hours_end: row.business_hours_end,
        weekend_days: weekendDays,
        confidence: 'high',
        source: 'database'
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting region config:', error);
    return null;
  }
}

/**
 * Get default region configuration (US fallback)
 */
export function getDefaultRegionConfig(): RegionConfig {
  return {
    country_code: 'US',
    country_name: 'United States',
    default_timezone: 'America/New_York',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday'],
    confidence: 'low',
    source: 'fallback'
  };
}

/**
 * Check if a date falls on a weekend based on country-specific weekend days
 */
export function isWeekend(date: Date, timezone: string, weekendDays: string[]): boolean {
  try {
    const zonedDate = toZonedTime(date, timezone);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[getDay(zonedDate)];
    return weekendDays.includes(dayName);
  } catch (error) {
    console.error('Error checking weekend:', error);
    return false;
  }
}

/**
 * Check if a time is within business hours
 * Compares both hours AND minutes correctly
 */
export function isBusinessHours(
  date: Date,
  timezone: string,
  businessHoursStart: string,
  businessHoursEnd: string
): boolean {
  try {
    const zonedDate = toZonedTime(date, timezone);
    const { hours: startHour, minutes: startMinute } = parseTimeString(businessHoursStart);
    const { hours: endHour, minutes: endMinute } = parseTimeString(businessHoursEnd);

    // Convert to total minutes for accurate comparison
    const currentMinutes = zonedDate.getHours() * 60 + zonedDate.getMinutes();
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch (error) {
    console.error('Error checking business hours:', error);
    return true; // Assume valid if check fails
  }
}

/**
 * Get the next business day (skip weekends)
 */
export function getNextBusinessDay(date: Date, timezone: string, weekendDays: string[]): Date {
  try {
    const zonedDate = toZonedTime(date, timezone);
    let nextDay = addDays(zonedDate, 1);

    // Keep adding days until we find a non-weekend day
    while (isWeekend(nextDay, timezone, weekendDays)) {
      nextDay = addDays(nextDay, 1);
    }

    return nextDay;
  } catch (error) {
    console.error('Error getting next business day:', error);
    return date;
  }
}

/**
 * Adjust date to specific business hours
 */
export function adjustToBusinessHours(
  date: Date,
  timezone: string,
  hour: number,
  minute: number
): Date {
  try {
    const zonedDate = toZonedTime(date, timezone);
    return setMinutes(setHours(zonedDate, hour), minute);
  } catch (error) {
    console.error('Error adjusting to business hours:', error);
    return date;
  }
}

/**
 * Get business hours for a specific day
 * Accounts for half-days or special schedules
 */
export async function getBusinessHoursForDate(
  date: Date,
  countryCode: string
): Promise<{ start: string; end: string } | null> {
  try {
    const config = await getRegionConfig(countryCode);

    if (!config) {
      return null;
    }

    // Check if it's a weekend
    if (isWeekend(date, config.default_timezone, config.weekend_days)) {
      return null; // No business hours on weekends
    }

    // Standard business hours
    return {
      start: config.business_hours_start,
      end: config.business_hours_end
    };
  } catch (error) {
    console.error('Error getting business hours for date:', error);
    return null;
  }
}

/**
 * Validate if a given date/time is valid for sending emails
 */
export async function isValidSendTime(
  date: Date,
  countryCode: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const config = await getRegionConfig(countryCode);

    if (!config) {
      return { valid: true }; // Assume valid if no config found
    }

    // Check weekend
    if (isWeekend(date, config.default_timezone, config.weekend_days)) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const zonedDate = toZonedTime(date, config.default_timezone);
      const dayName = dayNames[getDay(zonedDate)];

      return {
        valid: false,
        reason: `Date falls on ${dayName} (weekend in ${config.country_name})`
      };
    }

    // Check business hours
    if (!isBusinessHours(date, config.default_timezone, config.business_hours_start, config.business_hours_end)) {
      const zonedDate = toZonedTime(date, config.default_timezone);
      const currentHour = zonedDate.getHours();

      return {
        valid: false,
        reason: `Time ${currentHour}:00 is outside business hours (${config.business_hours_start}-${config.business_hours_end})`
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('Error validating send time:', error);
    return { valid: true }; // Assume valid if validation fails
  }
}

/**
 * Get all countries with their configurations
 */
export async function getAllCountryConfigs(): Promise<RegionConfig[]> {
  try {
    const { executeQuery } = await import('@/lib/db/postgres');

    const result = await executeQuery(
      `SELECT
        country_code,
        country_name,
        default_timezone,
        business_hours_start,
        business_hours_end,
        weekend_days
       FROM country_timezones
       ORDER BY country_name`
    );

    return result.map((row: any) => ({
      country_code: row.country_code,
      country_name: row.country_name,
      default_timezone: row.default_timezone,
      business_hours_start: row.business_hours_start,
      business_hours_end: row.business_hours_end,
      weekend_days: row.weekend_days,
      confidence: 'high' as const,
      source: 'database' as const
    }));
  } catch (error) {
    console.error('Error getting all country configs:', error);
    return [];
  }
}

/**
 * Search countries by name or code
 */
export async function searchCountries(query: string): Promise<RegionConfig[]> {
  try {
    const { executeQuery } = await import('@/lib/db/postgres');

    const result = await executeQuery(
      `SELECT
        country_code,
        country_name,
        default_timezone,
        business_hours_start,
        business_hours_end,
        weekend_days
       FROM country_timezones
       WHERE country_code ILIKE $1
          OR country_name ILIKE $1
       ORDER BY country_name
       LIMIT 10`,
      [`%${query}%`]
    );

    return result.map((row: any) => ({
      country_code: row.country_code,
      country_name: row.country_name,
      default_timezone: row.default_timezone,
      business_hours_start: row.business_hours_start,
      business_hours_end: row.business_hours_end,
      weekend_days: row.weekend_days,
      confidence: 'high' as const,
      source: 'database' as const
    }));
  } catch (error) {
    console.error('Error searching countries:', error);
    return [];
  }
}
