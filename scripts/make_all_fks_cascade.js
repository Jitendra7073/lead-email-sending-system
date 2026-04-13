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

async function makeAllForeignKeysCascade() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("Fetching all foreign keys that do not have ON DELETE CASCADE...");

    const { rows: fks } = await client.query(`
      SELECT
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name, 
          tc.constraint_name,
          rc.delete_rule
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          JOIN information_schema.referential_constraints AS rc
            ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND rc.delete_rule != 'CASCADE';
    `);

    if (fks.length === 0) {
      console.log("✅ All foreign keys already have ON DELETE CASCADE. Nothing to do.");
    } else {
      console.log(`Found ${fks.length} foreign keys to update.`);
      
      for (const fk of fks) {
        console.log(`Updating constraint ${fk.constraint_name} on table ${fk.table_name}...`);
        
        // Drop the existing constraint
        await client.query(`ALTER TABLE "${fk.table_name}" DROP CONSTRAINT "${fk.constraint_name}"`);
        
        // Re-add the constraint with ON DELETE CASCADE
        await client.query(`
          ALTER TABLE "${fk.table_name}"
          ADD CONSTRAINT "${fk.constraint_name}"
          FOREIGN KEY ("${fk.column_name}")
          REFERENCES "${fk.foreign_table_name}" ("${fk.foreign_column_name}")
          ON DELETE CASCADE
        `);
      }
      console.log("✅ All foreign keys successfully updated to ON DELETE CASCADE!");
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to update foreign keys:", error);
  } finally {
    client.release();
    pool.end();
  }
}

makeAllForeignKeysCascade();
