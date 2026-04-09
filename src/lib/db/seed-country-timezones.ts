/**
 * Database Seeder for Country Timezones
 *
 * Provides functionality to populate the country_timezones table with
 * comprehensive timezone data for 50+ countries worldwide.
 *
 * Features:
 * - Idempotent: Can be run multiple times safely
 * - Upsert functionality: Updates existing records
 * - Detailed logging: Tracks seeded vs updated records
 * - Error handling: Graceful failure with detailed messages
 */

import { executeQuery } from "./postgres";
import { COUNTRY_TIMEZONES, CountryTimezone } from "../data/country-timezones";

/**
 * Result of the seeding operation
 */
export interface SeedResult {
  success: boolean;
  seeded: number;
  updated: number;
  failed: number;
  errors: string[];
  totalCountries: number;
}

/**
 * Seed country timezones into the database
 *
 * This function performs an upsert operation:
 * - Inserts new country records
 * - Updates existing records if data has changed
 *
 * @returns Promise<SeedResult> Detailed results of the seeding operation
 */
export async function seedCountryTimezones(): Promise<SeedResult> {
  const result: SeedResult = {
    success: false,
    seeded: 0,
    updated: 0,
    failed: 0,
    errors: [],
    totalCountries: COUNTRY_TIMEZONES.length,
  };

  console.log(
    `🌍 Starting country timezone seeding for ${COUNTRY_TIMEZONES.length} countries...`,
  );

  try {
    // Check if table exists
    const tableCheck = await executeQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'country_timezones'
      );
    `);

    if (!tableCheck[0]?.exists) {
      throw new Error(
        "country_timezones table does not exist. Please run migrations first.",
      );
    }

    console.log("✅ Table exists, proceeding with seeding...");

    // Process each country
    for (const country of COUNTRY_TIMEZONES) {
      try {
        await upsertCountryTimezone(country);
        result.seeded++;
        console.log(
          `✅ Seeded: ${country.country_name} (${country.country_code})`,
        );
      } catch (error) {
        result.failed++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors.push(`${country.country_code}: ${errorMessage}`);
        console.error(` Failed to seed ${country.country_name}:`, errorMessage);
      }
    }

    // Count actual updates (records that already existed)
    const existingCount = await executeQuery(
      `
      SELECT COUNT(*) as count
      FROM country_timezones
      WHERE country_code = ANY($1);
    `,
      [COUNTRY_TIMEZONES.map((c) => c.country_code)],
    );

    result.updated = parseInt(existingCount[0]?.count || "0", 10);

    result.success = result.failed === 0;
    console.log(`\n📊 Seeding complete:`);
    console.log(`   ✅ Successfully seeded: ${result.seeded}`);
    console.log(`   🔄 Already existed: ${result.updated}`);
    console.log(`    Failed: ${result.failed}`);
  } catch (error) {
    result.success = false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Database error: ${errorMessage}`);
    console.error(" Fatal error during seeding:", errorMessage);
  }

  return result;
}

/**
 * Upsert a single country timezone record
 *
 * Uses PostgreSQL's ON CONFLICT clause to handle duplicates:
 * - If country_code doesn't exist: INSERT
 * - If country_code exists: UPDATE all fields
 *
 * @param country Country timezone data to upsert
 * @throws Error if database operation fails
 */
async function upsertCountryTimezone(country: CountryTimezone): Promise<void> {
  const query = `
    INSERT INTO country_timezones (
      country_code,
      country_name,
      default_timezone,
      business_hours_start,
      business_hours_end,
      weekend_days,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    ON CONFLICT (country_code)
    DO UPDATE SET
      country_name = EXCLUDED.country_name,
      default_timezone = EXCLUDED.default_timezone,
      business_hours_start = EXCLUDED.business_hours_start,
      business_hours_end = EXCLUDED.business_hours_end,
      weekend_days = EXCLUDED.weekend_days,
      updated_at = CURRENT_TIMESTAMP
  `;

  const params = [
    country.country_code,
    country.country_name,
    country.default_timezone,
    country.business_hours_start,
    country.business_hours_end,
    country.weekend_days,
  ];

  await executeQuery(query, params);
}

