/**
 * Timezone Detection Service
 *
 * Detects timezone from email domain or website URL
 * with fallback to country code
 */

import { executeQuery } from '@/lib/db/postgres';

export interface TimezoneDetectionResult {
  timezone: string;
  country_code: string;
  country_name: string;
  detection_method: 'domain' | 'website' | 'country_fallback' | 'default';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Top-level domain (TLD) to timezone mapping
 */
const TLD_TIMEZONE_MAP: Record<string, { timezone: string; country_code: string }> = {
  '.us': { timezone: 'America/New_York', country_code: 'US' },
  '.uk': { timezone: 'Europe/London', country_code: 'GB' },
  '.in': { timezone: 'Asia/Kolkata', country_code: 'IN' },
  '.ca': { timezone: 'America/Toronto', country_code: 'CA' },
  '.au': { timezone: 'Australia/Sydney', country_code: 'AU' },
  '.de': { timezone: 'Europe/Berlin', country_code: 'DE' },
  '.fr': { timezone: 'Europe/Paris', country_code: 'FR' },
  '.jp': { timezone: 'Asia/Tokyo', country_code: 'JP' },
  '.sg': { timezone: 'Asia/Singapore', country_code: 'SG' },
  '.ae': { timezone: 'Asia/Dubai', country_code: 'AE' },
  '.br': { timezone: 'America/Sao_Paulo', country_code: 'BR' },
  '.mx': { timezone: 'America/Mexico_City', country_code: 'MX' },
  '.za': { timezone: 'Africa/Johannesburg', country_code: 'ZA' },
  '.nz': { timezone: 'Pacific/Auckland', country_code: 'NZ' },
  '.kr': { timezone: 'Asia/Seoul', country_code: 'KR' },
  '.cn': { timezone: 'Asia/Shanghai', country_code: 'CN' },
  '.it': { timezone: 'Europe/Rome', country_code: 'IT' },
  '.es': { timezone: 'Europe/Madrid', country_code: 'ES' },
  '.nl': { timezone: 'Europe/Amsterdam', country_code: 'NL' },
  '.ch': { timezone: 'Europe/Zurich', country_code: 'CH' },
  '.se': { timezone: 'Europe/Stockholm', country_code: 'SE' },
  '.no': { timezone: 'Europe/Oslo', country_code: 'NO' },
  '.dk': { timezone: 'Europe/Copenhagen', country_code: 'DK' },
  '.fi': { timezone: 'Europe/Helsinki', country_code: 'FI' },
  '.be': { timezone: 'Europe/Brussels', country_code: 'BE' },
  '.at': { timezone: 'Europe/Vienna', country_code: 'AT' },
  '.pl': { timezone: 'Europe/Warsaw', country_code: 'PL' },
  '.cz': { timezone: 'Europe/Prague', country_code: 'CZ' },
  '.gr': { timezone: 'Europe/Athens', country_code: 'GR' },
  '.pt': { timezone: 'Europe/Lisbon', country_code: 'PT' },
  '.ie': { timezone: 'Europe/Dublin', country_code: 'IE' },
  '.tr': { timezone: 'Europe/Istanbul', country_code: 'TR' },
  '.ru': { timezone: 'Europe/Moscow', country_code: 'RU' },
  '.th': { timezone: 'Asia/Bangkok', country_code: 'TH' },
  '.my': { timezone: 'Asia/Kuala_Lumpur', country_code: 'MY' },
  '.ph': { timezone: 'Asia/Manila', country_code: 'PH' },
  '.id': { timezone: 'Asia/Jakarta', country_code: 'ID' },
  '.vn': { timezone: 'Asia/Ho_Chi_Minh', country_code: 'VN' },
  '.hk': { timezone: 'Asia/Hong_Kong', country_code: 'HK' },
  '.tw': { timezone: 'Asia/Taipei', country_code: 'TW' },
  '.ar': { timezone: 'America/Argentina/Buenos_Aires', country_code: 'AR' },
  '.co': { timezone: 'America/Bogota', country_code: 'CO' },
  '.pe': { timezone: 'America/Lima', country_code: 'PE' },
  '.cl': { timezone: 'America/Santiago', country_code: 'CL' },
  '.eg': { timezone: 'Africa/Cairo', country_code: 'EG' },
  '.ng': { timezone: 'Africa/Lagos', country_code: 'NG' },
  '.ke': { timezone: 'Africa/Nairobi', country_code: 'KE' },
  '.mu': { timezone: 'Indian/Mauritius', country_code: 'MU' },
};

/**
 * Extract domain from email or URL
 */
function extractDomain(input: string): string | null {
  if (!input) return null;

  try {
    // If it's an email, extract domain
    if (input.includes('@')) {
      const [, domain] = input.split('@');
      return domain.toLowerCase();
    }

    // If it's a URL, extract hostname
    if (input.startsWith('http')) {
      const url = new URL(input);
      return url.hostname.toLowerCase();
    }

    // Assume it's a domain
    return input.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Detect timezone from TLD
 */
function detectFromTLD(domain: string): TimezoneDetectionResult | null {
  if (!domain) return null;

  // Check for exact TLD match
  for (const [tld, data] of Object.entries(TLD_TIMEZONE_MAP)) {
    if (domain.endsWith(tld)) {
      return {
        timezone: data.timezone,
        country_code: data.country_code,
        country_name: getCountryName(data.country_code),
        detection_method: 'domain',
        confidence: 'medium'
      };
    }
  }

  // Check for common second-level domains (e.g., co.uk, com.au)
  if (domain.endsWith('.co.uk')) {
    return {
      timezone: 'Europe/London',
      country_code: 'GB',
      country_name: 'United Kingdom',
      detection_method: 'domain',
      confidence: 'medium'
    };
  }

  if (domain.endsWith('.com.au') || domain.endsWith('.net.au')) {
    return {
      timezone: 'Australia/Sydney',
      country_code: 'AU',
      country_name: 'Australia',
      detection_method: 'domain',
      confidence: 'medium'
    };
  }

  return null;
}

/**
 * Get country name from country code
 */
function getCountryName(countryCode: string): string {
  const names: Record<string, string> = {
    US: 'United States',
    GB: 'United Kingdom',
    IN: 'India',
    CA: 'Canada',
    AU: 'Australia',
    DE: 'Germany',
    FR: 'France',
    JP: 'Japan',
    SG: 'Singapore',
    AE: 'United Arab Emirates',
    // Add more as needed
  };
  return names[countryCode] || countryCode;
}

/**
 * Query database for country timezone info
 */
async function getCountryTimezoneFromDB(countryCode: string): Promise<TimezoneDetectionResult | null> {
  try {
    const query = `
      SELECT country_code, country_name, default_timezone
      FROM country_timezones
      WHERE country_code = $1
      LIMIT 1
    `;
    const result = await executeQuery(query, [countryCode.toUpperCase()]);

    if (result.length > 0) {
      const row = result[0];
      return {
        timezone: row.default_timezone,
        country_code: row.country_code,
        country_name: row.country_name,
        detection_method: 'country_fallback',
        confidence: 'medium'
      };
    }
  } catch (error) {
    console.error('Error querying country timezone:', error);
  }

  return null;
}

/**
 * Main function to detect timezone from email or website
 *
 * @param email - Contact email address
 * @param website - Website URL
 * @param country_code - Fallback country code (optional)
 * @returns TimezoneDetectionResult or null
 */
export async function detectTimezone(
  email?: string,
  website?: string,
  country_code?: string
): Promise<TimezoneDetectionResult | null> {
  // Try email domain first
  if (email) {
    const emailDomain = extractDomain(email);
    const emailResult = detectFromTLD(emailDomain || '');
    if (emailResult) {
      return emailResult;
    }
  }

  // Try website domain
  if (website) {
    const websiteDomain = extractDomain(website);
    const websiteResult = detectFromTLD(websiteDomain || '');
    if (websiteResult) {
      return {
        ...websiteResult,
        detection_method: 'website'
      };
    }
  }

  // Fallback to country code
  if (country_code) {
    const dbResult = await getCountryTimezoneFromDB(country_code);
    if (dbResult) {
      return {
        ...dbResult,
        detection_method: 'country_fallback',
        confidence: 'low'
      };
    }
  }

  // Final fallback to US/Eastern
  return {
    timezone: 'America/New_York',
    country_code: 'US',
    country_name: 'United States',
    detection_method: 'default',
    confidence: 'low'
  };
}

/**
 * Batch detect timezones for multiple contacts
 */
export async function batchDetectTimezones(
  contacts: Array<{ email?: string; website?: string; country_code?: string }>
): Promise<Array<TimezoneDetectionResult | null>> {
  return Promise.all(
    contacts.map(contact => detectTimezone(contact.email, contact.website, contact.country_code))
  );
}

/**
 * Get confidence score for a timezone-country pair (synchronous version for API use)
 */
export function getTimezoneConfidence(timezone: string, countryCode?: string): {
  score: number; // 0-100
  level: 'high' | 'medium' | 'low';
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 50; // Base score

  // Validate timezone format
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    reasons.push('Timezone is valid IANA format');
    score += 20;
  } catch {
    return {
      score: 0,
      level: 'low',
      reasons: ['Invalid timezone format']
    };
  }

  // Check if country is provided
  if (!countryCode) {
    return {
      score: Math.min(score, 60),
      level: 'low',
      reasons: [...reasons, 'No country code provided - cannot verify timezone-country match']
    };
  }

  // Check country-timezone match using TLD map
  const tldEntry = Object.entries(TLD_TIMEZONE_MAP).find(
    ([, data]) => data.country_code === countryCode.toUpperCase()
  );

  if (!tldEntry) {
    reasons.push('Country code not in TLD mapping');
    return {
      score: Math.min(score, 40),
      level: 'low',
      reasons
    };
  }

  const [, data] = tldEntry;

  // Check if timezone matches country
  if (data.timezone === timezone) {
    score += 30;
    reasons.push('Timezone matches country code from TLD mapping');

    // Bonus for common TLDs
    if (['.us', '.uk', '.in', '.jp', '.de'].some(tld => tldEntry[0] === tld)) {
      score += 10;
      reasons.push('High-confidence country TLD');
    }
  } else {
    score -= 20;
    reasons.push(`Timezone '${timezone}' differs from country's default '${data.timezone}'`);
  }

  // Determine final confidence level
  let level: 'high' | 'medium' | 'low';
  if (score >= 80) {
    level = 'high';
  } else if (score >= 50) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    level,
    reasons
  };
}

/**
 * Synchronous timezone detection from country code only (for API use)
 */
export function detectTimezoneFromCountry(countryCode: string): {
  timezone: string;
  country_code: string;
  country_name: string;
  confidence: 'high' | 'medium' | 'low';
} {
  const code = countryCode.toUpperCase();
  const tldEntry = Object.entries(TLD_TIMEZONE_MAP).find(
    ([, data]) => data.country_code === code
  );

  if (!tldEntry) {
    return {
      timezone: 'UTC',
      country_code: code,
      country_name: code,
      confidence: 'low'
    };
  }

  const [, data] = tldEntry;
  return {
    timezone: data.timezone,
    country_code: data.country_code,
    country_name: getCountryName(data.country_code),
    confidence: 'medium'
  };
}
