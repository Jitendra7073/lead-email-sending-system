/**
 * Script to check email_senders table structure
 */

require("dotenv").config({ path: ".env" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function checkSchema() {
  console.log("🔍 Checking email_senders table structure...\n");

  // Get the specific sender
  const senderId = "bc47593e-2ecf-4333-af8a-eb46c342eb95";

  try {
    // Test the exact query that's failing
    console.log("Testing exact query from sender.ts:");
    const { data: sender, error } = await supabase
      .from("email_senders")
      .select("*")
      .eq("id", senderId);

    console.log(`  Query returned: ${sender?.length || 0} rows`);
    if (error) {
      console.log(`  Error: ${error.message}`);
      console.log(`  Error code: ${error.code}`);
      console.log(`  Error hint: ${error.hint}`);
      console.log(`  Error details: ${JSON.stringify(error, null, 2)}`);
    }

    if (sender && sender.length > 0) {
      console.log("\n  Sender data:");
      console.log(JSON.stringify(sender[0], null, 2));

      // Test with .single() to reproduce the error
      console.log("\nTesting with .single() method:");
      const { data: singleSender, error: singleError } = await supabase
        .from("email_senders")
        .select("*")
        .eq("id", senderId)
        .single();

      if (singleError) {
        console.log(`   Error with .single(): ${singleError.message}`);
        console.log(`  Error code: ${singleError.code}`);
      } else {
        console.log("  ✅ .single() succeeded");
      }
    }
  } catch (error) {
    console.error(" Exception:", error.message);
  }
}

checkSchema().then(() => process.exit(0));
