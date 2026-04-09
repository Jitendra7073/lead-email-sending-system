import { NextResponse } from "next/server";
import {
  seedCountryTimezones,
  seedSingleCountry,
  verifySeedData,
  resetAndSeedCountryTimezones,
} from "@/lib/db/seed-country-timezones";

/**
 * POST /api/timezones/seed
 *
 * Endpoint to seed the country_timezones table with comprehensive timezone data.
 *
 * Query Parameters:
 * - reset: Set to 'true' to delete all existing data and reseed (DANGEROUS!)
 * - country: ISO country code to seed/update only that country
 * - verify: Set to 'true' to verify data after seeding
 *
 * Examples:
 * - POST /api/timezones/seed - Seed all countries (idempotent)
 * - POST /api/timezones/seed?reset=true - Reset and reseed all (dangerous!)
 * - POST /api/timezones/seed?country=US - Seed only US
 * - POST /api/timezones/seed?verify=true - Seed and verify data
 *
 * Security Note: This endpoint should be protected with authentication in production
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reset = searchParams.get("reset") === "true";
    const countryCode = searchParams.get("country");
    const verify = searchParams.get("verify") === "true";

    console.log(`🌍 Timezone seeding initiated`);
    console.log(`   Reset mode: ${reset}`);
    console.log(`   Single country: ${countryCode || "none"}`);
    console.log(`   Verify after: ${verify}`);

    let result;
    let verificationResult = null;

    // Handle single country seeding
    if (countryCode) {
      if (reset) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Cannot use reset mode with single country. Omit reset parameter.",
          },
          { status: 400 },
        );
      }

      const success = await seedSingleCountry(countryCode);

      if (success) {
        // Get the seeded country
        const seededCountry = await import("@/lib/data/country-timezones").then(
          (m) =>
            m.COUNTRY_TIMEZONES.find(
              (c) => c.country_code.toLowerCase() === countryCode.toLowerCase(),
            ),
        );

        return NextResponse.json({
          success: true,
          message: `Successfully seeded country: ${seededCountry?.country_name || countryCode}`,
          data: seededCountry,
          meta: {
            seeded: 1,
            updated: 0,
            failed: 0,
          },
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to seed country: ${countryCode}`,
          },
          { status: 500 },
        );
      }
    }

    // Handle full seeding or reset
    if (reset) {
      // Security check: could add additional confirmation here
      console.warn(
        "⚠️  RESET MODE ACTIVE - All existing data will be deleted!",
      );
      result = await resetAndSeedCountryTimezones();
    } else {
      result = await seedCountryTimezones();
    }

    // Verify data if requested
    if (verify && result.success) {
      console.log("🔍 Verifying seeded data...");
      verificationResult = await verifySeedData();
    }

    // Prepare response
    const response = {
      success: result.success,
      message: reset
        ? `Reset and seeded ${result.seeded} countries`
        : `Seeded ${result.seeded} countries (${result.updated} already existed)`,

      data: {
        seeded: result.seeded,
        updated: result.updated,
        failed: result.failed,
        total_countries: result.totalCountries,
      },

      errors: result.errors.length > 0 ? result.errors : undefined,
      verification: verificationResult
        ? {
            valid: verificationResult.valid,
            count: verificationResult.count,
            sample: verificationResult.sample,
            errors:
              verificationResult.errors.length > 0
                ? verificationResult.errors
                : undefined,
          }
        : undefined,

      meta: {
        timestamp: new Date().toISOString(),
        mode: reset ? "reset" : "upsert",
        verification_performed: verify,
      },
    };

    // Return appropriate status code
    const statusCode = result.success ? 200 : 500;

    return NextResponse.json(response, { status: statusCode });
  } catch (error: any) {
    console.error(" Error in timezone seeding endpoint:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error occurred",
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/timezones/seed
 *
 * Get information about the timezone seeder and available options.
 * Useful for documentation and debugging.
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/timezones/seed",
    method: "POST",
    description:
      "Seed the country_timezones table with comprehensive timezone data",
    parameters: {
      reset: {
        type: "boolean",
        description:
          "Delete all existing data and reseed from scratch (DANGEROUS!)",
        default: false,
      },
      country: {
        type: "string",
        description:
          "ISO 3166-1 alpha-2 country code to seed only that country",
        example: "US",
      },
      verify: {
        type: "boolean",
        description: "Verify data integrity after seeding",
        default: false,
      },
    },
    examples: [
      {
        description: "Seed all countries (idempotent upsert)",
        url: "/api/timezones/seed",
      },
      {
        description: "Reset and reseed all countries",
        url: "/api/timezones/seed?reset=true",
      },
      {
        description: "Seed only United States",
        url: "/api/timezones/seed?country=US",
      },
      {
        description: "Seed and verify data",
        url: "/api/timezones/seed?verify=true",
      },
    ],
    security: {
      note: "This endpoint should be protected with authentication in production",
      recommendation: "Add API key or session-based authentication",
    },
  });
}
