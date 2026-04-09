require("dotenv").config();

const { dbPool } = require("./src/lib/db/postgres.ts");

async function createEmailRepliesTable() {
  const client = await dbPool.connect();
  try {
    console.log("Creating email_replies table...");

    // Create the table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_replies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        queue_id UUID REFERENCES email_queue(id) ON DELETE CASCADE,
        message_id TEXT NOT NULL,
        reply_message_id TEXT NOT NULL,
        from_email TEXT NOT NULL,
        from_name TEXT,
        subject TEXT NOT NULL,
        body TEXT,
        received_at TIMESTAMPTZ DEFAULT NOW(),
        processed BOOLEAN DEFAULT FALSE,
        thread_id TEXT,
        in_reply_to TEXT,
        is_reply BOOLEAN DEFAULT true,
        recipient_email TEXT NOT NULL,
        original_subject TEXT NOT NULL
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_replies_queue_id ON email_replies(queue_id);
      CREATE INDEX IF NOT EXISTS idx_email_replies_reply_message_id ON email_replies(reply_message_id);
      CREATE INDEX IF NOT EXISTS idx_email_replies_from_email ON email_replies(from_email);
      CREATE INDEX IF NOT EXISTS idx_email_replies_in_reply_to ON email_replies(in_reply_to);
      CREATE INDEX IF NOT EXISTS idx_email_replies_thread_id ON email_replies(thread_id);
      CREATE INDEX IF NOT EXISTS idx_email_replies_processed ON email_replies(processed);
      CREATE INDEX IF NOT EXISTS idx_email_replies_received_at ON email_replies(received_at DESC);
    `);

    console.log("✅ email_replies table created successfully");
  } catch (error) {
    console.error(" Error creating table:", error.message);
  } finally {
    client.release();
    await dbPool.end();
  }
}

createEmailRepliesTable();
