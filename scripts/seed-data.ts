import "dotenv/config";
import { Pool } from "pg";
import { crypto } from "node:crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
});

const uuid = () => {
  // Basic UUID v4 generator for Node.js if crypto.randomUUID isn't available or for simple polyfill
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

async function seed() {
  console.log("🌱 Seeding database with manual IDs...");

  try {
    // 1. Insert Senders
    console.log("Creating senders...");
    await pool.query(
      `
      INSERT INTO email_senders (id, name, email, app_password, smtp_user, service, daily_limit, sent_today, is_active)
      VALUES 
        ($1, 'Marketing Hub', 'marketing@example.com', 'dummy_pass_1', 'marketing@example.com', 'gmail', 500, 12, true),
        ($2, 'Support Desk', 'support@example.com', 'dummy_pass_2', 'support@example.com', 'outlook', 200, 0, true)
      ON CONFLICT DO NOTHING;
    `,
      [uuid(), uuid()],
    );

    // 2. Insert Template Groups
    console.log("Creating template groups...");
    const groupResult = await pool.query(
      `
      INSERT INTO template_groups (id, name, gap_days_1, gap_days_2, gap_days_3)
      VALUES ($1, 'Onboarding Series', 1, 3, 7)
      RETURNING id;
    `,
      [uuid()],
    );
    const groupId = groupResult.rows[0]?.id;

    // 3. Insert Email Templates
    console.log("Creating email templates...");
    await pool.query(
      `
      INSERT INTO email_templates (id, name, subject, html_content, category)
      VALUES 
        ($1, 'Welcome Msg', 'Hi from AntiGravity!', '<h1>Welcome</h1>', 'general'),
        ($2, 'Re-engagement', 'We miss you!', '<p>Come back!</p>', 'general')
      ON CONFLICT DO NOTHING;
    `,
      [uuid(), uuid()],
    );

    // 4. Insert Contacts
    console.log("Creating contacts...");
    await pool.query(
      `
      INSERT INTO contacts (id, type, value, source_page)
      VALUES 
        ($1, 'email', 'user1@example.com', 'Homepage'),
        ($2, 'email', 'user2@example.com', 'Landing')
      ON CONFLICT DO NOTHING;
    `,
      [uuid(), uuid()],
    );

    console.log("✅ Database seeded successfully with manual IDs!");
  } catch (err) {
    console.error(" Seeding failed:", err.message);
  } finally {
    await pool.end();
  }
}

seed();
