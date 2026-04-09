/**
 * Script to check the specific queue item that's failing
 */

require("dotenv").config({ path: ".env" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQueueItem() {
  const queueId = "0e46b3d5-36c2-4ece-a54c-83fa0b6f2112";
  const senderId = "bc47593e-2ecf-4333-af8a-eb46c342eb95";

  console.log("🔍 Checking queue item:", queueId);
  console.log("Expected sender_id:", senderId);
  console.log();

  try {
    // Get queue item
    const { data: queue, error: queueError } = await supabase
      .from("email_queue")
      .select("*")
      .eq("id", queueId)
      .single();

    if (queueError) {
      console.log(" Queue fetch error:", queueError.message);
    } else {
      console.log("✅ Queue item found:");
      console.log("  Status:", queue.status);
      console.log("  Sender ID:", queue.sender_id);
      console.log("  Recipient:", queue.recipient_email);
      console.log("  Subject:", queue.subject);
    }

    // Check sender
    console.log("\n🔍 Checking sender...");

    // Method 1: Using .eq() without .single()
    const { data: senders1, error: error1 } = await supabase
      .from("email_senders")
      .select("*")
      .eq("id", queue?.sender_id || senderId);

    console.log("Method 1 (.eq only):");
    console.log(`  Rows returned: ${senders1?.length || 0}`);
    if (error1) console.log(`  Error: ${error1.message}`);

    // Method 2: Using .single()
    console.log("\nMethod 2 (.eq + .single()):");
    const { data: sender2, error: error2 } = await supabase
      .from("email_senders")
      .select("*")
      .eq("id", queue?.sender_id || senderId)
      .single();

    if (error2) {
      console.log(`   Error: ${error2.message}`);
      console.log(`  Code: ${error2.code}`);
    } else {
      console.log("  ✅ Success");
      console.log(`  Email: ${sender2.email}`);
    }

    // Check for ANY duplicate IDs in the table
    console.log("\n🔍 Checking ALL senders for duplicate IDs...");
    const { data: allSenders } = await supabase
      .from("email_senders")
      .select("id");

    const idCounts = {};
    allSenders.forEach((s) => {
      idCounts[s.id] = (idCounts[s.id] || 0) + 1;
    });

    const duplicates = Object.entries(idCounts).filter(
      ([id, count]) => count > 1,
    );
    if (duplicates.length > 0) {
      console.log(" Duplicate IDs found:");
      duplicates.forEach(([id, count]) =>
        console.log(`  ${id}: ${count} occurrences`),
      );
    } else {
      console.log("✅ No duplicate IDs");
    }
  } catch (error) {
    console.error(" Exception:", error.message);
    console.error(error.stack);
  }
}

checkQueueItem().then(() => process.exit(0));
