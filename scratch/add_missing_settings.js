require('dotenv').config();
const { Pool } = require('pg');

async function run() {
    console.log("Starting DB script...");
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log("Connected!");
        
        const keysToInsert = [
            ['apify_api_key', 'Apify API Key', 'Setting for Apify API Key'],
            ['apify_actor_id', 'Apify Actor Id', 'Setting for Apify Actor Id'],
            ['apify_user_id', 'Apify User Id', 'Setting for Apify User Id'],
            ['apify_timeout_ms', 'Apify Timeout Ms', 'Setting for Apify Timeout Ms'],
            ['apify_max_retries', 'Apify Max Retries', 'Setting for Apify Max Retries'],
            ['apify_batch_size', 'Apify Batch Size', 'Setting for Apify Batch Size'],
            ['apify_recheck_days', 'Apify Recheck Days', 'Setting for Apify Recheck Days'],
            ['GMAIL_CLIENT_ID', 'Gmail Client Id', 'Setting for Gmail Client Id'],
            ['GMAIL_CLIENT_SECRET', 'Gmail Client Secret', 'Setting for Gmail Client Secret'],
            ['GMAIL_REDIRECT_URI', 'Gmail Redirect Uri', 'Setting for Gmail Redirect Uri'],
            ['GMAIL_REFRESH_TOKEN', 'Gmail Refresh Token', 'Setting for Gmail Refresh Token']
        ];

        for (const [key, label, desc] of keysToInsert) {
            await client.query(`
                INSERT INTO email_settings (key, value, label, description)
                VALUES ($1, '', $2, $3)
                ON CONFLICT (key) DO NOTHING
            `, [key, label, desc]);
        }
        
        console.log("Done!");
        client.release();
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await pool.end();
    }
}

run();
