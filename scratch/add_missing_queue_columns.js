const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const migrations = [
    `ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS adjustment_reason jsonb`,
    `ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS original_scheduled_at timestamptz`,
    `ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS paused_at timestamptz`,
    `ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS passed_weekend_check boolean`,
    `ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS passed_business_hours_check boolean`,
];

(async () => {
    for (const sql of migrations) {
        try {
            await pool.query(sql);
            console.log('✅', sql);
        } catch (e) {
            console.error('❌', sql, '->', e.message);
        }
    }
    await pool.end();
})();
