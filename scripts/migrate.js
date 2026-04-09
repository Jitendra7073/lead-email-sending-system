const { Pool } = require("pg");
require("dotenv").config({ path: "../.env" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("⚠️ DATABASE_URL is not set in the environment variables!");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("Creating Synced Tables (from Local)...");

    // Sites table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sites (
        id INTEGER PRIMARY KEY,
        search_id INTEGER,
        url TEXT NOT NULL UNIQUE,
        country TEXT DEFAULT 'in',
        is_wordpress BOOLEAN NOT NULL DEFAULT false,
        confidence_score INTEGER DEFAULT 0,
        indicators JSONB,
        error TEXT,
        search_query TEXT,
        emails JSONB,
        phones JSONB,
        linkedin_profiles JSONB,
        text_content TEXT,
        page_title TEXT,
        meta_description TEXT,
        tags JSONB,
        ai_status TEXT DEFAULT 'pending',
        ai_verified_wp INTEGER,
        ai_content_relevant INTEGER,
        ai_actual_category TEXT,
        ai_content_summary TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        synced_at TIMESTAMPTZ DEFAULT NOW(),
        content_hash TEXT
      );
    `);

    // Contacts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY,
        site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('email', 'phone', 'linkedin')),
        value TEXT NOT NULL,
        source_page TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        synced_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Keywords table
    await client.query(`
      CREATE TABLE IF NOT EXISTS keywords (
        id INTEGER PRIMARY KEY,
        keyword TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'pending',
        max_sites INTEGER DEFAULT 20,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        synced_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Searches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS searches (
        id INTEGER PRIMARY KEY,
        query TEXT NOT NULL,
        country TEXT DEFAULT 'in',
        total_sites INTEGER NOT NULL,
        wordpress_count INTEGER NOT NULL,
        non_wordpress_count INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        synced_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Company Executives table
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_executives (
        id INTEGER PRIMARY KEY,
        site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
        company_url TEXT NOT NULL,
        company_name TEXT,
        profile_url TEXT NOT NULL UNIQUE,
        name TEXT,
        headline TEXT,
        role_category TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        synced_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log("Creating Email System Specific Database Structures...");

    // Email Senders
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_senders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        app_password TEXT NOT NULL,
        service TEXT DEFAULT 'gmail',
        smtp_host TEXT DEFAULT 'smtp.gmail.com',
        smtp_port INTEGER DEFAULT 587,
        smtp_user TEXT,
        daily_limit INTEGER DEFAULT 500,
        is_active BOOLEAN DEFAULT true,
        sent_today INTEGER DEFAULT 0,
        last_reset_date TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Email Templates
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        html_content TEXT NOT NULL,
        text_content TEXT,
        description TEXT,
        category TEXT DEFAULT 'general',
        tags TEXT DEFAULT '',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Template Groups (NEW from user discussions)
    await client.query(`
      CREATE TABLE IF NOT EXISTS template_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        gap_days_1 INTEGER DEFAULT 2,
        gap_days_2 INTEGER DEFAULT 5,
        gap_days_3 INTEGER DEFAULT 5,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Group to Template Mapping (Many-to-Many with positions)
    await client.query(`
      CREATE TABLE IF NOT EXISTS template_group_mapping (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID REFERENCES template_groups(id) ON DELETE CASCADE,
        template_id UUID REFERENCES email_templates(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        UNIQUE(group_id, template_id),
        UNIQUE(group_id, position)
      );
    `);

    // Email Campaigns
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        group_id UUID REFERENCES template_groups(id),
        target_type TEXT DEFAULT 'all' CHECK (target_type IN ('all', 'wordpress', 'selected', 'tag')),
        status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'paused', 'completed')),
        total_recipients INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      );
    `);

    // Email Queue
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES email_senders(id),
        contact_id INTEGER REFERENCES contacts(id),
        recipient_email TEXT NOT NULL,
        recipient_name TEXT,
        subject TEXT NOT NULL,
        html_content TEXT NOT NULL,
        text_content TEXT,
        status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled')),
        attempts INTEGER DEFAULT 0,
        error_message TEXT,
        sent_at TIMESTAMPTZ,
        scheduled_at TIMESTAMPTZ,
        country_code TEXT DEFAULT 'in',
        tag TEXT,
        sequence_position INTEGER,
        idempotency_key TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Email Send Log
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_send_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id INTEGER REFERENCES contacts(id),
        contact_email TEXT NOT NULL,
        template_id UUID REFERENCES email_templates(id),
        campaign_id UUID REFERENCES email_campaigns(id),
        send_type TEXT DEFAULT 'main',
        status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Email Settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        label TEXT,
        description TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Insert Default Email Settings ON CONFLICT DO NOTHING
    await client.query(`
      INSERT INTO email_settings (key, value, label, description) VALUES
        ('per_email_delay', '60', 'Per-Email Delay', 'Seconds between emails'),
        ('cycle_cooldown_min', '10', 'Cycle Cooldown Min', 'Minutes after full cycle'),
        ('cycle_cooldown_max', '13', 'Cycle Cooldown Max', 'Minutes after full cycle'),
        ('queue_mode', 'manual', 'Queue Mode', 'Email queue processing mode: auto or manual'),
        ('queue_interval', '5', 'Queue Interval', 'Auto-processing interval in minutes (fixed at 5)'),
        ('last_queue_process', NOW(), 'Last Queue Process', 'Timestamp of last auto-queue processing')
      ON CONFLICT (key) DO NOTHING;
    `);

    // Try creating indexes as well
    console.log("Creating Indexes...");
    try {
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_contacts_site_id ON contacts(site_id);`,
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);`,
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_sites_country ON sites(country);`,
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_sites_is_wordpress ON sites(is_wordpress);`,
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);`,
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled_at ON email_queue(scheduled_at);`,
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_email_queue_campaign_id ON email_queue(campaign_id);`,
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_email_queue_country_code ON email_queue(country_code);`,
      );
    } catch (e) {
      console.warn("Minor Index failure (ignoring):", e.message);
    }

    await client.query("COMMIT");
    console.log("✅ All Tables Migrated Successfully on Supabase.");
    process.exit(0);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(" Migration Failed:", error);
    process.exit(1);
  } finally {
    client.release();
  }
}

runMigrations();
