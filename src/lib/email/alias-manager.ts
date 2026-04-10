/**
 * Alias Manager - Helper functions for managing email aliases
 *
 * This module provides utilities for:
 * - Fetching available aliases for a sender
 * - Validating alias permissions
 * - Getting alias info for sending
 * - Managing alias verification status
 */

import { executeQuery } from '../db/postgres';
import { supabaseAdmin } from '../supabase/client';

export interface Alias {
  id: string;
  sender_id: string;
  alias_email: string;
  alias_name: string | null;
  is_verified: boolean;
  verification_method: string;
  dns_spf_valid: boolean | null;
  dns_dkim_valid: boolean | null;
  last_used_at: string | null;
  created_at: string;
}

export interface SenderWithAliases {
  id: string;
  name: string;
  email: string;
  service: string;
  smtp_host?: string;
  smtp_port?: number;
  aliases: Alias[];
}

/**
 * Get all aliases for a specific sender
 */
export async function getAliasesForSender(senderId: string): Promise<Alias[]> {
  try {
    const result = await executeQuery(
      `SELECT * FROM email_aliases
       WHERE sender_id = $1
       ORDER BY is_verified DESC, created_at DESC`,
      [senderId]
    );
    return result;
  } catch (error) {
    console.error('Error fetching aliases for sender:', error);
    throw error;
  }
}

/**
 * Get all verified aliases for a sender
 */
export async function getVerifiedAliasesForSender(senderId: string): Promise<Alias[]> {
  try {
    const result = await executeQuery(
      `SELECT * FROM email_aliases
       WHERE sender_id = $1 AND is_verified = true
       ORDER BY alias_email`,
      [senderId]
    );
    return result;
  } catch (error) {
    console.error('Error fetching verified aliases:', error);
    throw error;
  }
}

/**
 * Get a specific alias by ID
 */
export async function getAliasById(aliasId: string): Promise<Alias | null> {
  try {
    const result = await executeQuery(
      `SELECT * FROM email_aliases WHERE id = $1`,
      [aliasId]
    );
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error fetching alias:', error);
    throw error;
  }
}

/**
 * Check if an alias is valid for a sender
 */
export async function validateAliasForSender(
  senderId: string,
  aliasEmail: string
): Promise<{ valid: boolean; alias?: Alias; error?: string }> {
  try {
    const result = await executeQuery(
      `SELECT * FROM email_aliases
       WHERE sender_id = $1 AND alias_email = $2 AND is_verified = true
       LIMIT 1`,
      [senderId, aliasEmail]
    );

    if (result.length === 0) {
      return {
        valid: false,
        error: `Alias "${aliasEmail}" is not verified for this sender account.`
      };
    }

    return { valid: true, alias: result[0] };
  } catch (error) {
    console.error('Error validating alias:', error);
    return {
      valid: false,
      error: 'Failed to validate alias. Please try again.'
    };
  }
}

/**
 * Get sender with all aliases (including main email as default alias)
 */
export async function getSenderWithAliases(senderId: string): Promise<SenderWithAliases | null> {
  try {
    // Get sender
    const { data: senders, error } = await supabaseAdmin
      .from('email_senders')
      .select('*')
      .eq('id', senderId)
      .limit(1);

    if (error || !senders || senders.length === 0) {
      return null;
    }

    const sender = senders[0];

    // Get aliases
    const aliases = await getAliasesForSender(senderId);

    return {
      id: sender.id,
      name: sender.name,
      email: sender.email,
      service: sender.service,
      smtp_host: sender.smtp_host,
      smtp_port: sender.smtp_port,
      aliases
    };
  } catch (error) {
    console.error('Error fetching sender with aliases:', error);
    throw error;
  }
}

/**
 * Add a new alias to a sender
 */
export async function addAlias(
  senderId: string,
  aliasEmail: string,
  aliasName?: string
): Promise<Alias> {
  try {
    // Check if sender exists
    const { data: senders, error: senderError } = await supabaseAdmin
      .from('email_senders')
      .select('*')
      .eq('id', senderId)
      .limit(1);

    if (senderError || !senders || senders.length === 0) {
      throw new Error('Sender not found');
    }

    const sender = senders[0];

    // Determine if we can auto-verify
    let isVerified = false;
    let verificationMethod = 'manual';

    if (sender.service === 'gmail') {
      const senderDomain = sender.email.split('@')[1];
      const aliasDomain = aliasEmail.split('@')[1];

      if (senderDomain === aliasDomain) {
        isVerified = true;
        verificationMethod = 'auto_same_domain';
      }
    }

    // Insert alias
    const result = await executeQuery(
      `INSERT INTO email_aliases (sender_id, alias_email, alias_name, is_verified, verification_method)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [senderId, aliasEmail, aliasName || null, isVerified, verificationMethod]
    );

    return result[0];
  } catch (error: any) {
    console.error('Error adding alias:', error);
    throw error;
  }
}

/**
 * Update alias verification status
 */
export async function updateAliasVerification(
  aliasId: string,
  isVerified: boolean
): Promise<Alias | null> {
  try {
    const result = await executeQuery(
      `UPDATE email_aliases
       SET is_verified = $1,
           verification_method = CASE WHEN $1 THEN 'manual' ELSE verification_method END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [isVerified, aliasId]
    );

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error updating alias verification:', error);
    throw error;
  }
}

/**
 * Delete an alias
 */
export async function deleteAlias(aliasId: string): Promise<boolean> {
  try {
    await executeQuery(
      'DELETE FROM email_aliases WHERE id = $1',
      [aliasId]
    );
    return true;
  } catch (error) {
    console.error('Error deleting alias:', error);
    throw error;
  }
}

/**
 * Mark alias as used (update last_used_at timestamp)
 */
export async function markAliasUsed(aliasId: string): Promise<void> {
  try {
    await executeQuery(
      'UPDATE email_aliases SET last_used_at = NOW() WHERE id = $1',
      [aliasId]
    );
  } catch (error) {
    console.error('Error marking alias as used:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Get alias usage statistics
 */
export async function getAliasStats(aliasId: string): Promise<{
  totalSent: number;
  lastUsed: string | null;
  successRate: number;
}> {
  try {
    // Get total emails sent with this alias
    const countResult = await executeQuery(
      `SELECT COUNT(*) as count
       FROM email_queue
       WHERE from_alias_id = $1 AND status = 'sent'`,
      [aliasId]
    );

    // Get last used time from alias record
    const aliasResult = await executeQuery(
      'SELECT last_used_at FROM email_aliases WHERE id = $1',
      [aliasId]
    );

    const totalSent = parseInt(countResult[0]?.count || '0');
    const lastUsed = aliasResult[0]?.last_used_at || null;

    // Calculate success rate (emails sent / emails attempted)
    const totalResult = await executeQuery(
      `SELECT COUNT(*) as count
       FROM email_queue
       WHERE from_alias_id = $1`,
      [aliasId]
    );

    const totalAttempted = parseInt(totalResult[0]?.count || '0');
    const successRate = totalAttempted > 0
      ? (totalSent / totalAttempted) * 100
      : 100;

    return {
      totalSent,
      lastUsed,
      successRate
    };
  } catch (error) {
    console.error('Error getting alias stats:', error);
    return {
      totalSent: 0,
      lastUsed: null,
      successRate: 100
    };
  }
}
