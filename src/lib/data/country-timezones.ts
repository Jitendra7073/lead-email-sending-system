/**
 * Comprehensive Country Timezone Configuration
 *
 * Provides timezone and business hours data for 50+ countries worldwide.
 * Used for timezone-aware email scheduling to ensure emails are sent during
 * local business hours and avoid weekends.
 *
 * Weekend Patterns:
 * - Standard: ['Saturday', 'Sunday'] - Most Western countries
 * - Middle East: ['Friday', 'Saturday'] - Muslim-majority countries
 * - India: ['Sunday'] only - Single day weekend
 * - Mixed: Various regional patterns
 */

export interface CountryTimezone {
  /** ISO 3166-1 alpha-2 country code */
  country_code: string;
  /** Full country name */
  country_name: string;
  /** IANA timezone identifier (e.g., 'America/New_York') */
  default_timezone: string;
  /** Business hours start (HH:MM format) */
  business_hours_start: string;
  /** Business hours end (HH:MM format) */
  business_hours_end: string;
  /** Weekend day names (must match JavaScript Date.toLocaleString('en-US', { weekday: 'long' })) */
  weekend_days: string[];
}

/**
 * Comprehensive timezone data for 50+ countries
 * Organized by region for better maintainability
 */
export const COUNTRY_TIMEZONES: CountryTimezone[] = [
  // ==================== NORTH AMERICA ====================
  {
    country_code: 'US',
    country_name: 'United States',
    default_timezone: 'America/New_York',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'CA',
    country_name: 'Canada',
    default_timezone: 'America/Toronto',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'MX',
    country_name: 'Mexico',
    default_timezone: 'America/Mexico_City',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },

  // ==================== EUROPE ====================
  {
    country_code: 'GB',
    country_name: 'United Kingdom',
    default_timezone: 'Europe/London',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'DE',
    country_name: 'Germany',
    default_timezone: 'Europe/Berlin',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'FR',
    country_name: 'France',
    default_timezone: 'Europe/Paris',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'IT',
    country_name: 'Italy',
    default_timezone: 'Europe/Rome',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'ES',
    country_name: 'Spain',
    default_timezone: 'Europe/Madrid',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'NL',
    country_name: 'Netherlands',
    default_timezone: 'Europe/Amsterdam',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'CH',
    country_name: 'Switzerland',
    default_timezone: 'Europe/Zurich',
    business_hours_start: '08:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'AT',
    country_name: 'Austria',
    default_timezone: 'Europe/Vienna',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'BE',
    country_name: 'Belgium',
    default_timezone: 'Europe/Brussels',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'PL',
    country_name: 'Poland',
    default_timezone: 'Europe/Warsaw',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'SE',
    country_name: 'Sweden',
    default_timezone: 'Europe/Stockholm',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'NO',
    country_name: 'Norway',
    default_timezone: 'Europe/Oslo',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'DK',
    country_name: 'Denmark',
    default_timezone: 'Europe/Copenhagen',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'FI',
    country_name: 'Finland',
    default_timezone: 'Europe/Helsinki',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'GR',
    country_name: 'Greece',
    default_timezone: 'Europe/Athens',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'PT',
    country_name: 'Portugal',
    default_timezone: 'Europe/Lisbon',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'IE',
    country_name: 'Ireland',
    default_timezone: 'Europe/Dublin',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'TR',
    country_name: 'Turkey',
    default_timezone: 'Europe/Istanbul',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'RU',
    country_name: 'Russia',
    default_timezone: 'Europe/Moscow',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },

  // ==================== ASIA ====================
  {
    country_code: 'IN',
    country_name: 'India',
    default_timezone: 'Asia/Kolkata',
    business_hours_start: '10:00',
    business_hours_end: '19:00',
    weekend_days: ['Sunday'] // Only Sunday is weekend
  },
  {
    country_code: 'SG',
    country_name: 'Singapore',
    default_timezone: 'Asia/Singapore',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'MY',
    country_name: 'Malaysia',
    default_timezone: 'Asia/Kuala_Lumpur',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'TH',
    country_name: 'Thailand',
    default_timezone: 'Asia/Bangkok',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'PH',
    country_name: 'Philippines',
    default_timezone: 'Asia/Manila',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'ID',
    country_name: 'Indonesia',
    default_timezone: 'Asia/Jakarta',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'VN',
    country_name: 'Vietnam',
    default_timezone: 'Asia/Ho_Chi_Minh',
    business_hours_start: '08:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'HK',
    country_name: 'Hong Kong',
    default_timezone: 'Asia/Hong_Kong',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'JP',
    country_name: 'Japan',
    default_timezone: 'Asia/Tokyo',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'KR',
    country_name: 'South Korea',
    default_timezone: 'Asia/Seoul',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'CN',
    country_name: 'China',
    default_timezone: 'Asia/Shanghai',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'TW',
    country_name: 'Taiwan',
    default_timezone: 'Asia/Taipei',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },

  // ==================== MIDDLE EAST ====================
  {
    country_code: 'SA',
    country_name: 'Saudi Arabia',
    default_timezone: 'Asia/Riyadh',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Friday', 'Saturday'] // Friday-Saturday weekend
  },
  {
    country_code: 'AE',
    country_name: 'United Arab Emirates',
    default_timezone: 'Asia/Dubai',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Friday', 'Saturday'] // Friday-Saturday weekend
  },
  {
    country_code: 'QA',
    country_name: 'Qatar',
    default_timezone: 'Asia/Qatar',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Friday', 'Saturday'] // Friday-Saturday weekend
  },
  {
    country_code: 'KW',
    country_name: 'Kuwait',
    default_timezone: 'Asia/Kuwait',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Friday', 'Saturday'] // Friday-Saturday weekend
  },
  {
    country_code: 'BH',
    country_name: 'Bahrain',
    default_timezone: 'Asia/Bahrain',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Friday', 'Saturday'] // Friday-Saturday weekend
  },
  {
    country_code: 'OM',
    country_name: 'Oman',
    default_timezone: 'Asia/Muscat',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Friday', 'Saturday'] // Friday-Saturday weekend
  },
  {
    country_code: 'JO',
    country_name: 'Jordan',
    default_timezone: 'Asia/Amman',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Friday', 'Saturday'] // Friday-Saturday weekend
  },
  {
    country_code: 'LB',
    country_name: 'Lebanon',
    default_timezone: 'Asia/Beirut',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday'] // Some companies use Sat-Sun
  },
  {
    country_code: 'EG',
    country_name: 'Egypt',
    default_timezone: 'Africa/Cairo',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Friday', 'Saturday'] // Friday-Saturday weekend
  },
  {
    country_code: 'IL',
    country_name: 'Israel',
    default_timezone: 'Asia/Jerusalem',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Friday', 'Saturday'] // Friday-Saturday weekend
  },

  // ==================== OCEANIA ====================
  {
    country_code: 'AU',
    country_name: 'Australia',
    default_timezone: 'Australia/Sydney',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'NZ',
    country_name: 'New Zealand',
    default_timezone: 'Pacific/Auckland',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },

  // ==================== SOUTH AMERICA ====================
  {
    country_code: 'BR',
    country_name: 'Brazil',
    default_timezone: 'America/Sao_Paulo',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'AR',
    country_name: 'Argentina',
    default_timezone: 'America/Argentina/Buenos_Aires',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    weekend_days: ['Saturday', 'Sunday']
  },

  // ==================== AFRICA ====================
  {
    country_code: 'ZA',
    country_name: 'South Africa',
    default_timezone: 'Africa/Johannesburg',
    business_hours_start: '08:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'NG',
    country_name: 'Nigeria',
    default_timezone: 'Africa/Lagos',
    business_hours_start: '08:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  },
  {
    country_code: 'KE',
    country_name: 'Kenya',
    default_timezone: 'Africa/Nairobi',
    business_hours_start: '08:00',
    business_hours_end: '17:00',
    weekend_days: ['Saturday', 'Sunday']
  }
];

/**
 * Get timezone configuration by country code
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns Country timezone configuration or undefined if not found
 */
export function getCountryTimezone(countryCode: string): CountryTimezone | undefined {
  return COUNTRY_TIMEZONES.find(
    country => country.country_code.toLowerCase() === countryCode.toLowerCase()
  );
}

/**
 * Get all country codes
 * @returns Array of all country codes
 */
export function getAllCountryCodes(): string[] {
  return COUNTRY_TIMEZONES.map(country => country.country_code);
}

/**
 * Get countries by weekend pattern
 * @param weekendDays Array of weekend days to filter by
 * @returns Countries matching the weekend pattern
 */
export function getCountriesByWeekendPattern(weekendDays: string[]): CountryTimezone[] {
  return COUNTRY_TIMEZONES.filter(country => {
    // Compare sorted arrays for equality
    const countryWeekends = [...country.weekend_days].sort();
    const targetWeekends = [...weekendDays].sort();
    return (
      countryWeekends.length === targetWeekends.length &&
      countryWeekends.every((day, index) => day === targetWeekends[index])
    );
  });
}

/**
 * Weekend pattern constants for easy reference
 */
export const WEEKEND_PATTERNS = {
  STANDARD: ['Saturday', 'Sunday'], // Most Western countries
  MIDDLE_EAST: ['Friday', 'Saturday'], // Muslim-majority countries
  INDIA: ['Sunday'], // India only
  MIXED: ['Saturday', 'Sunday'] // Default fallback
} as const;
