import { NextResponse } from 'next/server';
import { executeQuery, dbPool } from '@/lib/db/postgres';
import { detectTimezone } from '@/lib/schedule/timezone-detector';
import { buildDependencyChain } from '@/lib/email/dependency-manager';
import crypto from 'crypto';

export async function GET() {
  try {
    const query = `
      SELECT c.*, 
             g.name as group_name,
             (SELECT COUNT(*) FROM email_queue WHERE campaign_id = c.id) as total_queued,
             (SELECT COUNT(*) FROM email_queue WHERE campaign_id = c.id AND status = 'sent') as total_sent,
             (SELECT COUNT(*) FROM email_queue WHERE campaign_id = c.id AND status = 'failed') as total_failed
      FROM email_campaigns c
      LEFT JOIN template_groups g ON c.group_id = g.id
      ORDER BY c.created_at DESC
    `;
    const data = await executeQuery(query);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const client = await dbPool.connect();
  
  try {
    const body = await request.json();
    const { name, group_id, target_type } = body;

    if (!name || !group_id) {
      return NextResponse.json({ success: false, error: 'Name and group_id are required' }, { status: 400 });
    }

    await client.query('BEGIN');

    // CRITICAL: Check for active senders before creating campaign and queuing emails
    const activeSendersResult = await client.query(
      `SELECT COUNT(*) as count FROM email_senders WHERE is_active = true`
    );

    const activeSenderCount = parseInt(activeSendersResult.rows[0].count);

    if (activeSenderCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: false,
        error: 'NO_ACTIVE_SENDERS',
        message: 'No active email senders found. Please add or activate at least one email sender before creating campaigns.',
        requires_sender_setup: true
      }, { status: 400 });
    }

    // 1. Create a campaign record
    const campaignQuery = `
      INSERT INTO email_campaigns (name, group_id, target_type, status)
      VALUES ($1, $2, $3, 'queued')
      RETURNING *
    `;
    const campaignResult = await client.query(campaignQuery, [name, group_id, target_type || 'all']);
    const campaign = campaignResult.rows[0];

    // 2. Fetch the group logic & gaps
    const groupResult = await client.query('SELECT * FROM template_groups WHERE id = $1', [group_id]);
    const group = groupResult.rows[0];

    // 3. Fetch mapped templates strictly ordered by position
    const mappingQuery = `
      SELECT m.position, t.* 
      FROM template_group_mapping m
      JOIN email_templates t ON m.template_id = t.id
      WHERE m.group_id = $1 
      AND t.is_active = true
      ORDER BY m.position ASC
    `;
    const templatesResult = await client.query(mappingQuery, [group_id]);
    const templates = templatesResult.rows;

    if (templates.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Selected Template Group has no active templates mapped to it.' }, { status: 400 });
    }

    // 4. Resolve Target Contacts based on target_type
    // Right now we implement 'wordpress' as default test case
    let contactQuery = '';
    if (target_type === 'wordpress') {
      contactQuery = `
        SELECT c.id, c.value as email, s.url
        FROM contacts c
        JOIN sites s ON c.site_id = s.id
        WHERE c.type = 'email' AND s.is_wordpress = true
      `;
    } else {
       contactQuery = `SELECT id, value as email, source_page as url FROM contacts WHERE type = 'email'`;
    }
    
    // limit for safety if huge dataset
    contactQuery += ` LIMIT 5000`; 
    
    const contactsResult = await client.query(contactQuery);
    let contacts = contactsResult.rows;

    if (contacts.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'No contacts matched the given target_type' }, { status: 400 });
    }

    // 5. Enrich contacts with timezone data
    console.log(`[Campaign] Enriching ${contacts.length} contacts with timezone data...`);

    for (const contact of contacts) {
      // Skip if timezone already exists
      if (contact.timezone) continue;

      // Detect timezone from email domain
      const detection = await detectTimezone(contact.email);

      if (detection) {
        // Update contact with timezone data
        await client.query(
          `UPDATE contacts SET timezone = $1, country_code = $2, updated_at = NOW() WHERE id = $3`,
          [detection.timezone, detection.country_code, contact.id]
        );

        // Update local contact object
        contact.timezone = detection.timezone;
        contact.country_code = detection.country_code;
      }
    }

    // 6. Apply variable replacements to templates
    const templatesWithVars = templates.map(template => ({
      ...template,
      subject: template.subject,
      html_content: template.html_content
    }));

    // 7. Generate and Insert Queue Matrix with Dependency Chains
    console.log(`[Campaign] Building dependency chains for ${contacts.length} contacts...`);

    const chainResult = await buildDependencyChain(
      campaign,
      contacts,
      templatesWithVars,
      group
    );

    if (!chainResult.success) {
      console.warn(`[Campaign] Some queue items failed: ${chainResult.errors.join(', ')}`);
    }

    const totalQueueInjections = chainResult.total_emails_queued;

    // Update campaign total recipients
    await client.query('UPDATE email_campaigns SET total_recipients = $1 WHERE id = $2', [contacts.length, campaign.id]);

    await client.query('COMMIT');
    return NextResponse.json({ 
      success: true, 
      campaign, 
      stats: {
        contactsProcessed: contacts.length,
        totalEmailsQueued: totalQueueInjections
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
