/**
 * Script to check for duplicate email senders in Supabase
 * Run with: node scripts/check-duplicate-senders.js
 */

require("dotenv").config({ path: ".env" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(" Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicateSenders() {
  console.log("🔍 Checking for duplicate email senders...\n");

  try {
    // Get all senders
    const { data: senders, error } = await supabase
      .from("email_senders")
      .select("*");

    if (error) throw error;

    console.log(`📊 Total senders: ${senders.length}\n`);

    // Check for duplicate IDs
    const idMap = new Map();
    const duplicates = [];

    senders.forEach((sender) => {
      if (idMap.has(sender.id)) {
        duplicates.push({ id: sender.id, email: sender.email });
        console.log(` Duplicate ID found: ${sender.id} (${sender.email})`);
      } else {
        idMap.set(sender.id, sender);
      }
    });

    if (duplicates.length > 0) {
      console.log(`\n⚠️ Found ${duplicates.length} duplicate sender records`);
      console.log("\nTo fix this, you should:");
      console.log("1. Go to Supabase table editor");
      console.log(
        "2. Manually remove duplicate records keeping only one per ID",
      );
      console.log("\nOr use SQL in Supabase SQL Editor:");
      console.log(`
-- Find duplicates
SELECT id, email, COUNT(*)
FROM email_senders
GROUP BY id, email
HAVING COUNT(*) > 1;
      `);
    } else {
      console.log("✅ No duplicate IDs found in email_senders table");
    }

    // Check for the specific sender from the error
    const problemSenderId = "bc47593e-2ecf-4333-af8a-eb46c342eb95";
    const { data: problemSender } = await supabase
      .from("email_senders")
      .select("*")
      .eq("id", problemSenderId);

    console.log(`\n🔍 Checking specific sender: ${problemSenderId}`);
    console.log(`   Found: ${problemSender.length} records`);

    if (problemSender.length > 1) {
      console.log("   ⚠️ DUPLICATE FOUND! This is causing the error.");
      problemSender.forEach((s, i) => {
        console.log(
          `   ${i + 1}. Email: ${s.email}, Name: ${s.name}, Created: ${s.created_at}`,
        );
      });
    } else if (problemSender.length === 0) {
      console.log(
        "   ⚠️ SENDER NOT FOUND! The sender_id in the queue doesn't exist.",
      );
    } else {
      console.log("   ✅ OK - Only one record found");
    }
  } catch (error) {
    console.error(" Error:", error.message);
  }
}

checkDuplicateSenders().then(() => process.exit(0));
