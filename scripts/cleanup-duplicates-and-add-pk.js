#!/usr/bin/env node
/**
 * Cleanup script to remove duplicate records and add primary key constraints
 * Run this after deploying the .single() fixes to clean up existing data
 *
 * Usage: node scripts/cleanup-duplicates-and-add-pk.js
 *
 * Note: This script generates SQL commands that you should run in Supabase SQL Editor
 * https://supabase.com/dashboard/project/_/sql
 */

require("dotenv").config({ path: ".env" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(" Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("🔍 Analyzing database for duplicates...\n");

  try {
    // Check email_senders
    const { data: senders } = await supabase.from("email_senders").select("id");

    const senderCounts = {};
    senders?.forEach((s) => {
      senderCounts[s.id] = (senderCounts[s.id] || 0) + 1;
    });
    const dupSenders = Object.entries(senderCounts).filter(
      ([id, count]) => count > 1,
    );

    // Check email_queue
    const { data: queues } = await supabase.from("email_queue").select("id");

    const queueCounts = {};
    queues?.forEach((q) => {
      queueCounts[q.id] = (queueCounts[q.id] || 0) + 1;
    });
    const dupQueues = Object.entries(queueCounts).filter(
      ([id, count]) => count > 1,
    );

    console.log("📊 Analysis Results:");
    console.log(
      `  email_senders: ${senders?.length || 0} total, ${dupSenders.length} duplicate IDs`,
    );
    console.log(
      `  email_queue: ${queues?.length || 0} total, ${dupQueues.length} duplicate IDs`,
    );

    if (dupSenders.length === 0 && dupQueues.length === 0) {
      console.log("\n✅ No duplicates found! Database is clean.");
      console.log("\n📝 Recommended next steps:");
      console.log("1. Add primary key constraints if not already present:");
      console.log("   ALTER TABLE email_senders ADD PRIMARY KEY (id);");
      console.log("   ALTER TABLE email_queue ADD PRIMARY KEY (id);");
      return;
    }

    console.log(
      "\n⚠️ Duplicates found! Run these SQL commands in Supabase SQL Editor:\n",
    );

    if (dupSenders.length > 0) {
      console.log(
        "-- Clean up duplicate email_senders (keep earliest created)",
      );
      console.log("-- Delete this script after running\n");
      console.log("DELETE FROM email_senders");
      console.log("WHERE ctid NOT IN (");
      console.log("  SELECT MIN(ctid)");
      console.log("  FROM email_senders");
      console.log("  GROUP BY id");
      console.log(");");
      console.log("ALTER TABLE email_senders ADD PRIMARY KEY (id);\n");
    }

    if (dupQueues.length > 0) {
      console.log("-- Clean up duplicate email_queue (keep earliest created)");
      console.log("-- Delete this script after running\n");
      console.log("DELETE FROM email_queue");
      console.log("WHERE ctid NOT IN (");
      console.log("  SELECT MIN(ctid)");
      console.log("  FROM email_queue");
      console.log("  GROUP BY id");
      console.log(");");
      console.log("ALTER TABLE email_queue ADD PRIMARY KEY (id);\n");
    }

    console.log("-- Verify the fixes:\n");
    console.log("SELECT table_name, constraint_name, constraint_type");
    console.log("FROM information_schema.table_constraints");
    console.log("WHERE table_name IN ('email_queue', 'email_senders')");
    console.log("  AND constraint_type = 'PRIMARY KEY';");
  } catch (error) {
    console.error(" Error:", error.message);
  }
}

main().then(() => process.exit(0));
