const { Pool } = require("pg");
require("dotenv").config({ path: "../.env" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("⚠️ DATABASE_URL is not set in the environment variables!");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function addTimezoneColumns() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("Adding timezone columns to contacts table...");

    // Add country_code column if it doesn't exist
    console.log("Adding country_code...");
    await client.query(`
      ALTER TABLE contacts
      ADD COLUMN IF NOT EXISTS country_code TEXT;
    `);

    // Add timezone column if it doesn't exist
    console.log("Adding timezone...");
    await client.query(`
      ALTER TABLE contacts
      ADD COLUMN IF NOT EXISTS timezone TEXT;
    `);

    // Add region_data column if it doesn't exist
    console.log("Adding region_data...");
    await client.query(`
      ALTER TABLE contacts
      ADD COLUMN IF NOT EXISTS region_data JSONB DEFAULT '{}';
    `);

    // Create indexes for performance
    console.log("Creating indexes...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contacts_timezone
      ON contacts(timezone);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contacts_country_code
      ON contacts(country_code);
    `);

    await client.query("COMMIT");
    console.log("✅ Successfully added timezone columns to contacts table!");
    process.exit(0);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(" Migration Failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

addTimezoneColumns();
