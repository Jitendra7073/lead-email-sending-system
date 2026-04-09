/**
 * Email Verification Service
 * Handles business logic for email verification including database operations
 */

import { executeQuery } from "@/lib/db/postgres";
import {
  verifyEmailWithApify,
  normalizeEmail,
  getApifySettings,
} from "../apify";

export interface VerificationRecord {
  id: string;
  email: string;
  status: "valid" | "invalid" | "risky" | "unknown";
  reason: string;
  details: any;
  checked_at: Date;
  recheck_after: Date;
}

export interface ContactVerificationResult {
  contact_id: number;
  email: string;
  status: "valid" | "invalid" | "risky" | "unknown";
  reason: string;
  checked_at: Date;
  is_new: boolean;
}

/**
 * Check if email already exists in verification table
 */
export async function getExistingVerification(
  email: string,
): Promise<VerificationRecord | null> {
  const normalized = normalizeEmail(email);

  try {
    const result = await executeQuery(
      `SELECT * FROM email_verifications WHERE email = $1`,
      [normalized],
    );

    if (result && result.length > 0) {
      return {
        id: result[0].id,
        email: result[0].email,
        status: result[0].status,
        reason: result[0].reason,
        details: result[0].details,
        checked_at: new Date(result[0].checked_at),
        recheck_after: new Date(result[0].recheck_after),
      };
    }

    return null;
  } catch (error) {
    console.error("Error checking existing verification:", error);
    return null;
  }
}

/**
 * Check if verification needs re-verification
 */
export async function needsReverification(email: string): Promise<boolean> {
  const existing = await getExistingVerification(email);

  if (!existing) {
    return true; // Never verified
  }

  // If the last status was unknown, we should allow a retry regardless of time
  if (existing.status === "unknown") {
    return true;
  }

  const settings = await getApifySettings();
  const recheckDate = new Date(existing.checked_at);
  recheckDate.setDate(recheckDate.getDate() + settings.recheck_days);

  return recheckDate <= new Date();
}

/**
 * Store or update email verification result
 */
export async function storeVerification(
  email: string,
  status: "valid" | "invalid" | "risky" | "unknown",
  reason: string,
  details: any = {},
): Promise<string> {
  const normalized = normalizeEmail(email);
  const settings = await getApifySettings();
  const recheckDays = settings.recheck_days || 30;

  try {
    // Check if verification exists
    const existing = await getExistingVerification(normalized);

    if (existing) {
      // Update existing verification - Fixed interval syntax for Postgres
      await executeQuery(
        `UPDATE email_verifications
         SET status = $1, 
             reason = $2, 
             details = $3, 
             checked_at = NOW(), 
             recheck_after = NOW() + ($4 || ' days')::interval
         WHERE id = $5`,
        [status, reason, JSON.stringify(details), recheckDays, existing.id],
      );

      return existing.id;
    } else {
      // Insert new verification - Fixed interval syntax for Postgres
      const result = await executeQuery(
        `INSERT INTO email_verifications (email, status, reason, details, recheck_after)
         VALUES ($1, $2, $3, $4, NOW() + ($5 || ' days')::interval)
         RETURNING id`,
        [normalized, status, reason, JSON.stringify(details), recheckDays],
      );

      return result[0].id;
    }
  } catch (error) {
    console.error("Error storing verification:", error);
    throw error;
  }
}

/**
 * Create mapping between contact and verification
 */
export async function linkContactToVerification(
  contactId: number,
  verificationId: string,
): Promise<void> {
  try {
    await executeQuery(
      `INSERT INTO contact_email_verifications (contact_id, email_verification_id)
       VALUES ($1, $2)
       ON CONFLICT (contact_id, email_verification_id) DO NOTHING`,
      [contactId, verificationId],
    );
  } catch (error) {
    console.error("Error linking contact to verification:", error);
    throw error;
  }
}

/**
 * Get verification status for a contact
 */
export async function getContactVerificationStatus(
  contactId: number,
): Promise<VerificationRecord | null> {
  try {
    const result = await executeQuery(
      `SELECT ev.*
       FROM email_verifications ev
       INNER JOIN contact_email_verifications cev ON ev.id = cev.email_verification_id
       WHERE cev.contact_id = $1
       ORDER BY ev.checked_at DESC
       LIMIT 1`,
      [contactId],
    );

    if (result && result.length > 0) {
      return {
        id: result[0].id,
        email: result[0].email,
        status: result[0].status,
        reason: result[0].reason,
        details: result[0].details,
        checked_at: new Date(result[0].checked_at),
        recheck_after: new Date(result[0].recheck_after),
      };
    }

    return null;
  } catch (error) {
    console.error("Error getting contact verification status:", error);
    return null;
  }
}

