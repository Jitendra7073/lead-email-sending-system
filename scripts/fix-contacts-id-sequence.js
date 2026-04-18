require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fix() {
    const client = await pool.connect();
    try {
        // Check existing sequences
        const seqs = await client.query(
            "SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'"
        );
        console.log('Existing sequences:', seqs.rows.map(r => r.sequence_name));

        // Check max id currently in contacts
        const maxId = await client.query('SELECT MAX(id) as max_id FROM contacts');
        console.log('Current max id:', maxId.rows[0].max_id);

        // Create a sequence and attach it
        const startVal = (parseInt(maxId.rows[0].max_id) || 0) + 1;
        console.log(`Creating sequence starting at ${startVal}...`);

        await client.query(`CREATE SEQUENCE IF NOT EXISTS contacts_id_seq START WITH ${startVal} INCREMENT BY 1`);
        await client.query(`ALTER TABLE contacts ALTER COLUMN id SET DEFAULT nextval('contacts_id_seq')`);
        await client.query(`ALTER SEQUENCE contacts_id_seq OWNED BY contacts.id`);

        console.log('Done. Verifying...');
        const verify = await client.query(
            "SELECT column_name, column_default FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'id'"
        );
        console.log('id column default now:', verify.rows[0].column_default);
    } finally {
        client.release();
        pool.end();
    }
}

fix().catch(e => { console.error(e.message); pool.end(); });
