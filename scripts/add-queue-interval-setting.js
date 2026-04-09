// Script to add queue_interval setting to email_settings table
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addQueueIntervalSetting() {
  try {
    console.log("Adding queue_interval setting to email_settings...");

    // Check if setting already exists
    const { data: existing, error: checkError } = await supabase
      .from("email_settings")
      .select("key")
      .eq("key", "queue_interval")
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    if (existing) {
      console.log("✅ queue_interval setting already exists!");
      process.exit(0);
    }

    // Insert the setting
    const { error: insertError } = await supabase
      .from("email_settings")
      .insert({
        key: "queue_interval",
        value: "5",
        label: "Queue Interval",
        description: "Auto-processing interval in minutes (fixed at 5)",
      });

    if (insertError) {
      throw insertError;
    }

    console.log("✅ queue_interval setting added successfully!");
    process.exit(0);
  } catch (error) {
    console.error(" Failed to add queue_interval setting:", error.message);
    process.exit(1);
  }
}

addQueueIntervalSetting();
