const { Pool } = require("pg");
require("dotenv").config({ path: ".env" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("Creating country_timezones table...");

    // Drop table if exists
    await client.query(`DROP TABLE IF EXISTS country_timezones CASCADE;`);

    // Create the table with simpler timezone constraint
    await client.query(`
      CREATE TABLE country_timezones (
        id SERIAL PRIMARY KEY,
        country_code VARCHAR(2) UNIQUE NOT NULL,
        country_name VARCHAR(100) NOT NULL,
        default_timezone VARCHAR(50) NOT NULL,
        business_hours_start VARCHAR(5) NOT NULL DEFAULT '09:00',
        business_hours_end VARCHAR(5) NOT NULL DEFAULT '18:00',
        weekend_days VARCHAR(50) NOT NULL DEFAULT 'Saturday,Sunday',
        region VARCHAR(50),
        utc_offset VARCHAR(10),
        dst_observed BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),

        CONSTRAINT valid_country_code CHECK (country_code ~ '^[A-Z]{2}$'),
        CONSTRAINT valid_time_format CHECK (business_hours_start ~ '^\\d{2}:\\d{2}$'),
        CONSTRAINT valid_time_format_end CHECK (business_hours_end ~ '^\\d{2}:\\d{2}$')
      );
    `);

    console.log("Table created successfully");

    // Create indexes
    await client.query(
      `CREATE INDEX idx_country_timezones_country_code ON country_timezones(country_code);`,
    );
    await client.query(
      `CREATE INDEX idx_country_timezones_region ON country_timezones(region);`,
    );

    // Create trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create trigger
    await client.query(`
      CREATE TRIGGER update_country_timezones_updated_at
          BEFORE UPDATE ON country_timezones
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log("Inserting sample data...");

    // Insert sample data for major countries
    const result = await client.query(`
      INSERT INTO country_timezones (country_code, country_name, default_timezone, business_hours_start, business_hours_end, weekend_days, region) VALUES
      ('US', 'United States', 'America/New_York', '09:00', '18:00', 'Saturday,Sunday', 'North America'),
      ('CA', 'Canada', 'America/Toronto', '09:00', '17:00', 'Saturday,Sunday', 'North America'),
      ('MX', 'Mexico', 'America/Mexico_City', '09:00', '18:00', 'Saturday,Sunday', 'North America'),
      ('GB', 'United Kingdom', 'Europe/London', '09:00', '17:00', 'Saturday,Sunday', 'Europe'),
      ('DE', 'Germany', 'Europe/Berlin', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
      ('FR', 'France', 'Europe/Paris', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
      ('IT', 'Italy', 'Europe/Rome', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
      ('ES', 'Spain', 'Europe/Madrid', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
      ('NL', 'Netherlands', 'Europe/Amsterdam', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
      ('CH', 'Switzerland', 'Europe/Zurich', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
      ('AU', 'Australia', 'Australia/Sydney', '09:00', '17:00', 'Saturday,Sunday', 'Asia Pacific'),
      ('NZ', 'New Zealand', 'Pacific/Auckland', '09:00', '17:00', 'Saturday,Sunday', 'Asia Pacific'),
      ('JP', 'Japan', 'Asia/Tokyo', '09:00', '18:00', 'Saturday,Sunday', 'Asia Pacific'),
      ('KR', 'South Korea', 'Asia/Seoul', '09:00', '18:00', 'Saturday,Sunday', 'Asia Pacific'),
      ('CN', 'China', 'Asia/Shanghai', '09:00', '18:00', 'Saturday,Sunday', 'Asia Pacific'),
      ('HK', 'Hong Kong', 'Asia/Hong_Kong', '09:00', '18:00', 'Saturday,Sunday', 'Asia Pacific'),
      ('SG', 'Singapore', 'Asia/Singapore', '09:00', '18:00', 'Saturday,Sunday', 'Asia Pacific'),
      ('IN', 'India', 'Asia/Kolkata', '10:00', '19:00', 'Sunday', 'Asia Pacific'),
      ('AE', 'United Arab Emirates', 'Asia/Dubai', '09:00', '18:00', 'Friday,Saturday', 'Middle East'),
      ('SA', 'Saudi Arabia', 'Asia/Riyadh', '09:00', '17:00', 'Friday,Saturday', 'Middle East'),
      ('BR', 'Brazil', 'America/Sao_Paulo', '09:00', '18:00', 'Saturday,Sunday', 'South America'),
      ('AR', 'Argentina', 'America/Buenos_Aires', '09:00', '18:00', 'Saturday,Sunday', 'South America'),
      ('ZA', 'South Africa', 'Africa/Johannesburg', '09:00', '17:00', 'Saturday,Sunday', 'Africa'),
      ('NG', 'Nigeria', 'Africa/Lagos', '09:00', '17:00', 'Saturday,Sunday', 'Africa'),
      ('EG', 'Egypt', 'Africa/Cairo', '09:00', '17:00', 'Friday,Saturday', 'Africa')
      ON CONFLICT (country_code) DO NOTHING
      RETURNING *;
    `);

    await client.query("COMMIT");
    console.log(
      `✅ country_timezones table created successfully with ${result.rows.length} countries.`,
    );
    process.exit(0);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(" Migration Failed:", error.message);
    console.error("Details:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
