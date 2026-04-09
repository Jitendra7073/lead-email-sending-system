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

async function addSequenceIdColumn() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("Adding sequence_id column to email_campaigns table...");

    // Add sequence_id column if it doesn't exist
    await client.query(`
      ALTER TABLE email_campaigns
      ADD COLUMN IF NOT EXISTS sequence_id UUID REFERENCES email_sequences(id) ON DELETE SET NULL;
    `);

    // Add index for performance
    console.log("Creating index on sequence_id...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_campaigns_sequence_id
      ON email_campaigns(sequence_id);
    `);

    await client.query("COMMIT");
    console.log(
      "✅ Successfully added sequence_id column to email_campaigns table!",
    );
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

addSequenceIdColumn();
