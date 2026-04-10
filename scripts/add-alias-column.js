/**
 * Add alias_email column to email_senders table
 * Simple approach: one alias per sender
 */

const { Pool } = require('pg');

// Load DATABASE_URL
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

const DATABASE_URL = envContent
  .split('\n')
  .find(line => line.startsWith('DATABASE_URL='))
  ?.split('=')[1]
  ?.trim();

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addAliasColumn() {
  const client = await pool.connect();
  console.log('✅ Connected to database!\n');

  try {
    await client.query('BEGIN');
    console.log('📋 Adding alias_email column to email_senders...\n');

    // Add alias_email column
    await client.query(`
      ALTER TABLE email_senders
      ADD COLUMN IF NOT EXISTS alias_email TEXT
    `);
    console.log('✓ Added alias_email column\n');

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!\n');

    // Verify
    const result = await client.query('SELECT COUNT(*) as count FROM email_senders WHERE alias_email IS NOT NULL');
    console.log(`📊 Senders with alias: ${result.rows[0].count}\n`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addAliasColumn().catch(console.error);
