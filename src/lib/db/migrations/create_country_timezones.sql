-- Migration: Create country_timezones table
-- Description: Store timezone and business hours configuration for countries

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS country_timezones CASCADE;

-- Create country_timezones table
CREATE TABLE country_timezones (
  id SERIAL PRIMARY KEY,
  country_code VARCHAR(2) UNIQUE NOT NULL,
  country_name VARCHAR(100) NOT NULL,
  default_timezone VARCHAR(50) NOT NULL,
  business_hours_start VARCHAR(5) NOT NULL DEFAULT '09:00',
  business_hours_end VARCHAR(5) NOT NULL DEFAULT '18:00',
  weekend_days VARCHAR(50) NOT NULL DEFAULT 'Saturday,Sunday',
  region VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_country_code CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT valid_timezone CHECK (default_timezone ~ '^[\w/]+$'),
  CONSTRAINT valid_time_format CHECK (business_hours_start ~ '^\d{2}:\d{2}$'),
  CONSTRAINT valid_time_format_end CHECK (business_hours_end ~ '^\d{2}:\d{2}$')
);

-- Create index on country_code for fast lookups
CREATE INDEX idx_country_timezones_country_code ON country_timezones(country_code);

-- Create index on region for regional queries
CREATE INDEX idx_country_timezones_region ON country_timezones(region);

-- Insert sample data for major countries
INSERT INTO country_timezones (country_code, country_name, default_timezone, business_hours_start, business_hours_end, weekend_days, region) VALUES
-- North America
('US', 'United States', 'America/New_York', '09:00', '18:00', 'Saturday,Sunday', 'North America'),
('CA', 'Canada', 'America/Toronto', '09:00', '17:00', 'Saturday,Sunday', 'North America'),
('MX', 'Mexico', 'America/Mexico_City', '09:00', '18:00', 'Saturday,Sunday', 'North America'),

