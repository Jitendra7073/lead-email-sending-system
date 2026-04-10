/**
 * Migration: Add Email Aliases Support
 *
 * This migration adds support for email aliases (sub-emails) for SMTP accounts.
 * Each SMTP account can have multiple verified alias addresses that can be used
 * as the "from" address when sending emails.
 *
 * Run: node scripts/add-aliases-support.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Adding email_aliases support...');

    // Create email_aliases table
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
      );
    `);

    console.log('✓ Created email_aliases table');

    // Create index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_aliases_sender_id
      ON email_aliases(sender_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_aliases_alias_email
      ON email_aliases(alias_email);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_aliases_is_verified
      ON email_aliases(is_verified) WHERE is_verified = true;
    `);

    console.log('✓ Created indexes');

    // Add from_alias column to email_queue to track which alias was used
    await client.query(`
      ALTER TABLE email_queue
      ADD COLUMN IF NOT EXISTS from_alias_id UUID REFERENCES email_aliases(id);
    `);

    console.log('✓ Added from_alias_id to email_queue');

    // Add a default alias for each existing sender (the sender's own email)
    const { rows: existingSenders } = await client.query(`
      SELECT id, email, name
      FROM email_senders
      WHERE NOT EXISTS (
        SELECT 1 FROM email_aliases
        WHERE email_aliases.sender_id = email_senders.id
        AND email_aliases.alias_email = email_senders.email
      );
    `);

    for (const sender of existingSenders) {
      await client.query(`
        INSERT INTO email_aliases (sender_id, alias_email, alias_name, is_verified, verification_method)
        VALUES ($1, $2, $3, true, 'auto_main_email')
      `, [sender.id, sender.email, sender.name]);
    }

    console.log(`✓ Created default aliases for ${existingSenders.length} existing senders`);

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Rolling back email_aliases support...');

    await client.query(`
      ALTER TABLE email_queue
      DROP COLUMN IF EXISTS from_alias_id;
    `);

    await client.query(`
      DROP TABLE IF EXISTS email_aliases;
    `);

    await client.query('COMMIT');
    console.log('\n✅ Rollback completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
const command = process.argv[2];

if (command === 'down') {
  down().catch(console.error);
} else {
  up().catch(console.error);
}
