/**
 * Direct SQL Migration Runner
 * Runs the email_aliases migration SQL directly
 */

const fs = require('fs');
const path = require('path');

// Load DATABASE_URL from .env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

const DATABASE_URL = envContent
  .split('\n')
  .find(line => line.startsWith('DATABASE_URL='))
  ?.split('=')[1]
  ?.trim();

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

// Parse connection string
const match = DATABASE_URL.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);

if (!match) {
  console.error('❌ Invalid DATABASE_URL format');
  process.exit(1);
}

const [, user, password, host, port, database] = match;

console.log('🔧 Connecting to database...');
console.log(`   Host: ${host}`);
console.log(`   Port: ${port}`);
console.log(`   Database: ${database}`);
console.log(`   User: ${user}`);
console.log('');

// Import pg
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  console.log('✅ Connected to database!\n');

  try {
    await client.query('BEGIN');
    console.log('📋 Starting migration...\n');

    // Step 1: Create email_aliases table
    console.log('Creating email_aliases table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_aliases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL REFERENCES email_senders(id) ON DELETE CASCADE,
        alias_email TEXT NOT NULL,
        alias_name TEXT,
        is_verified BOOLEAN DEFAULT false,
        verification_method TEXT DEFAULT 'manual',
        dns_spf_valid BOOLEAN DEFAULT null,
        dns_dkim_valid BOOLEAN DEFAULT null,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(sender_id, alias_email)
      )
    `);
    console.log('✓ email_aliases table created\n');

    // Step 2: Create indexes
    console.log('Creating indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_email_aliases_sender_id ON email_aliases(sender_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_email_aliases_alias_email ON email_aliases(alias_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_email_aliases_is_verified ON email_aliases(is_verified) WHERE is_verified = true`);
    console.log('✓ Indexes created\n');

    // Step 3: Add from_alias_id to email_queue
    console.log('Adding from_alias_id column to email_queue...');
    try {
      await client.query(`ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS from_alias_id UUID REFERENCES email_aliases(id)`);
      console.log('✓ Column added\n');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('⊙ Column already exists (skipping)\n');
      } else {
        throw err;
      }
    }

    // Step 4: Create default aliases for existing senders
    console.log('Creating default aliases for existing senders...');
    const result = await client.query(`
      INSERT INTO email_aliases (sender_id, alias_email, alias_name, is_verified, verification_method)
      SELECT
        id,
        email,
        name,
        true,
        'auto_main_email'
      FROM email_senders
      WHERE NOT EXISTS (
        SELECT 1 FROM email_aliases
        WHERE email_aliases.sender_id = email_senders.id
        AND email_aliases.alias_email = email_senders.email
      )
      RETURNING id
    `);

    console.log(`✓ Created ${result.rows.length} default aliases\n`);

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!\n');

    // Verify migration
    const verifyResult = await client.query('SELECT COUNT(*) as count FROM email_aliases');
    const count = verifyResult.rows[0].count;
    console.log(`📊 Verification: ${count} total aliases in database\n`);

    // Show sample data
    const sampleResult = await client.query(`
      SELECT
        a.alias_email,
        a.is_verified,
        s.email as sender_email
      FROM email_aliases a
      LEFT JOIN email_senders s ON a.sender_id = s.id
      LIMIT 5
    `);

    if (sampleResult.rows.length > 0) {
      console.log('Sample aliases:');
      sampleResult.rows.forEach(row => {
        console.log(`  - ${row.alias_email} (${row.is_verified ? '✓ verified' : '✗ unverified'})`);
        console.log(`    Sender: ${row.sender_email}`);
      });
      console.log('');
    }

    console.log('🎉 Email aliases feature is now ready to use!\n');
    console.log('Next steps:');
    console.log('  1. Go to /senders page');
    console.log('  2. Click "Add" on any sender card');
    console.log('  3. Add new aliases');
    console.log('  4. Verify and start sending!\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
