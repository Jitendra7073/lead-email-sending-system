// Script to add queue_mode setting to email_settings table
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addQueueModeSetting() {
  try {
    console.log("Adding queue_mode setting to email_settings...");

    // Check if setting already exists
    const { data: existing, error: checkError } = await supabase
      .from("email_settings")
      .select("key")
      .eq("key", "queue_mode")
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    if (existing) {
      console.log("✅ queue_mode setting already exists!");
      process.exit(0);
    }

    // Insert the setting
    const { error: insertError } = await supabase
      .from("email_settings")
      .insert({
        key: "queue_mode",
        value: "manual",
        label: "Queue Mode",
        description: "Email queue processing mode: auto or manual",
      });

    if (insertError) {
      throw insertError;
    }

    console.log("✅ queue_mode setting added successfully!");
    process.exit(0);
  } catch (error) {
    console.error(" Failed to add queue_mode setting:", error.message);
    process.exit(1);
  }
}

addQueueModeSetting();
