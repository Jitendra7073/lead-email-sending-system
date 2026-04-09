-- Country Timezones Table
-- Stores timezone information and business hours for different countries

CREATE TABLE IF NOT EXISTS country_timezones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL UNIQUE,
  country_name TEXT NOT NULL,
  default_timezone TEXT NOT NULL,
  business_hours_start TIME DEFAULT '09:00',
  business_hours_end TIME DEFAULT '18:00',
  weekend_days TEXT[] DEFAULT ARRAY['Saturday', 'Sunday'],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast lookups by country code
CREATE INDEX IF NOT EXISTS idx_country_timezones_country_code ON country_timezones(country_code);

-- Insert common country timezones
INSERT INTO country_timezones (country_code, country_name, default_timezone, business_hours_start, business_hours_end, weekend_days) VALUES
  ('US', 'United States', 'America/New_York', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('GB', 'United Kingdom', 'Europe/London', '09:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('IN', 'India', 'Asia/Kolkata', '10:00', '19:00', ARRAY['Sunday']),
  ('CA', 'Canada', 'America/Toronto', '09:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('AU', 'Australia', 'Australia/Sydney', '09:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('DE', 'Germany', 'Europe/Berlin', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('FR', 'France', 'Europe/Paris', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('JP', 'Japan', 'Asia/Tokyo', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('SG', 'Singapore', 'Asia/Singapore', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('AE', 'United Arab Emirates', 'Asia/Dubai', '09:00', '18:00', ARRAY['Friday', 'Saturday']),
  ('IL', 'Israel', 'Asia/Jerusalem', '09:00', '17:00', ARRAY['Friday', 'Saturday']),
  ('SA', 'Saudi Arabia', 'Asia/Riyadh', '09:00', '17:00', ARRAY['Friday', 'Saturday']),
  ('BR', 'Brazil', 'America/Sao_Paulo', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('MX', 'Mexico', 'America/Mexico_City', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('ZA', 'South Africa', 'Africa/Johannesburg', '08:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('NZ', 'New Zealand', 'Pacific/Auckland', '09:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('KR', 'South Korea', 'Asia/Seoul', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('CN', 'China', 'Asia/Shanghai', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('IT', 'Italy', 'Europe/Rome', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('ES', 'Spain', 'Europe/Madrid', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('NL', 'Netherlands', 'Europe/Amsterdam', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('CH', 'Switzerland', 'Europe/Zurich', '08:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('SE', 'Sweden', 'Europe/Stockholm', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('NO', 'Norway', 'Europe/Oslo', '09:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('DK', 'Denmark', 'Europe/Copenhagen', '09:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('FI', 'Finland', 'Europe/Helsinki', '09:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('BE', 'Belgium', 'Europe/Brussels', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('AT', 'Austria', 'Europe/Vienna', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('PL', 'Poland', 'Europe/Warsaw', '09:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('CZ', 'Czech Republic', 'Europe/Prague', '09:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('GR', 'Greece', 'Europe/Athens', '09:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('PT', 'Portugal', 'Europe/Lisbon', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('IE', 'Ireland', 'Europe/Dublin', '09:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('TR', 'Turkey', 'Europe/Istanbul', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('RU', 'Russia', 'Europe/Moscow', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('TH', 'Thailand', 'Asia/Bangkok', '09:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('MY', 'Malaysia', 'Asia/Kuala_Lumpur', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('PH', 'Philippines', 'Asia/Manila', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('ID', 'Indonesia', 'Asia/Jakarta', '09:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('VN', 'Vietnam', 'Asia/Ho_Chi_Minh', '08:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('HK', 'Hong Kong', 'Asia/Hong_Kong', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('TW', 'Taiwan', 'Asia/Taipei', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('AR', 'Argentina', 'America/Argentina/Buenos_Aires', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('CO', 'Colombia', 'America/Bogota', '08:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('PE', 'Peru', 'America/Lima', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('CL', 'Chile', 'America/Santiago', '09:00', '18:00', ARRAY['Saturday', 'Sunday']),
  ('EG', 'Egypt', 'Africa/Cairo', '09:00', '17:00', ARRAY['Friday', 'Saturday']),
  ('NG', 'Nigeria', 'Africa/Lagos', '08:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('KE', 'Kenya', 'Africa/Nairobi', '08:00', '17:00', ARRAY['Saturday', 'Sunday']),
  ('MU', 'Mauritius', 'Indian/Mauritius', '09:00', '17:00', ARRAY['Saturday', 'Sunday'])
ON CONFLICT (country_code) DO NOTHING;
