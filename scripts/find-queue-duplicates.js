/**
 * Script to find and fix duplicate queue items
 */

require("dotenv").config({ path: ".env" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findQueueDuplicates() {
  console.log("🔍 Finding duplicate queue items...\n");

  try {
    // Get all queue items
    const { data: allQueues, error } = await supabase
      .from("email_queue")
      .select("*");

    if (error) throw error;

    console.log(`📊 Total queue items: ${allQueues.length}`);

    // Find duplicates by ID
    const idMap = new Map();
    const duplicateIds = new Set();

    allQueues.forEach((item) => {
      if (idMap.has(item.id)) {
        duplicateIds.add(item.id);
      } else {
        idMap.set(item.id, item);
      }
    });

    console.log(`\n📋 Duplicate IDs found: ${duplicateIds.size}`);

    if (duplicateIds.size > 0) {
      console.log("\n⚠️ DUPLICATE QUEUE ITEMS:\n");

      for (const dupId of duplicateIds) {
        const dupItems = allQueues.filter((q) => q.id === dupId);
        console.log(`ID: ${dupId}`);
        console.log(`  Occurrences: ${dupItems.length}`);
        dupItems.forEach((item, idx) => {
          console.log(
            `  [${idx + 1}] Status: ${item.status}, Recipient: ${item.recipient_email}, Created: ${item.created_at}`,
          );
        });
        console.log("");
      }

      console.log(
        "\n🔧 SQL to fix duplicates (keep the earliest created, delete others):\n",
      );
      console.log("-- For each duplicate ID, run this in Supabase SQL Editor:");
      for (const dupId of duplicateIds) {
        const dupItems = allQueues.filter((q) => q.id === dupId);
        const sorted = [...dupItems].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );

        console.log(
          `-- ID: ${dupId} - Keep ${sorted[0].created_at}, delete ${sorted.length - 1} newer`,
        );
        for (let i = 1; i < sorted.length; i++) {
          console.log(
            `DELETE FROM email_queue WHERE id = '${dupId}' AND created_at = '${sorted[i].created_at}';`,
          );
        }
        console.log("");
      }
    } else {
      console.log("✅ No duplicate queue IDs found");
    }

    // Check the specific problematic ID
    const problemId = "0e46b3d5-36c2-4ece-a54c-83fa0b6f2112";
    console.log(`\n🔍 Specific queue ID from error: ${problemId}`);
    const { data: problemItems } = await supabase
      .from("email_queue")
      .select("*")
      .eq("id", problemId);

    console.log(`   Found: ${problemItems.length} records`);
    if (problemItems.length > 1) {
      console.log("   ⚠️ DUPLICATE! This is why .single() fails.");
      problemItems.forEach((item, i) => {
        console.log(
          `   [${i + 1}] Status: ${item.status}, Created: ${item.created_at}`,
        );
      });
    }
  } catch (error) {
    console.error(" Error:", error.message);
  }
}

findQueueDuplicates().then(() => process.exit(0));
