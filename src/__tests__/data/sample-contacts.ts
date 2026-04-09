/**
 * Sample Contact Data for Testing
 *
 * Contains contacts with various timezones, countries, and edge cases
 */

export interface TestContact {
  id: number;
  type: 'email' | 'phone' | 'linkedin';
  value: string;
  site_id?: number;
  country_code?: string;
  timezone?: string;
  expected_timezone?: string;
  expected_confidence?: 'high' | 'medium' | 'low';
}

export const SAMPLE_CONTACTS: TestContact[] = [
  // Single timezone countries (high confidence)
  {
    id: 1,
    type: 'email',
    value: 'user@example.co.jp',
    country_code: 'JP',
    timezone: 'Asia/Tokyo',
    expected_timezone: 'Asia/Tokyo',
    expected_confidence: 'high'
  },
  {
    id: 2,
    type: 'email',
    value: 'user@example.co.in',
    country_code: 'IN',
    timezone: 'Asia/Kolkata',
    expected_timezone: 'Asia/Kolkata',
    expected_confidence: 'high'
  },
  {
    id: 3,
    type: 'email',
    value: 'user@example.co.uk',
    country_code: 'GB',
    timezone: 'Europe/London',
    expected_timezone: 'Europe/London',
    expected_confidence: 'high'
  },

  // Multiple timezone countries (medium/low confidence)
  {
    id: 4,
    type: 'email',
    value: 'user@example.com',
    country_code: 'US',
    timezone: 'America/New_York',
    expected_timezone: 'America/New_York',
    expected_confidence: 'medium'
  },
  {
    id: 5,
    type: 'email',
    value: 'user@example.ca',
    country_code: 'CA',
    timezone: 'America/Toronto',
    expected_timezone: 'America/Toronto',
    expected_confidence: 'medium'
  },

  // Middle Eastern countries (different weekend pattern)
  {
    id: 6,
    type: 'email',
    value: 'user@example.ae',
    country_code: 'AE',
    timezone: 'Asia/Dubai',
    expected_timezone: 'Asia/Dubai',
    expected_confidence: 'high'
  },
  {
    id: 7,
    type: 'email',
    value: 'user@example.co.sa',
    country_code: 'SA',
    timezone: 'Asia/Riyadh',
    expected_timezone: 'Asia/Riyadh',
    expected_confidence: 'high'
  },

  // European countries
  {
    id: 8,
    type: 'email',
    value: 'user@example.de',
    country_code: 'DE',
    timezone: 'Europe/Berlin',
    expected_timezone: 'Europe/Berlin',
    expected_confidence: 'high'
  },
  {
    id: 9,
    type: 'email',
    value: 'user@example.fr',
    country_code: 'FR',
    timezone: 'Europe/Paris',
    expected_timezone: 'Europe/Paris',
    expected_confidence: 'high'
  },

  // Asia-Pacific
  {
    id: 10,
    type: 'email',
    value: 'user@example.com.au',
    country_code: 'AU',
    timezone: 'Australia/Sydney',
    expected_timezone: 'Australia/Sydney',
    expected_confidence: 'medium'
  },
  {
    id: 11,
    type: 'email',
    value: 'user@example.co.sg',
    country_code: 'SG',
    timezone: 'Asia/Singapore',
    expected_timezone: 'Asia/Singapore',
    expected_confidence: 'high'
  },

  // Edge cases
  {
    id: 12,
    type: 'email',
    value: 'user@example.com',
    country_code: 'XX', // Invalid country code
    timezone: null,
    expected_timezone: 'UTC',
    expected_confidence: 'low'
  },
  {
    id: 13,
    type: 'email',
    value: 'user@example.com',
    country_code: null,
    timezone: null,
    expected_timezone: 'UTC',
    expected_confidence: 'low'
  },
  {
    id: 14,
    type: 'email',
    value: 'user@example.co.nz',
    country_code: 'NZ',
    timezone: 'Pacific/Auckland',
    expected_timezone: 'Pacific/Auckland',
    expected_confidence: 'medium'
  },

  // Latin America
  {
    id: 15,
    type: 'email',
    value: 'user@example.com.br',
    country_code: 'BR',
    timezone: 'America/Sao_Paulo',
    expected_timezone: 'America/Sao_Paulo',
    expected_confidence: 'medium'
  },
  {
    id: 16,
    type: 'email',
    value: 'user@example.com.mx',
    country_code: 'MX',
    timezone: 'America/Mexico_City',
    expected_timezone: 'America/Mexico_City',
    expected_confidence: 'medium'
  },

  // Africa
  {
    id: 17,
    type: 'email',
    value: 'user@example.co.za',
    country_code: 'ZA',
    timezone: 'Africa/Johannesburg',
    expected_timezone: 'Africa/Johannesburg',
    expected_confidence: 'medium'
  },
  {
    id: 18,
    type: 'email',
    value: 'user@example.co.eg',
    country_code: 'EG',
    timezone: 'Africa/Cairo',
    expected_timezone: 'Africa/Cairo',
    expected_confidence: 'high'
  }
];

