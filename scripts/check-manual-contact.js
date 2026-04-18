require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
    const client = await pool.connect();
    try {
        // Get the most recently added contacts and show all relevant columns
        const r = await client.query(`
      SELECT 
        c.id, c.type, c.value, c.source_page, c.country_code, c.site_id,
        s.url as site_url, s.country as site_country
      FROM contacts c
      LEFT JOIN sites s ON c.site_id = s.id
      ORDER BY c.id DESC
      LIMIT 5
    `);
        console.log(JSON.stringify(r.rows, null, 2));
    } finally {
        client.release();
        pool.end();
    }
}
check().catch(e => { console.error(e.message); pool.end(); });
