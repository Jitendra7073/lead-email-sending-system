/**
 * Auto Poller — Background Queue Processor
 *
 * Used by manual mode to self-schedule processing every 5 minutes.
 * The UI calls GET /api/workers/auto-poller?action=start once.
 * After that it runs independently: processes due emails, then
 * schedules itself to run again after POLL_INTERVAL_MS.
 *
 * State is kept in module-level variables (per server instance).
 * On Vercel/serverless this won't persist across cold starts — but
 * the UI re-starts it on page load if it detects it's not running.
 */

import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { sendEmailWithNodemailer } from '@/lib/email/sender';
import { markAsSent, markAsFailed } from '@/lib/queue/queue-status-manager';
import { activateDependentEmails } from '@/lib/queue/dependency-activator';
import { getCountryName } from '@/lib/email-variables';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 20;

const pollerState = {
    running: false,
    lastRun: null as Date | null,
    lastRunSent: 0,
    lastRunFailed: 0,
    nextRunAt: null as Date | null,
    totalSent: 0,
    totalFailed: 0,
};

let pollerTimer: ReturnType<typeof setTimeout> | null = null;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    switch (action) {
        case 'start':
            if (!pollerState.running) {
                startPoller();
            }
            return NextResponse.json({ success: true, message: 'Poller started', state: pollerState });

        case 'stop':
            stopPoller();
            return NextResponse.json({ success: true, message: 'Poller stopped', state: pollerState });

        case 'status':
            return NextResponse.json({ success: true, state: pollerState });

        case 'run-now':
            // Immediate one-shot run (resets the timer)
            if (pollerTimer) clearTimeout(pollerTimer);
            runAndReschedule();
            return NextResponse.json({ success: true, message: 'Processing now', state: pollerState });

        default:
            return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
}

function startPoller() {
    pollerState.running = true;
    pollerState.nextRunAt = new Date(Date.now() + POLL_INTERVAL_MS);
    // Run immediately on start, then every 5 minutes
    runAndReschedule();
}

function stopPoller() {
    pollerState.running = false;
    pollerState.nextRunAt = null;
    if (pollerTimer) {
        clearTimeout(pollerTimer);
        pollerTimer = null;
    }
}

function runAndReschedule() {
    processQueue()
        .catch((err) => console.error('[AutoPoller] Error:', err))
        .finally(() => {
            if (pollerState.running) {
                pollerState.nextRunAt = new Date(Date.now() + POLL_INTERVAL_MS);
                pollerTimer = setTimeout(runAndReschedule, POLL_INTERVAL_MS);
            }
        });
}

async function processQueue() {
    pollerState.lastRun = new Date();
    pollerState.lastRunSent = 0;
    pollerState.lastRunFailed = 0;

    console.log('[AutoPoller] Running at', pollerState.lastRun.toISOString());

    // Fetch emails that are due now
    const items = await executeQuery(`
    SELECT q.*,
           s.app_password, s.email as sender_email, s.smtp_host, s.smtp_port,
           s.smtp_user, s.name as sender_name, s.service as sender_service,
           s.alias_email as sender_alias_email,
           st.url as website_url,
           c.country_code,
           st.country as site_country
    FROM email_queue q
    LEFT JOIN email_senders s ON q.sender_id = s.id
    LEFT JOIN contacts c ON q.contact_id = c.id
    LEFT JOIN sites st ON c.site_id = st.id
    WHERE q.status IN ('queued', 'pending', 'scheduled', 'ready_to_send')
    AND COALESCE(q.adjusted_scheduled_at, q.scheduled_at) <= NOW()
    ORDER BY COALESCE(q.adjusted_scheduled_at, q.scheduled_at) ASC
    LIMIT $1
  `, [BATCH_SIZE]);

    if (!items || items.length === 0) {
        console.log('[AutoPoller] No emails due, sleeping');
        return;
    }

    console.log(`[AutoPoller] Processing ${items.length} emails`);

    for (const item of items) {
        try {
            // Atomic lock — skip if already being processed
            const locked = await executeQuery(`
        UPDATE email_queue SET status = 'sending', updated_at = NOW()
        WHERE id = $1 AND status IN ('queued', 'pending', 'scheduled', 'ready_to_send')
        RETURNING id
      `, [item.id]);

            if (!locked || locked.length === 0) continue; // already picked up

            // Assign sender if needed
            let sender = item;
            if (!item.sender_id || !item.app_password) {
                const available = await executeQuery(`
          SELECT * FROM email_senders
          WHERE is_active = true AND sent_today < daily_limit
          ORDER BY sent_today ASC LIMIT 1
        `);
                if (!available || available.length === 0) {
                    await executeQuery(`UPDATE email_queue SET status = 'pending', updated_at = NOW() WHERE id = $1`, [item.id]);
                    console.warn('[AutoPoller] No senders available');
                    continue;
                }
                sender = { ...item, ...available[0] };
                await executeQuery(`UPDATE email_queue SET sender_id = $1 WHERE id = $2`, [available[0].id, item.id]);
            }

            const fromAlias = item.sender_alias_email
                ? { aliasEmail: item.sender_alias_email, aliasName: sender.name }
                : undefined;

            const countryName = (item.country_code || item.site_country)
                ? await getCountryName(item.country_code || item.site_country)
                : '';

            const info = await sendEmailWithNodemailer(
                sender.id || sender.sender_id || item.sender_id,
                item.recipient_email,
                item.subject,
                item.html_content || '',
                item.id,
                {
                    recipientName: item.recipient_name,
                    recipientEmail: item.recipient_email,
                    websiteUrl: item.website_url,
                    senderName: fromAlias?.aliasName || sender.name,
                    region: countryName,
                },
                fromAlias,
            );

            await markAsSent(item.id, info.messageId, {
                provider: sender.service || 'nodemailer',
                sent_from: sender.email || sender.sender_email,
            });

            await executeQuery(`UPDATE email_senders SET sent_today = sent_today + 1 WHERE id = $1`,
                [sender.id || sender.sender_id || item.sender_id]);

            // Activate next email in sequence
            await activateDependentEmails(item.id, new Date());

            pollerState.lastRunSent++;
            pollerState.totalSent++;
            console.log(`[AutoPoller] ✅ Sent to ${item.recipient_email}`);

        } catch (err: any) {
            pollerState.lastRunFailed++;
            pollerState.totalFailed++;
            console.error(`[AutoPoller] ❌ Failed ${item.id}:`, err.message);
            await markAsFailed(item.id, err.message, 3);
        }
    }

    // Update last_queue_process timestamp so the UI countdown stays accurate
    await executeQuery(`
    INSERT INTO email_settings (key, value, label, description, updated_at)
    VALUES ('last_queue_process', NOW(), 'Last Queue Process', 'Timestamp of last auto-queue processing', NOW())
    ON CONFLICT (key) DO UPDATE SET value = NOW(), updated_at = NOW()
  `);

    console.log(`[AutoPoller] Done — sent: ${pollerState.lastRunSent}, failed: ${pollerState.lastRunFailed}`);
}