/**
 * Verify a single email (checks existing cache, then calls Apify if needed)
 */
export async function verifyEmail(
  email: string,
  force: boolean = false,
): Promise<{ verificationId: string; isNew: boolean }> {
  const normalized = normalizeEmail(email);

  // Check if we need to verify (or force re-verification)
  if (!force) {
    const existing = await getExistingVerification(normalized);
    if (existing) {
      // If it's unknown, we always allow a retry
      if (existing.status !== "unknown") {
        const now = new Date();
        if (existing.recheck_after > now) {
          // Existing verification is still fresh
          return { verificationId: existing.id, isNew: false };
        }
      }
    }
  }

  // Call Apify API
  const result = await verifyEmailWithApify(normalized);

  // Store result in database
  const verificationId = await storeVerification(
    normalized,
    result.status,
    result.reason,
    result.details,
  );

  return { verificationId, isNew: true };
}

/**
 * Verify contacts in bulk (Handles deduplication and linking)
 */
export async function verifyContactsBulk(
  contactIds: number[],
  force: boolean = false,
): Promise<ContactVerificationResult[]> {
  console.log(`[DEBUG] Verifying contacts with IDs:`, contactIds);

  // Fetch contacts from database
  const contacts = await executeQuery(
    `SELECT id, value FROM contacts WHERE id = ANY($1) AND type = 'email'`,
    [contactIds],
  );

  if (!contacts || contacts.length === 0) {
    console.log(`[DEBUG] No email contacts found for the given IDs`);
    return [];
  }

  // Group by normalized email to prevent redundant API calls for same email
  const emailToContactIds = new Map<string, number[]>();
  for (const contact of contacts) {
    const normalized = normalizeEmail(contact.value);
    if (!emailToContactIds.has(normalized)) {
      emailToContactIds.set(normalized, []);
    }
    emailToContactIds.get(normalized)!.push(contact.id);
  }

  const results: ContactVerificationResult[] = [];

  // Iterate through unique emails
  for (const [email, ids] of emailToContactIds.entries()) {
    try {
      // 1. Perform verification (checks cache or calls Apify)
      const { verificationId, isNew } = await verifyEmail(email, force);

      // 2. Fetch the fresh/cached record to return consistent data
      const verification = await getExistingVerification(email);
      if (!verification) continue;

      // 3. Link every contact sharing this email to the single verification record
      for (const contactId of ids) {
        await linkContactToVerification(contactId, verificationId);

        results.push({
          contact_id: contactId,
          email,
          status: verification.status,
          reason: verification.reason,
          checked_at: verification.checked_at,
          is_new: isNew,
        });
      }
    } catch (error: any) {
      console.error(`Error verifying email ${email}:`, error);

      // Map failure to results for all associated contact IDs
      for (const contactId of ids) {
        results.push({
          contact_id: contactId,
          email,
          status: "unknown",
          reason: error.message || "Verification failed",
          checked_at: new Date(),
          is_new: false,
        });
      }
    }
  }

  return results;
}

/**
 * Get verification statistics
 */
export async function getVerificationStats(): Promise<{
  total: number;
  valid: number;
  invalid: number;
  risky: number;
  unverified: number;
}> {
  try {
    const result = await executeQuery(`
      SELECT
        COUNT(DISTINCT c.id) as total_emails,
        COUNT(DISTINCT CASE WHEN ev.status = 'valid' THEN c.id END) as valid,
        COUNT(DISTINCT CASE WHEN ev.status = 'invalid' THEN c.id END) as invalid,
        COUNT(DISTINCT CASE WHEN ev.status = 'risky' THEN c.id END) as risky,
        COUNT(DISTINCT CASE WHEN ev.id IS NULL THEN c.id END) as unverified
      FROM contacts c
      LEFT JOIN contact_email_verifications cev ON c.id = cev.contact_id
      LEFT JOIN email_verifications ev ON cev.email_verification_id = ev.id
      WHERE c.type = 'email'
    `);

    return {
      total: parseInt(result[0].total_emails) || 0,
      valid: parseInt(result[0].valid) || 0,
      invalid: parseInt(result[0].invalid) || 0,
      risky: parseInt(result[0].risky) || 0,
      unverified: parseInt(result[0].unverified) || 0,
    };
  } catch (error) {
    console.error("Error getting verification stats:", error);
    return {
      total: 0,
      valid: 0,
      invalid: 0,
      risky: 0,
      unverified: 0,
    };
  }
}