/**
 * Seed a specific country by country code
 *
 * Useful for adding/updating a single country without reseeding everything.
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns Promise<boolean> True if successful, false otherwise
 */
export async function seedSingleCountry(countryCode: string): Promise<boolean> {
  try {
    const country = COUNTRY_TIMEZONES.find(
      (c) => c.country_code.toLowerCase() === countryCode.toLowerCase(),
    );

    if (!country) {
      console.error(
        ` Country code '${countryCode}' not found in timezone data`,
      );
      return false;
    }

    await upsertCountryTimezone(country);
    console.log(
      `✅ Seeded single country: ${country.country_name} (${country.country_code})`,
    );
    return true;
  } catch (error) {
    console.error(` Failed to seed country '${countryCode}':`, error);
    return false;
  }
}

/**
 * Verify seeded data by checking count and sample records
 *
 * @returns Promise<{valid: boolean, count: number, sample: any[]}>
 */
export async function verifySeedData(): Promise<{
  valid: boolean;
  count: number;
  sample: any[];
  errors: string[];
}> {
  const result = {
    valid: true,
    count: 0,
    sample: [],
    errors: [] as string[],
  };

  try {
    // Get total count
    const countResult = await executeQuery(
      "SELECT COUNT(*) as count FROM country_timezones",
    );
    result.count = parseInt(countResult[0]?.count || "0", 10);

    // Get sample records
    const sampleResult = await executeQuery(`
      SELECT country_code, country_name, default_timezone, weekend_days
      FROM country_timezones
      ORDER BY country_name
      LIMIT 5
    `);
    result.sample = sampleResult as any;

    // Validate critical countries exist
    const criticalCountries = ["US", "GB", "IN", "CA", "AU"];
    const missingCountries: string[] = [];

    for (const code of criticalCountries) {
      const exists = await executeQuery(
        "SELECT 1 FROM country_timezones WHERE country_code = $1",
        [code],
      );
      if (!exists || exists.length === 0) {
        missingCountries.push(code);
      }
    }

    if (missingCountries.length > 0) {
      result.valid = false;
      result.errors.push(
        `Missing critical countries: ${missingCountries.join(", ")}`,
      );
    }

    // Check for data integrity
    const integrityCheck = await executeQuery(`
      SELECT COUNT(*) as count
      FROM country_timezones
      WHERE default_timezone IS NULL
         OR business_hours_start IS NULL
         OR business_hours_end IS NULL
         OR weekend_days IS NULL
         OR array_length(weekend_days, 1) IS NULL
    `);

    const invalidCount = parseInt(integrityCheck[0]?.count || "0", 10);
    if (invalidCount > 0) {
      result.valid = false;
      result.errors.push(`${invalidCount} records have NULL or invalid data`);
    }
  } catch (error) {
    result.valid = false;
    result.errors.push(`Verification error: ${error}`);
  }

  return result;
}

/**
 * Reset all country timezone data (DANGEROUS!)
 *
 * Deletes all records and reseeds from scratch.
 * Use with caution - this removes all existing data.
 *
 * @returns Promise<SeedResult> Results of the reseeding operation
 */
export async function resetAndSeedCountryTimezones(): Promise<SeedResult> {
  console.warn("⚠️  RESETTING ALL COUNTRY TIMEZONE DATA!");

  try {
    // Delete all existing records
    await executeQuery("DELETE FROM country_timezones");
    console.log("🗑️  All existing records deleted");

    // Reseed from scratch
    return await seedCountryTimezones();
  } catch (error) {
    const result: SeedResult = {
      success: false,
      seeded: 0,
      updated: 0,
      failed: COUNTRY_TIMEZONES.length,
      errors: [`Reset failed: ${error}`],
      totalCountries: COUNTRY_TIMEZONES.length,
    };
    return result;
  }
}
