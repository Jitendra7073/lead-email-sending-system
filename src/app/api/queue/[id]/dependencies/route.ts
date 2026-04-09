import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

/**
 * GET /api/queue/[id]/dependencies
 *
 * Show dependency chain for a specific email in the queue
 * Returns:
 * - Previous email in the chain
 * - Next emails in the chain
 * - Chain status and metadata
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const emailId = parseInt(id);

    if (isNaN(emailId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email ID'
      }, { status: 400 });
    }

    // Get the target email details
    const targetEmailQuery = `
      SELECT
        eq.id,
        eq.contact_id,
        eq.template_id,
        eq.scheduled_at,
        eq.status,
        eq.template_order,
        eq.depends_on_email_id,
        c.value as contact_value,
        c.type as contact_type,
        t.name as template_name,
        t.group_id,
        tg.name as group_name,
        s.country,
        s.timezone
      FROM email_queue eq
      LEFT JOIN contacts c ON eq.contact_id = c.id
      LEFT JOIN templates t ON eq.template_id = t.id
      LEFT JOIN template_groups tg ON t.group_id = tg.id
      LEFT JOIN sites s ON c.site_id = s.id
      WHERE eq.id = $1
    `;

    const targetEmailResult = await executeQuery(targetEmailQuery, [emailId]);

    if (targetEmailResult.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Email not found in queue'
      }, { status: 404 });
    }

    const targetEmail = targetEmailResult[0];

    // Get previous email in the chain (the one this email depends on)
    let previousEmail = null;
    if (targetEmail.depends_on_email_id) {
      const previousQuery = `
        SELECT
          eq.id,
          eq.template_id,
          eq.scheduled_at,
          eq.status,
          eq.template_order,
          c.value as contact_value,
          t.name as template_name
        FROM email_queue eq
        LEFT JOIN contacts c ON eq.contact_id = c.id
        LEFT JOIN templates t ON eq.template_id = t.id
        WHERE eq.id = $1
      `;
      const previousResult = await executeQuery(previousQuery, [targetEmail.depends_on_email_id]);

      if (previousResult.length > 0) {
        previousEmail = previousResult[0];
      }
    }

    // Get next emails in the chain (emails that depend on this one)
    const nextEmailsQuery = `
      SELECT
        eq.id,
        eq.template_id,
        eq.scheduled_at,
        eq.status,
        eq.template_order,
        c.value as contact_value,
        t.name as template_name
      FROM email_queue eq
      LEFT JOIN contacts c ON eq.contact_id = c.id
      LEFT JOIN templates t ON eq.template_id = t.id
      WHERE eq.depends_on_email_id = $1
      ORDER BY eq.template_order ASC
    `;

    const nextEmails = await executeQuery(nextEmailsQuery, [emailId]);

    // Get all emails in the same chain for the same contact and template group
    const chainQuery = `
      SELECT
        eq.id,
        eq.template_id,
        eq.scheduled_at,
        eq.status,
        eq.template_order,
        eq.depends_on_email_id,
        t.name as template_name
      FROM email_queue eq
      LEFT JOIN templates t ON eq.template_id = t.id
      WHERE eq.contact_id = $1
        AND t.group_id = $2
      ORDER BY eq.template_order ASC
    `;

    const chainEmails = await executeQuery(chainQuery, [
      targetEmail.contact_id,
      targetEmail.group_id
    ]);

    // Calculate chain position and status
    const chainPosition = chainEmails.findIndex((e: any) => e.id === emailId);
    const totalInChain = chainEmails.length;

    // Determine chain health
    const chainStatus = {
      total_emails: totalInChain,
      current_position: chainPosition + 1,
      completed_before: chainEmails.slice(0, chainPosition).filter((e: any) => e.status === 'sent').length,
      pending_after: chainEmails.slice(chainPosition + 1).filter((e: any) => e.status === 'pending').length,
      is_chain_blocked: chainEmails.slice(0, chainPosition).some((e: any) => e.status === 'failed'),
      can_proceed: previousEmail ? previousEmail.status === 'sent' : true
    };

    // Build chain visualization
    const chainVisualization = chainEmails.map((email: any, index: number) => ({
      id: email.id,
      template_name: email.template_name,
      template_order: email.template_order,
      status: email.status,
      is_current: email.id === emailId,
      position: index + 1
    }));

    return NextResponse.json({
      success: true,
      data: {
        target_email: {
          id: targetEmail.id,
          contact_value: targetEmail.contact_value,
          contact_type: targetEmail.contact_type,
          template_name: targetEmail.template_name,
          group_name: targetEmail.group_name,
          scheduled_at: targetEmail.scheduled_at,
          status: targetEmail.status,
          template_order: targetEmail.template_order,
          country: targetEmail.country,
          timezone: targetEmail.timezone
        },
        dependencies: {
          previous: previousEmail,
          next: nextEmails,
          chain: chainVisualization
        },
        chain_status: chainStatus,
        metadata: {
          has_dependencies: !!targetEmail.depends_on_email_id,
          has_dependents: nextEmails.length > 0,
          is_first_in_chain: !previousEmail,
          is_last_in_chain: nextEmails.length === 0
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching email dependencies:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