-- Europe
('GB', 'United Kingdom', 'Europe/London', '09:00', '17:00', 'Saturday,Sunday', 'Europe'),
('DE', 'Germany', 'Europe/Berlin', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
('FR', 'France', 'Europe/Paris', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
('IT', 'Italy', 'Europe/Rome', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
('ES', 'Spain', 'Europe/Madrid', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
('NL', 'Netherlands', 'Europe/Amsterdam', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
('CH', 'Switzerland', 'Europe/Zurich', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
('SE', 'Sweden', 'Europe/Stockholm', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
('NO', 'Norway', 'Europe/Oslo', '09:00', '17:00', 'Saturday,Sunday', 'Europe'),
('DK', 'Denmark', 'Europe/Copenhagen', '09:00', '17:00', 'Saturday,Sunday', 'Europe'),
('PL', 'Poland', 'Europe/Warsaw', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
('CZ', 'Czech Republic', 'Europe/Prague', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
('AT', 'Austria', 'Europe/Vienna', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
('BE', 'Belgium', 'Europe/Brussels', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
('IE', 'Ireland', 'Europe/Dublin', '09:00', '17:00', 'Saturday,Sunday', 'Europe'),
('PT', 'Portugal', 'Europe/Lisbon', '09:00', '18:00', 'Saturday,Sunday', 'Europe'),
('GR', 'Greece', 'Europe/Athens', '09:00', '17:00', 'Saturday,Sunday', 'Europe'),
('FI', 'Finland', 'Europe/Helsinki', '09:00', '17:00', 'Saturday,Sunday', 'Europe'),

-- Asia Pacific
('AU', 'Australia', 'Australia/Sydney', '09:00', '17:00', 'Saturday,Sunday', 'Asia Pacific'),
('NZ', 'New Zealand', 'Pacific/Auckland', '09:00', '17:00', 'Saturday,Sunday', 'Asia Pacific'),
('JP', 'Japan', 'Asia/Tokyo', '09:00', '18:00', 'Saturday,Sunday', 'Asia Pacific'),
('KR', 'South Korea', 'Asia/Seoul', '09:00', '18:00', 'Saturday,Sunday', 'Asia Pacific'),
('CN', 'China', 'Asia/Shanghai', '09:00', '18:00', 'Saturday,Sunday', 'Asia Pacific'),
('HK', 'Hong Kong', 'Asia/Hong_Kong', '09:00', '18:00', 'Saturday,Sunday', 'Asia Pacific'),
('SG', 'Singapore', 'Asia/Singapore', '09:00', '18:00', 'Saturday,Sunday', 'Asia Pacific'),
('MY', 'Malaysia', 'Asia/Kuala_Lumpur', '09:00', '18:00', 'Saturday,Sunday', 'Asia Pacific'),
('TH', 'Thailand', 'Asia/Bangkok', '09:00', '18:00', 'Saturday,Sunday', 'Asia Pacific'),
('ID', 'Indonesia', 'Asia/Jakarta', '09:00', '17:00', 'Saturday,Sunday', 'Asia Pacific'),
('PH', 'Philippines', 'Asia/Manila', '09:00', '18:00', 'Saturday,Sunday', 'Asia Pacific'),
('VN', 'Vietnam', 'Asia/Ho_Chi_Minh', '09:00', '17:00', 'Saturday,Sunday', 'Asia Pacific'),
('TW', 'Taiwan', 'Asia/Taipei', '09:00', '18:00', 'Saturday,Sunday', 'Asia Pacific'),
('IN', 'India', 'Asia/Kolkata', '10:00', '19:00', 'Sunday', 'Asia Pacific'),

-- Middle East
('AE', 'United Arab Emirates', 'Asia/Dubai', '09:00', '18:00', 'Friday,Saturday', 'Middle East'),
('SA', 'Saudi Arabia', 'Asia/Riyadh', '09:00', '17:00', 'Friday,Saturday', 'Middle East'),
('QA', 'Qatar', 'Asia/Qatar', '09:00', '17:00', 'Friday,Saturday', 'Middle East'),
('KW', 'Kuwait', 'Asia/Kuwait', '09:00', '17:00', 'Friday,Saturday', 'Middle East'),
('BH', 'Bahrain', 'Asia/Bahrain', '09:00', '17:00', 'Friday,Saturday', 'Middle East'),
('OM', 'Oman', 'Asia/Muscat', '09:00', '17:00', 'Friday,Saturday', 'Middle East'),
('JO', 'Jordan', 'Asia/Amman', '09:00', '17:00', 'Friday,Saturday', 'Middle East'),
('LB', 'Lebanon', 'Asia/Beirut', '09:00', '17:00', 'Friday,Saturday', 'Middle East'),
('IL', 'Israel', 'Asia/Jerusalem', '09:00', '17:00', 'Friday,Saturday', 'Middle East'),

-- South Asia
('PK', 'Pakistan', 'Asia/Karachi', '10:00', '19:00', 'Sunday', 'South Asia'),
('BD', 'Bangladesh', 'Asia/Dhaka', '10:00', '19:00', 'Friday,Saturday', 'South Asia'),
('LK', 'Sri Lanka', 'Asia/Colombo', '09:00', '18:00', 'Sunday', 'South Asia'),
('NP', 'Nepal', 'Asia/Kathmandu', '10:00', '19:00', 'Saturday', 'South Asia'),

-- Africa
('ZA', 'South Africa', 'Africa/Johannesburg', '09:00', '17:00', 'Saturday,Sunday', 'Africa'),
('NG', 'Nigeria', 'Africa/Lagos', '09:00', '17:00', 'Saturday,Sunday', 'Africa'),
('KE', 'Kenya', 'Africa/Nairobi', '09:00', '17:00', 'Saturday,Sunday', 'Africa'),
('EG', 'Egypt', 'Africa/Cairo', '09:00', '17:00', 'Friday,Saturday', 'Africa'),
('MA', 'Morocco', 'Africa/Casablanca', '09:00', '18:00', 'Saturday,Sunday', 'Africa'),

-- South America
('BR', 'Brazil', 'America/Sao_Paulo', '09:00', '18:00', 'Saturday,Sunday', 'South America'),
('AR', 'Argentina', 'America/Buenos_Aires', '09:00', '18:00', 'Saturday,Sunday', 'South America'),
('CL', 'Chile', 'America/Santiago', '09:00', '18:00', 'Saturday,Sunday', 'South America'),
('CO', 'Colombia', 'America/Bogota', '09:00', '18:00', 'Saturday,Sunday', 'South America'),
('PE', 'Peru', 'America/Lima', '09:00', '18:00', 'Saturday,Sunday', 'South America'),
('MX', 'Mexico', 'America/Mexico_City', '09:00', '18:00', 'Saturday,Sunday', 'South America'),
('VE', 'Venezuela', 'America/Caracas', '09:00', '17:00', 'Saturday,Sunday', 'South America');

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_country_timezones_updated_at
    BEFORE UPDATE ON country_timezones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE country_timezones IS 'Stores timezone and business hours configuration for countries worldwide';
COMMENT ON COLUMN country_timezones.country_code IS 'ISO 3166-1 alpha-2 country code';
COMMENT ON COLUMN country_timezones.default_timezone IS 'IANA timezone identifier (e.g., America/New_York)';
COMMENT ON COLUMN country_timezones.business_hours_start IS 'Start of business hours in HH:mm format';
COMMENT ON COLUMN country_timezones.business_hours_end IS 'End of business hours in HH:mm format';
COMMENT ON COLUMN country_timezones.weekend_days IS 'Comma-separated list of weekend days (e.g., Saturday,Sunday)';
COMMENT ON COLUMN country_timezones.region IS 'Geographical region for grouping';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Country timezones table created successfully with % countries', (SELECT COUNT(*) FROM country_timezones);
END $$;
