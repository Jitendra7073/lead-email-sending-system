/**
 * Quick migration to add send_time column to email_sequence_items
 * Run with: node scripts/add-send-time-column.js
 */

const { Pool } = require("pg");
require("dotenv").config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(" DATABASE_URL not found in .env file");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log("🔄 Adding send_time column to email_sequence_items...");

    // Check if column already exists
    const columnCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'email_sequence_items'
        AND column_name = 'send_time'
      )
    `);

    if (columnCheck.rows[0].exists) {
      console.log("✓ Column send_time already exists");
    } else {
      console.log("➕ Adding column: email_sequence_items.send_time");
      await client.query(`
        ALTER TABLE email_sequence_items
        ADD COLUMN send_time VARCHAR(10) DEFAULT '09:00'
      `);
      console.log("✅ Added send_time column");
    }

    console.log("\n✅ Migration completed successfully!");

    // Show current columns
    const columns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'email_sequence_items'
      ORDER BY ordinal_position
    `);

    console.log("\n📊 email_sequence_items columns:");
    columns.rows.forEach((col) => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
  } catch (error) {
    console.error(" Migration error:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
