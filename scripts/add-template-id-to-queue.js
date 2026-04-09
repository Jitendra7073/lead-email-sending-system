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

async function addTemplateIdColumn() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("Adding template_id column to email_queue table...");

    // Add template_id column if it doesn't exist
    await client.query(`
      ALTER TABLE email_queue
      ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL;
    `);

    // Add index for performance
    console.log("Creating index on template_id...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_queue_template_id
      ON email_queue(template_id);
    `);

    await client.query("COMMIT");
    console.log(
      "✅ Successfully added template_id column to email_queue table!",
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

addTemplateIdColumn();
