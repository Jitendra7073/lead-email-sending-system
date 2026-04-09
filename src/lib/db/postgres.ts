import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("⚠️ DATABASE_URL is not set in the environment variables!");
}

const useSsl =
  process.env.DATABASE_SSL === "true" ||
  (connectionString?.includes("supabase.com") &&
    process.env.DATABASE_SSL !== "false");

export const dbPool = new Pool({
  connectionString,
  // Conditional SSL to handle local vs cloud development
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

// Test connection on startup
dbPool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error(" Database connection error:", err.message);
  } else {
    console.log("✅ Database connected successfully at:", res.rows[0].now);
  }
});

/**
 * Basic wrapper to execute native queries easily without manually releasing pool clients
 */
export async function executeQuery(text: string, params?: any[]) {
  const client = await dbPool.connect();
  try {
    const res = await client.query(text, params);
    return res.rows;
  } finally {
    client.release();
  }
}
