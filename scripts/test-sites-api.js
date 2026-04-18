require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function test() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Test insert with the new sequence
        const r = await client.query(
            "INSERT INTO sites (url, country) VALUES ('https://test-site-api.com', 'us') RETURNING id, url, country"
        );
        console.log('Insert succeeded:', r.rows[0]);

        await client.query('ROLLBACK');
        console.log('Rolled back test insert.');
    } finally {
        client.release();
        pool.end();
    }
}

test().catch(e => { console.error('FAILED:', e.message); pool.end(); });
