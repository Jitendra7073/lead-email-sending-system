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

async function addMissingColumns() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("Adding missing columns to email_queue table...");

    // Add adjusted_scheduled_at column
    console.log("Adding adjusted_scheduled_at...");
    await client.query(`
      ALTER TABLE email_queue
      ADD COLUMN IF NOT EXISTS adjusted_scheduled_at TIMESTAMPTZ;
    `);

    // Add recipient_timezone column
    console.log("Adding recipient_timezone...");
    await client.query(`
      ALTER TABLE email_queue
      ADD COLUMN IF NOT EXISTS recipient_timezone TEXT;
    `);

    // Add dependency_satisfied column
    console.log("Adding dependency_satisfied...");
    await client.query(`
      ALTER TABLE email_queue
      ADD COLUMN IF NOT EXISTS dependency_satisfied BOOLEAN DEFAULT true;
    `);

    // Add depends_on_queue_id column
    console.log("Adding depends_on_queue_id...");
    await client.query(`
      ALTER TABLE email_queue
      ADD COLUMN IF NOT EXISTS depends_on_queue_id UUID REFERENCES email_queue(id) ON DELETE SET NULL;
    `);

    // Add sequence_position column (if not exists)
    console.log("Checking sequence_position...");
    await client.query(`
      ALTER TABLE email_queue
      ADD COLUMN IF NOT EXISTS sequence_position INTEGER;
    `);

    // Create indexes for performance
    console.log("Creating indexes...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_queue_depends_on_queue_id
      ON email_queue(depends_on_queue_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_queue_dependency_satisfied
      ON email_queue(dependency_satisfied);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_queue_recipient_timezone
      ON email_queue(recipient_timezone);
    `);

    await client.query("COMMIT");
    console.log(
      "✅ Successfully added all missing columns to email_queue table!",
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

addMissingColumns();
