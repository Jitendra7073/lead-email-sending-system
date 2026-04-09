/**
 * Timezone Detection Service
 *
 * Detects timezone information from various sources:
 * - Website domains (TLD to country mapping)
 * - Email addresses (domain extraction)
 * - Phone numbers (country code parsing)
 * - Database lookups
 */

import { executeQuery } from '@/lib/db/postgres';

/**
 * Contact information for timezone enrichment
 */
export interface ContactTimezoneInfo {
  email?: string;
  phone?: string;
  domain?: string;
  country_code?: string;
  timezone?: string;
}

/**
 * Timezone detection result
 */
export interface TimezoneDetectionResult {
  timezone: string;
  country_code: string;
  country_name: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'email' | 'phone' | 'domain' | 'database' | 'fallback';
}

/**
 * TLD to Country Code Mapping
 * Maps common top-level domains to their primary country codes
 */
const TLD_COUNTRY_MAP: Record<string, string> = {
  // Generic TLDs - use as fallback
  'com': 'US',
  'org': 'US',
  'net': 'US',
  'io': 'US',
  'co': 'US',

  // Country-specific TLDs
  'uk': 'GB',
  'us': 'US',
  'ca': 'CA',
  'au': 'AU',
  'in': 'IN',
  'de': 'DE',
  'fr': 'FR',
  'jp': 'JP',
  'sg': 'SG',
  'ae': 'AE',
  'nz': 'NZ',
  'za': 'ZA',
  'es': 'ES',
  'it': 'IT',
  'nl': 'NL',
  'se': 'SE',
  'no': 'NO',
  'dk': 'DK',
  'fi': 'FI',
  'ch': 'CH',
  'at': 'AT',
  'be': 'BE',
  'ie': 'IE',
  'pt': 'PT',
  'gr': 'GR',
  'pl': 'PL',
  'cz': 'CZ',
  'hu': 'HU',
  'ro': 'RO',
  'bg': 'BG',
  'hr': 'HR',
  'ru': 'RU',
  'ua': 'UA',
  'il': 'IL',
  'sa': 'SA',
  'qa': 'QA',
  'kw': 'QA',
  'bh': 'BH',
  'om': 'OM',
  'jo': 'JO',
  'lb': 'LB',
  'eg': 'EG',
  'ma': 'MA',
  'ng': 'NG',
  'ke': 'KE',
  'br': 'BR',
  'ar': 'AR',
  'cl': 'CL',
  'mx': 'MX',
  'pe': 'PE',
  've': 'VE',
  'cn': 'CN',
  'hk': 'HK',
  'tw': 'TW',
  'kr': 'KR',
  'th': 'TH',
  'my': 'MY',
  'id': 'ID',
  'ph': 'PH',
  'vn': 'VN',
  'bd': 'BD',
  'pk': 'PK',
  'lk': 'LK',
  'np': 'NP',
};

/**
 * Phone country code to country mapping
 */
const PHONE_COUNTRY_MAP: Record<string, string> = {
  '1': 'US', // USA/Canada
  '44': 'GB',
  '91': 'IN',
  '61': 'AU',
  '49': 'DE',
  '33': 'FR',
  '81': 'JP',
  '65': 'SG',
  '971': 'AE',
  '64': 'NZ',
  '27': 'ZA',
  '34': 'ES',
  '39': 'IT',
  '31': 'NL',
  '46': 'SE',
  '47': 'NO',
  '45': 'DK',
  '358': 'FI',
  '41': 'CH',
  '43': 'AT',
  '32': 'BE',
  '353': 'IE',
  '351': 'PT',
  '30': 'GR',
  '48': 'PL',
  '420': 'CZ',
  '36': 'HU',
  '40': 'RO',
  '359': 'BG',
  '385': 'HR',
  '7': 'RU',
  '380': 'UA',
  '972': 'IL',
  '966': 'SA',
  '974': 'QA',
  '965': 'KW',
  '973': 'BH',
  '968': 'OM',
  '962': 'JO',
  '961': 'LB',
  '20': 'EG',
  '212': 'MA',
  '254': 'KE',
  '234': 'NG',
  '55': 'BR',
  '54': 'AR',
  '56': 'CL',
  '57': 'CO',
  '52': 'MX',
  '51': 'PE',
  '58': 'VE',
  '86': 'CN',
  '852': 'HK',
  '886': 'TW',
  '82': 'KR',
  '66': 'TH',
  '60': 'MY',
  '62': 'ID',
  '63': 'PH',
  '84': 'VN',
  '880': 'BD',
  '92': 'PK',
  '94': 'LK',
  '977': 'NP',
};

/**
 * In-memory cache for timezone detections
 */
const timezoneCache = new Map<string, TimezoneDetectionResult>();

/**
 * Cache TTL in milliseconds (1 hour)
 */
const CACHE_TTL = 60 * 60 * 1000;

/**
 * Extract TLD from domain and map to country
 */
