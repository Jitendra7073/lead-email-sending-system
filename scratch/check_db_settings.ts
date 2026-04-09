import { executeQuery } from "./src/lib/db/postgres.ts";

async function checkSettings() {
  try {
    const settings = await executeQuery("SELECT key, label FROM email_settings");
    console.log(JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error(error);
  }
}

checkSettings();
