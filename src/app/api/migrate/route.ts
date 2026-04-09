import { NextResponse } from "next/server";
import { executeQuery } from "@/lib/db/postgres";
import { readFileSync } from "fs";
import { join } from "path";

export async function POST() {
  try {
    console.log("🔄 Starting email verification migrations...\n");

    // Run email verification tables migration
    console.log("📋 Creating email verification tables...");
    const migration1 = readFileSync(
      join(
        process.cwd(),
        "src/lib/db/migrations/add_email_verification_tables.sql",
      ),
      "utf8",
    );
    await executeQuery(migration1);
    console.log(
      "✅ Created email_verifications and contact_email_verifications tables\n",
    );

    // Run Apify settings migration
    console.log("📋 Adding Apify settings...");
    const migration2 = readFileSync(
      join(process.cwd(), "src/lib/db/migrations/add_apify_settings.sql"),
      "utf8",
    );
    await executeQuery(migration2);
    console.log("✅ Added Apify settings to email_settings table\n");

    return NextResponse.json({
      success: true,
      message: "✨ All migrations completed successfully!",
      details:
        '1. Navigate to Settings page to enter Apify credentials\n2. Test the "Check Emails" button in Contacts page',
    });
  } catch (error: any) {
    console.error(" Migration error:", error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}