export function detectTimezoneFromWebsite(domain: string): TimezoneDetectionResult | null {
  try {
    if (!domain || typeof domain !== 'string') {
      return null;
    }

    // Clean domain: remove protocol, www, and path
    const cleanDomain = domain
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .split('/')[0]
      .toLowerCase();

    // Extract TLD (handle multi-level TLDs like co.uk)
    const parts = cleanDomain.split('.');
    let tld = parts[parts.length - 1];

    // Check for second-level TLDs (co.uk, com.au, etc.)
    if (parts.length >= 3 && ['co', 'com', 'ac', 'gov', 'edu'].includes(parts[parts.length - 2])) {
      tld = `${parts[parts.length - 2]}.${tld}`;
    }

    const countryCode = TLD_COUNTRY_MAP[tld];

    if (!countryCode) {
      return null;
    }

    return {
      timezone: '', // Will be filled by getCountryTimezone
      country_code: countryCode,
      country_name: '', // Will be filled by database
      confidence: tld === 'com' || tld === 'org' ? 'low' : 'medium',
      source: 'domain'
    };
  } catch (error) {
    console.error('Error detecting timezone from website:', error);
    return null;
  }
}

/**
 * Extract timezone from email domain
 */
export function detectTimezoneFromEmail(email: string): TimezoneDetectionResult | null {
  try {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return null;
    }

    const domain = email.split('@')[1].toLowerCase();
    return detectTimezoneFromWebsite(domain);
  } catch (error) {
    console.error('Error detecting timezone from email:', error);
    return null;
  }
}

/**
 * Parse phone number and detect country
 */
export function detectCountryFromPhone(phone: string): TimezoneDetectionResult | null {
  try {
    if (!phone || typeof phone !== 'string') {
      return null;
    }

    // Clean phone number: remove all non-digit characters except +
    const cleanPhone = phone.replace(/[^\d+]/g, '');

    // Remove leading + if present
    const phoneNumber = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone;

    // Try to match country code (longest first to handle overlapping codes)
    const sortedCodes = Object.keys(PHONE_COUNTRY_MAP).sort((a, b) => b.length - a.length);

    for (const code of sortedCodes) {
      if (phoneNumber.startsWith(code)) {
        const countryCode = PHONE_COUNTRY_MAP[code];
        return {
          timezone: '',
          country_code: countryCode,
          country_name: '',
          confidence: 'high',
          source: 'phone'
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error detecting country from phone:', error);
    return null;
  }
}

/**
 * Get timezone from database or use lookup
 */
export async function getCountryTimezone(countryCode: string): Promise<TimezoneDetectionResult | null> {
  try {
    const cacheKey = `country_${countryCode}`;

    // Check cache first
    const cached = timezoneCache.get(cacheKey);
    if (cached && Date.now() - (cached as any).timestamp < CACHE_TTL) {
      return cached;
    }

    // Query database
    const result = await executeQuery(
      `SELECT
        country_code,
        country_name,
        default_timezone as timezone,
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
      const detectionResult: TimezoneDetectionResult = {
        timezone: row.timezone,
        country_code: row.country_code,
        country_name: row.country_name,
        confidence: 'high',
        source: 'database',
        ...(cached as any) // Preserve timestamp if updating cache
      };

      // Add timestamp for cache TTL
      (detectionResult as any).timestamp = Date.now();
      timezoneCache.set(cacheKey, detectionResult);

      return detectionResult;
    }

    return null;
  } catch (error) {
    console.error('Error getting country timezone:', error);
    return null;
  }
}

/**
 * Enrich contact with timezone information using multiple detection methods
 */
export async function enrichContactTimezone(contact: ContactTimezoneInfo): Promise<TimezoneDetectionResult | null> {
  try {
    let detectionResult: TimezoneDetectionResult | null = null;

    // Priority 1: Use explicit country code if provided
    if (contact.country_code) {
      const result = await getCountryTimezone(contact.country_code);
      if (result) {
        detectionResult = { ...result, confidence: 'high' };
      }
    }

    // Priority 2: Phone number (highest confidence)
    if (!detectionResult && contact.phone) {
      const phoneResult = detectCountryFromPhone(contact.phone);
      if (phoneResult) {
        const timezoneData = await getCountryTimezone(phoneResult.country_code);
        if (timezoneData) {
          detectionResult = { ...timezoneData, source: 'phone', confidence: 'high' };
        }
      }
    }

    // Priority 3: Email domain
    if (!detectionResult && contact.email) {
      const emailResult = detectTimezoneFromEmail(contact.email);
      if (emailResult) {
        const timezoneData = await getCountryTimezone(emailResult.country_code);
        if (timezoneData) {
          detectionResult = { ...timezoneData, source: 'email', confidence: 'medium' };
        }
      }
    }

    // Priority 4: Website domain
    if (!detectionResult && contact.domain) {
      const domainResult = detectTimezoneFromWebsite(contact.domain);
      if (domainResult) {
        const timezoneData = await getCountryTimezone(domainResult.country_code);
        if (timezoneData) {
          detectionResult = { ...timezoneData, source: 'domain', confidence: 'medium' };
        }
      }
    }

    // Fallback: Use US/Eastern if no detection worked
    if (!detectionResult) {
      detectionResult = {
        timezone: 'America/New_York',
        country_code: 'US',
        country_name: 'United States',
        confidence: 'low',
        source: 'fallback'
      };
    }

    return detectionResult;
  } catch (error) {
    console.error('Error enriching contact timezone:', error);
    return null;
  }
}

/**
 * Clear timezone cache (useful for testing or forced refresh)
 */
export function clearTimezoneCache(): void {
  timezoneCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: timezoneCache.size,
    keys: Array.from(timezoneCache.keys())
  };
}
