const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'email_queue' ORDER BY ordinal_position"
).then(r => {
    console.log(r.rows.map(c => `${c.column_name} (${c.data_type})`).join('\n'));
    pool.end();
}).catch(e => { console.error(e.message); pool.end(); });
