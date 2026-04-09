import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { executeQuery } from "../src/lib/db/postgres.ts";

async function run() {
    try {
        // First, check what's there
        const current = await executeQuery("SELECT key FROM email_settings");
        console.log("Current keys:", current.map(r => r.key));

        const keysToInsert = [
            'apify_api_key', 'apify_actor_id', 'apify_user_id', 'apify_timeout_ms', 
            'apify_max_retries', 'apify_batch_size', 'apify_recheck_days',
            'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REDIRECT_URI', 'GMAIL_REFRESH_TOKEN'
        ];

        for (const key of keysToInsert) {
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            await executeQuery(`
                INSERT INTO email_settings (key, value, label, description)
                VALUES ($1, '', $2, $3)
                ON CONFLICT (key) DO NOTHING
            `, [key, label, `Setting for ${label}`]);
        }
        
        console.log("Successfully ensured keys exist in email_settings");
    } catch (err) {
        console.error("Error:", err);
    }
}

run();
