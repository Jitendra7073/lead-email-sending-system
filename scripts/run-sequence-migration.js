/**
 * Script to run the email sequences database migration
 * Usage: node scripts/run-sequence-migration.js
 */

const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(" DATABASE_URL is not set in .env file");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log("🔄 Starting email sequences migration...");

    // Read the migration file
    const migrationPath = path.join(
      __dirname,
      "..",
      "src",
      "lib",
      "db",
      "migrations",
      "create_sequences.sql",
    );
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    // Execute the migration
    await client.query(migrationSQL);

    console.log("✅ Email sequences migration completed successfully!");
    console.log("\n📋 Created tables:");
    console.log("   - email_sequences");
    console.log("   - email_sequence_items");
    console.log("\n🔗 Created indexes and triggers for automatic timestamps");

    // Verify tables exist
    const checkTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('email_sequences', 'email_sequence_items')
      ORDER BY table_name;
    `);

    console.log(
      "\n✅ Verified tables:",
      checkTables.rows.map((r) => r.table_name).join(", "),
    );
  } catch (error) {
    console.error(" Migration failed:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
