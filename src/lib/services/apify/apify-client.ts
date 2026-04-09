/**
 * Apify Client Service for Email Verification
 * Handles communication with Apify's Email Verifier Deliverability Checker
 */

import { executeQuery } from "@/lib/db/postgres";

export interface ApifySettings {
  api_key: string;
  actor_id: string;
  user_id: string;
  timeout_ms: number;
  max_retries: number;
  batch_size: number;
  recheck_days: number;
}

export interface EmailVerificationResult {
  status: "valid" | "invalid" | "risky" | "unknown";
  reason: string;
  details?: any;
}

/**
 * Fetch Apify settings from database with environment variable fallbacks
 */
export async function getApifySettings(): Promise<ApifySettings> {
  try {
    const settings = await executeQuery(`
      SELECT key, value FROM email_settings
      WHERE key LIKE 'apify_%'
    `);

    const settingsObj: Record<string, string> = {};
    settings.forEach((s: any) => {
      settingsObj[s.key] = s.value;
    });

    return {
      api_key: settingsObj.apify_api_key || process.env.APIFY_API_KEY || "",
      actor_id:
        settingsObj.apify_actor_id ||
        process.env.APIFY_ACTOR_ID ||
        "yasir-on-apify/email-verifier-deliverability-checker",
      user_id: settingsObj.apify_user_id || process.env.APIFY_USER_ID || "",
      timeout_ms:
        parseInt(settingsObj.apify_timeout_ms) ||
        parseInt(process.env.APIFY_TIMEOUT_MS || "300000"),
      max_retries:
        parseInt(settingsObj.apify_max_retries) ||
        parseInt(process.env.APIFY_MAX_RETRIES || "3"),
      batch_size:
        parseInt(settingsObj.apify_batch_size) ||
        parseInt(process.env.APIFY_BATCH_SIZE || "10"),
      recheck_days:
        parseInt(settingsObj.apify_recheck_days) ||
        parseInt(process.env.APIFY_RECHECK_DAYS || "30"),
    };
  } catch (error) {
    console.error("Error fetching Apify settings:", error);
    return {
      api_key: process.env.APIFY_API_KEY || "",
      actor_id:
        process.env.APIFY_ACTOR_ID ||
        "yasir-on-apify/email-verifier-deliverability-checker",
      user_id: process.env.APIFY_USER_ID || "",
      timeout_ms: parseInt(process.env.APIFY_TIMEOUT_MS || "300000"),
      max_retries: parseInt(process.env.APIFY_MAX_RETRIES || "3"),
      batch_size: parseInt(process.env.APIFY_BATCH_SIZE || "10"),
      recheck_days: parseInt(process.env.APIFY_RECHECK_DAYS || "30"),
    };
  }
}

/**
 * Normalize email address (lowercase and trim)
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Call Apify API to verify a single email
 */
export async function verifyEmailWithApify(
  email: string,
): Promise<EmailVerificationResult> {
  const settings = await getApifySettings();

  if (!settings.api_key) {
    throw new Error(
      "Apify API key is not configured. Please add it in Settings.",
    );
  }

  const normalizedEmail = normalizeEmail(email);
  const safeActorId = encodeURIComponent(settings.actor_id);

  try {
    /**
     * IMPROVEMENT: The specific Actor "yasir-on-apify/email-verifier-deliverability-checker"
     * expects an array of emails under the key "emails".
     * Sending just "email" as a string causes the actor to use its default test data.
     */
    const apiCallData = {
      emails: [normalizedEmail],
      timeoutMs: settings.timeout_ms,
    };

    const response = await fetch(
      `https://api.apify.com/v2/acts/${safeActorId}/runs`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiCallData),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Apify API error: ${response.status} ${response.statusText}`,
      );
    }

    const run = await response.json();
    const runId = run.data.id;

    // Wait for the run to complete and fetch the dataset results
    const result = await waitForRunCompletion(
      runId,
      settings.timeout_ms,
      normalizedEmail,
    );

    return mapApifyResultToStatus(result);
  } catch (error: any) {
    console.error("Error calling Apify API:", error);
    throw error;
  }
}

/**
 * Wait for Apify run to complete and find the specific email in the dataset
 */
async function waitForRunCompletion(
  runId: string,
  timeoutMs: number,
  targetEmail: string,
): Promise<any> {
  const settings = await getApifySettings();
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const response = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}`,
      {
        headers: { Authorization: `Bearer ${settings.api_key}` },
      },
    );

    if (!response.ok)
      throw new Error(`Failed to check run status: ${response.status}`);

    const runData = await response.json();
    const status = runData.data.status;

    if (status === "SUCCEEDED") {
      // Fetch results from the dataset
      const resultResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}/dataset/items`,
        {
          headers: { Authorization: `Bearer ${settings.api_key}` },
        },
      );

      if (!resultResponse.ok)
        throw new Error("Failed to fetch dataset results");

      const results = await resultResponse.json();

      // IMPROVEMENT: Locate the specific email result within the array returned by the actor
      const matchingResult = Array.isArray(results)
        ? results.find(
            (item: any) =>
              item.email &&
              item.email.toLowerCase() === targetEmail.toLowerCase(),
          )
        : null;

      if (matchingResult) return matchingResult;

      // Fallback if results exist but target mismatch
      if (Array.isArray(results) && results.length > 0) return results[0];

      throw new Error(
        `No valid results found in dataset for email: ${targetEmail}`,
      );
    } else if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      throw new Error(`Apify run ended with status: ${status}`);
    }

    // Polling delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Apify run timed out after ${timeoutMs}ms`);
}

/**
 * Map Apify result to our internal status logic
 */
function mapApifyResultToStatus(result: any): EmailVerificationResult {
  const apifyStatus = result.status?.toLowerCase() || "unknown";
  const isDeliverable = result.is_deliverable;

  // Extract reason or default based on deliverability
  const reason =
    result.reason ||
    result.message ||
    (isDeliverable ? "Deliverable" : "Undeliverable");

  let status: "valid" | "invalid" | "risky" | "unknown";

  // Logical mapping based on common email verifier outputs
  if (apifyStatus === "deliverable" || isDeliverable === true) {
    status = "valid";
  } else if (apifyStatus === "undeliverable" || isDeliverable === false) {
    status = "invalid";
  } else if (apifyStatus === "risky") {
    status = "risky";
  } else {
    status = "unknown";
  }

  return {
    status,
    reason,
    details: result,
  };
}

/**
 * Test API key validity
 */
export async function testApifyApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.apify.com/v2/users/me", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return response.ok;
  } catch (error) {
    console.error("Error testing API key:", error);
    return false;
  }
}

/**
 * Batch processing of multiple emails
 */
export async function verifyEmailsBatch(
  emails: string[],
): Promise<Map<string, EmailVerificationResult>> {
  const results = new Map<string, EmailVerificationResult>();

  for (const email of emails) {
    try {
      const result = await verifyEmailWithApify(email);
      results.set(normalizeEmail(email), result);
    } catch (error: any) {
      results.set(normalizeEmail(email), {
        status: "unknown",
        reason: error.message || "Verification failed",
      });
    }
  }

  return results;
}
