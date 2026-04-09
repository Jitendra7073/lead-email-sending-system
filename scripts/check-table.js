const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTable() {
  const client = await pool.connect();
  try {
    // Check table constraints
    const constraints = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'country_timezones'::regclass
    `);
    console.log('Constraints:', JSON.stringify(constraints.rows, null, 2));

    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'country_timezones'
      );
    `);
    console.log('Table exists:', tableExists.rows[0].exists);

  } finally {
    client.release();
    await pool.end();
  }
}

checkTable().catch(console.error);
