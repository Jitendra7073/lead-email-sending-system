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

async function fixStatusConstraint() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("Updating email_queue status check constraint...");

    // Drop the old constraint
    console.log("Dropping old constraint...");
    await client.query(`
      ALTER TABLE email_queue
      DROP CONSTRAINT IF EXISTS email_queue_status_check;
    `);

    // Add the new constraint with all required statuses
    console.log("Adding new constraint with updated statuses...");
    await client.query(`
      ALTER TABLE email_queue
      ADD CONSTRAINT email_queue_status_check
      CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled', 'ready_to_send', 'scheduled', 'pending'));
    `);

    await client.query("COMMIT");
    console.log("✅ Successfully updated email_queue status constraint!");
    console.log("\nAllowed statuses:");
    console.log("  - queued");
    console.log("  - sending");
    console.log("  - sent");
    console.log("  - failed");
    console.log("  - cancelled");
    console.log("  - ready_to_send (new)");
    console.log("  - scheduled (new)");
    console.log("  - pending (new)");
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

fixStatusConstraint();
