require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fix() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Delete duplicates, keeping the oldest (lowest id) for each (type, value) pair
        const result = await client.query(`
      DELETE FROM contacts
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY type, value ORDER BY id ASC) as rn
          FROM contacts
        ) t
        WHERE rn > 1
      )
    `);

        console.log(`Deleted ${result.rowCount} duplicate contacts`);

        // Now add the unique constraint
        await client.query('ALTER TABLE contacts ADD CONSTRAINT contacts_type_value_unique UNIQUE (type, value)');
        console.log('Added UNIQUE constraint on (type, value)');

        await client.query('COMMIT');
        console.log('Done!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error:', e.message);
    } finally {
        client.release();
        pool.end();
    }
}

fix();