/**
 * Contacts grouped by timezone for batch testing
 */
export const CONTACTS_BY_TIMEZONE = {
  'America/New_York': SAMPLE_CONTACTS.filter(c => c.timezone === 'America/New_York'),
  'Europe/London': SAMPLE_CONTACTS.filter(c => c.timezone === 'Europe/London'),
  'Asia/Kolkata': SAMPLE_CONTACTS.filter(c => c.timezone === 'Asia/Kolkata'),
  'Asia/Tokyo': SAMPLE_CONTACTS.filter(c => c.timezone === 'Asia/Tokyo'),
  'Asia/Dubai': SAMPLE_CONTACTS.filter(c => c.timezone === 'Asia/Dubai'),
  'Australia/Sydney': SAMPLE_CONTACTS.filter(c => c.timezone === 'Australia/Sydney')
};

/**
 * Contacts grouped by weekend pattern
 */
export const CONTACTS_BY_WEEKEND = {
  'saturday-sunday': SAMPLE_CONTACTS.filter(c =>
    ['US', 'GB', 'JP', 'DE', 'FR', 'CA', 'AU'].includes(c.country_code || '')
  ),
  'friday-saturday': SAMPLE_CONTACTS.filter(c =>
    ['AE', 'SA'].includes(c.country_code || '')
  ),
  'sunday-only': SAMPLE_CONTACTS.filter(c =>
    c.country_code === 'IN'
  )
};

/**
 * Contacts with specific business hour patterns
 */
export const CONTACTS_BY_BUSINESS_HOURS = {
  '9-6': SAMPLE_CONTACTS.filter(c =>
    ['US', 'AE', 'JP', 'DE', 'FR'].includes(c.country_code || '')
  ),
  '9-5': SAMPLE_CONTACTS.filter(c =>
    ['GB', 'CA', 'AU'].includes(c.country_code || '')
  ),
  '10-7': SAMPLE_CONTACTS.filter(c =>
    c.country_code === 'IN'
  )
};

/**
 * Get contacts by confidence level
 */
export function getContactsByConfidence(confidence: 'high' | 'medium' | 'low'): TestContact[] {
  return SAMPLE_CONTACTS.filter(c => c.expected_confidence === confidence);
}

/**
 * Get contacts for specific testing scenarios
 */
export const TEST_SCENARIOS = {
  // Single timezone country test
  singleTimezone: {
    contacts: SAMPLE_CONTACTS.filter(c => ['JP', 'IN', 'GB'].includes(c.country_code || '')),
    description: 'Countries with single timezone (high confidence)'
  },

  // Multiple timezone country test
  multipleTimezones: {
    contacts: SAMPLE_CONTACTS.filter(c => ['US', 'CA', 'AU', 'BR'].includes(c.country_code || '')),
    description: 'Countries with multiple timezones (medium/low confidence)'
  },

  // Weekend pattern tests
  weekendVariation: {
    contacts: [
      ...SAMPLE_CONTACTS.filter(c => c.country_code === 'US'),
      ...SAMPLE_CONTACTS.filter(c => c.country_code === 'AE'),
      ...SAMPLE_CONTACTS.filter(c => c.country_code === 'IN')
    ],
    description: 'Different weekend patterns (Sat-Sun, Fri-Sat, Sun-only)'
  },

  // Business hours tests
  businessHoursVariation: {
    contacts: [
      ...SAMPLE_CONTACTS.filter(c => c.country_code === 'US'),
      ...SAMPLE_CONTACTS.filter(c => c.country_code === 'GB'),
      ...SAMPLE_CONTACTS.filter(c => c.country_code === 'IN')
    ],
    description: 'Different business hours (9-6, 9-5, 10-7)'
  },

  // Edge cases
  edgeCases: {
    contacts: SAMPLE_CONTACTS.filter(c => c.id >= 12),
    description: 'Edge cases (invalid country, missing data)'
  }
};

/**
 * Mock database insertion helper
 */
export async function insertTestContacts(db: any, contacts: TestContact[] = SAMPLE_CONTACTS) {
  const inserted = [];

  for (const contact of contacts) {
    try {
      const result = await db.execute(
        `INSERT INTO contacts (type, value, site_id, country_code, timezone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [contact.type, contact.value, contact.site_id || null, contact.country_code || null, contact.timezone || null]
      );
      inserted.push(result[0]);
    } catch (error) {
      console.error(`Failed to insert contact ${contact.id}:`, error);
    }
  }

  return inserted;
}

/**
 * Cleanup helper
 */
export async function cleanupTestContacts(db: any, contacts: TestContact[] = SAMPLE_CONTACTS) {
  const ids = contacts.map(c => c.id);
  await db.execute('DELETE FROM contacts WHERE id = ANY($1)', [ids]);
}
