require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query(
    "SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'contacts' ORDER BY ordinal_position"
).then(r => {
    console.log(JSON.stringify(r.rows, null, 2));
    return pool.query("SELECT pg_get_serial_sequence('contacts', 'id')");
}).then(r => {
    console.log('Serial sequence:', JSON.stringify(r.rows));
    pool.end();
}).catch(e => { console.error(e.message); pool.end(); });
