import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { supabaseAdmin } from '@/lib/supabase/client';

/**
 * GET /api/aliases
 * Get all aliases, optionally filtered by sender_id
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const senderId = searchParams.get('sender_id');

    let query = `
      SELECT
        a.*,
        s.email as sender_email,
        s.name as sender_name
      FROM email_aliases a
      LEFT JOIN email_senders s ON a.sender_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (senderId) {
      query += ` AND a.sender_id = $1`;
      params.push(senderId);
    }

    query += ` ORDER BY a.created_at DESC`;

    const data = await executeQuery(query, params);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/aliases
 * Add a new alias to a sender account
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sender_id, alias_email, alias_name } = body;

    // Validation
    if (!sender_id || !alias_email) {
      return NextResponse.json({
        success: false,
        error: 'sender_id and alias_email are required'
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(alias_email)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email format'
      }, { status: 400 });
    }

    // Check if sender exists
    const { data: senders, error: senderError } = await supabaseAdmin
      .from('email_senders')
      .select('*')
      .eq('id', sender_id)
      .limit(1);

    if (senderError || !senders || senders.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Sender not found'
      }, { status: 404 });
    }

    const sender = senders[0];

    // Check if alias already exists for this sender
    const existingCheck = await executeQuery(
      'SELECT id FROM email_aliases WHERE sender_id = $1 AND alias_email = $2',
      [sender_id, alias_email]
    );

    if (existingCheck.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'This alias already exists for this sender'
      }, { status: 409 });
    }

    // For Gmail aliases, we can auto-verify if it's the same domain
    let isVerified = false;
    let verificationMethod = 'manual';

    if (sender.service === 'gmail') {
      const senderDomain = sender.email.split('@')[1];
      const aliasDomain = alias_email.split('@')[1];

      // Same domain = auto-verify (Gmail allows this with proper setup)
      if (senderDomain === aliasDomain) {
        isVerified = true;
        verificationMethod = 'auto_same_domain';
      }
    }

    // Insert the alias
    const query = `
      INSERT INTO email_aliases (sender_id, alias_email, alias_name, is_verified, verification_method)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await executeQuery(query, [
      sender_id,
      alias_email,
      alias_name || null,
      isVerified,
      verificationMethod
    ]);

    return NextResponse.json({
      success: true,
      data: result[0],
      message: isVerified
        ? 'Alias added and auto-verified'
        : 'Alias added successfully. Please verify it before sending emails.'
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error adding alias:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/aliases
 * Update alias (verify/unverify)
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, is_verified, alias_name } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Alias ID is required'
      }, { status: 400 });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (typeof is_verified === 'boolean') {
      updates.push(`is_verified = $${paramIndex++}`);
      params.push(is_verified);
    }

    if (alias_name !== undefined) {
      updates.push(`alias_name = $${paramIndex++}`);
      params.push(alias_name);
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No updates provided'
      }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const query = `
      UPDATE email_aliases
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await executeQuery(query, params);

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Alias not found'
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result[0] });

  } catch (error: any) {
    console.error('Error updating alias:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
