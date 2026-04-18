require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query(`
  SELECT constraint_name, constraint_type 
  FROM information_schema.table_constraints 
  WHERE table_name = 'contacts' AND constraint_type IN ('UNIQUE', 'PRIMARY KEY')
`).then(r => {
    console.log('Constraints:', JSON.stringify(r.rows, null, 2));
    pool.end();
}).catch(e => { console.error(e.message); pool.end(); });
