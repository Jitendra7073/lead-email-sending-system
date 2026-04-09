import { google } from "googleapis";
import { executeQuery } from "../db/postgres";

/**
 * Retrieves Gmail integration settings from the database.
 * Falls back to environment variables if settings are not found in DB.
 */
export async function getGmailSettings() {
  try {
    const rows = await executeQuery(`
      SELECT key, value 
      FROM email_settings 
      WHERE key IN ('GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REDIRECT_URI', 'GMAIL_REFRESH_TOKEN')
    `);

    const settings: Record<string, string> = {};
    rows.forEach((row: any) => {
      settings[row.key] = row.value;
    });

    return {
      clientId: settings.GMAIL_CLIENT_ID || process.env.GMAIL_CLIENT_ID,
      clientSecret:
        settings.GMAIL_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET,
      redirectUri:
        settings.GMAIL_REDIRECT_URI ||
        process.env.GMAIL_REDIRECT_URI ||
        "http://localhost:3000/auth/google/callback",
      refreshToken:
        settings.GMAIL_REFRESH_TOKEN || process.env.GMAIL_REFRESH_TOKEN,
    };
  } catch (error) {
    console.error("Error fetching Gmail settings from DB:", error);
    return {
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      redirectUri:
        process.env.GMAIL_REDIRECT_URI ||
        "http://localhost:3000/auth/google/callback",
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    };
  }
}

/**
 * Creates and configures a Gmail API client using settings from DB or Env.
 */
export async function getGmailClient() {
  const { clientId, clientSecret, redirectUri, refreshToken } =
    await getGmailSettings();

  if (!clientId || !clientSecret) {
    throw new Error("Gmail OAuth credentials (Client ID/Secret) are missing.");
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  );

  if (refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
  }

  return google.gmail({ version: "v1", auth: oauth2Client });
}
