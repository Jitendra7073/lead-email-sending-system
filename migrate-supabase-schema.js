/**
 * Migration script to add missing columns to Supabase database
 * Run this with: node migrate-supabase-schema.js
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
    console.log("🔄 Starting Supabase schema migration...");

    // Check current columns in sites table
    console.log("\n📋 Checking existing columns in sites table...");
    const existingColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'sites'
      ORDER BY ordinal_position
    `);

    console.log(
      "Existing columns:",
      existingColumns.rows.map((col) => col.column_name).join(", "),
    );

    // Add missing columns to sites table
    const siteColumnsToAdd = [
      { name: "timezone", type: "TEXT" },
      { name: "country", type: "TEXT" },
    ];

    for (const col of siteColumnsToAdd) {
      const exists = existingColumns.rows.some(
        (c) => c.column_name === col.name,
      );

      if (!exists) {
        console.log(`➕ Adding column: sites.${col.name}`);
        await client.query(
          `ALTER TABLE sites ADD COLUMN ${col.name} ${col.type}`,
        );
        console.log(`✅ Added sites.${col.name}`);
      } else {
        console.log(`✓ Column sites.${col.name} already exists`);
      }
    }

    // Check contacts table
    console.log("\n📋 Checking contacts table...");
    const contactsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'contacts'
      )
    `);

    if (!contactsTableCheck.rows[0].exists) {
      console.log("➕ Creating contacts table...");
      await client.query(`
        CREATE TABLE contacts (
          id SERIAL PRIMARY KEY,
          type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'phone', 'linkedin')),
          value TEXT NOT NULL,
          site_id INTEGER REFERENCES sites(id),
          source_page TEXT,
          country_code VARCHAR(10),
          timezone TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(type, value)
        )
      `);
      console.log("✅ Created contacts table");
    } else {
      console.log("✓ Contacts table already exists");

      // Check for missing columns in contacts table
      const contactColumns = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'contacts'
      `);
      const contactColNames = contactColumns.rows.map((c) => c.column_name);

      const contactColumnsToAdd = [
        { name: "timezone", type: "TEXT" },
        { name: "country_code", type: "VARCHAR(10)" },
        { name: "updated_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
      ];

      for (const col of contactColumnsToAdd) {
        if (!contactColNames.includes(col.name)) {
          console.log(`➕ Adding column: contacts.${col.name}`);
          await client.query(
            `ALTER TABLE contacts ADD COLUMN ${col.name} ${col.type}`,
          );
          console.log(`✅ Added contacts.${col.name}`);
        } else {
          console.log(`✓ Column contacts.${col.name} already exists`);
        }
      }
    }

    // Create indexes for better performance
    console.log("\n📋 Checking indexes...");
    const indexesToAdd = [
      { name: "idx_contacts_type", table: "contacts", columns: "type" },
      { name: "idx_contacts_site_id", table: "contacts", columns: "site_id" },
      {
        name: "idx_contacts_country_code",
        table: "contacts",
        columns: "country_code",
      },
      { name: "idx_contacts_timezone", table: "contacts", columns: "timezone" },
    ];

    for (const idx of indexesToAdd) {
      const indexExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes
          WHERE indexname = '${idx.name}'
        )
      `);

      if (!indexExists.rows[0].exists) {
        console.log(`➕ Creating index: ${idx.name}`);
        await client.query(
          `CREATE INDEX ${idx.name} ON ${idx.table}(${idx.columns})`,
        );
        console.log(`✅ Created ${idx.name}`);
      } else {
        console.log(`✓ Index ${idx.name} already exists`);
      }
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📊 Final schema check:");

    // Show final schema
    const finalColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'sites'
      ORDER BY ordinal_position
    `);

    console.log("\nSites table columns:");
    finalColumns.rows.forEach((col) => {
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
