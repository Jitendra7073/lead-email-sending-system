import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { sendEmailWithNodemailer } from '@/lib/email/sender';
import { revalidateSchedule } from '@/lib/queue/schedule-validator';
import { activateDependentEmails } from '@/lib/queue/dependency-activator';
import {
  markAsSending,
  markAsSent,
  markAsFailed,
  cancelDependentEmails,
  rescheduleEmail
} from '@/lib/queue/queue-status-manager';
import { workerLogger } from '@/lib/workers/worker-logger';

export async function GET(request: Request) {
  // Check CRON_SECRET authorization
  // Accept secret via either Authorization header OR query parameter
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({
      success: false,
      error: 'CRON_SECRET not configured'
    }, { status: 500 });
  }

  // Check Authorization header OR query parameter
  const isValidAuth = authHeader === `Bearer ${cronSecret}` || secretParam === cronSecret;

  if (!isValidAuth) {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 });
  }

  // Check queue mode setting
  const modeSetting = await executeQuery(`
    SELECT value FROM email_settings WHERE key = 'queue_mode'
  `);

  if (modeSetting.length === 0 || modeSetting[0].value !== 'auto') {
    workerLogger.log('info', 'worker', 'Queue mode is not set to auto, skipping processing');
    workerLogger.endRun();
    return NextResponse.json({
      success: true,
      message: 'Queue mode is manual, auto-processing skipped'
    });
  }

  // Check queue interval setting and last process time
  const settingsResult = await executeQuery(`
    SELECT
      (SELECT value FROM email_settings WHERE key = 'queue_interval')::int as interval_minutes,
      (SELECT value FROM email_settings WHERE key = 'last_queue_process') as last_process
  `);

  if (settingsResult.length > 0) {
    const intervalMinutes = settingsResult[0].interval_minutes || 15;
    const lastProcess = settingsResult[0].last_process;

    if (lastProcess) {
      const lastProcessTime = new Date(lastProcess);
      const now = new Date();
      const minutesSinceLastProcess = (now.getTime() - lastProcessTime.getTime()) / (1000 * 60);

      // Only process if enough time has passed (with 1 minute buffer for cron timing)
      if (minutesSinceLastProcess < (intervalMinutes - 1)) {
        workerLogger.log('info', 'worker',
          `Skipping - only ${minutesSinceLastProcess.toFixed(1)} minutes since last run (required: ${intervalMinutes}m)`
        );
        workerLogger.endRun();
        return NextResponse.json({
          success: true,
          message: `Skipping - too soon since last process (${minutesSinceLastProcess.toFixed(1)}m ago, required: ${intervalMinutes}m)`,
          minutes_since_last: minutesSinceLastProcess,
          required_interval: intervalMinutes
        });
      }
    }
  }

  // Start worker run
  workerLogger.startRun();

  try {
    // 1. Fetch dependency-aware actionable queue items with website URL
    const fetchQuery = `
      SELECT q.*,
             s.app_password, s.email as sender_email, s.smtp_host, s.smtp_port, s.smtp_user, s.name as sender_name,
             st.url as website_url
      FROM email_queue q
      LEFT JOIN email_senders s ON q.sender_id = s.id
      LEFT JOIN contacts c ON q.contact_id = c.id
      LEFT JOIN sites st ON c.site_id = st.id
      WHERE q.status = 'ready_to_send'
      AND q.adjusted_scheduled_at <= NOW()
      AND q.dependency_satisfied = TRUE
      ORDER BY q.adjusted_scheduled_at ASC
      LIMIT 20
    `;

    // NOTE: In a true robust production env, we would use SELECT ... FOR UPDATE SKIP LOCKED
    // to prevent overlapping cron job executions. We keep it simple here.
    const queueItems = await executeQuery(fetchQuery);

    if (!queueItems || queueItems.length === 0) {
      workerLogger.log('info', 'worker', 'No actionable emails in queue');
      workerLogger.endRun();
      return NextResponse.json({ success: true, message: 'No actionable emails in queue.' });
    }

    workerLogger.log('info', 'worker', `Processing ${queueItems.length} emails from queue`);

    const results = [];
    const startTime = Date.now();

    // 2. Process each item
    for (const item of queueItems) {
      const itemStartTime = Date.now();

      try {
        workerLogger.logProcessing(item.id, 'Starting processing');

        // Mark as sending to prevent duplicate pickups
        const markedAsSending = await markAsSending(item.id);
        if (!markedAsSending) {
          workerLogger.log('warning', 'worker', `Email ${item.id} could not be marked as sending (likely already being processed)`);
          continue;
        }

        // 3. Revalidate schedule before sending
        workerLogger.log('info', 'worker', `Revalidating schedule for ${item.id}`);
        const validationResult = await revalidateSchedule({
          queue_id: item.id,
          recipient_timezone: item.recipient_timezone || 'UTC',
          current_scheduled_at: item.adjusted_scheduled_at || item.scheduled_at,
          country_code: item.country_code
        });

        if (!validationResult.valid) {
          // Schedule needs adjustment
          const newTime = new Date(validationResult.new_scheduled_at!);
          await rescheduleEmail(item.id, newTime, validationResult.reason!);

          workerLogger.logReschedule(
            item.id,
            validationResult.reason!,
            validationResult.new_scheduled_at!,
            validationResult.adjustment_details
          );

          results.push({
            id: item.id,
            status: 'rescheduled',
            reason: validationResult.reason,
            new_scheduled_at: validationResult.new_scheduled_at
          });
          continue;
        }

        workerLogger.logValidation(item.id, true, validationResult);

        // 4. Assign sender if needed
        let senderCredentials = item;
        if (!item.sender_id) {
          // Find active sender with available daily limits
          const avSender = await executeQuery(
            `SELECT * FROM email_senders
             WHERE is_active = true
             AND sent_today < daily_limit
             LIMIT 1`
          );

          if (avSender.length === 0) {
            throw new Error('No active senders available with capacity.');
          }

          senderCredentials = avSender[0];
          await executeQuery(
            `UPDATE email_queue SET sender_id = $1 WHERE id = $2`,
            [senderCredentials.id, item.id]
          );
        }

        // 5. Trigger nodemailer
        workerLogger.log('info', 'worker', `Sending email ${item.id} via ${senderCredentials.email}`);

        let messageId = 'mock_id_if_no_smtp';
        let sendSuccess = false;
        let sendError = null;

        try {
          const info = await sendEmailWithNodemailer(
            senderCredentials.id,
            item.recipient_email,
            item.subject,
            item.html_content,
            item.id,
            {
              recipientName: item.recipient_name,
              recipientEmail: item.recipient_email,
              websiteUrl: item.website_url,
              senderName: senderCredentials.name
            }
          );
          messageId = info.messageId;
          sendSuccess = true;
        } catch (e: any) {
          // Fallback if nodemailer sender module not updated yet
          console.warn('Nodemailer configuration warning. Make sure sender uses dynamic credential passing. Faking send for test.');
          sendError = e.message || 'Unknown send error';
        }

        if (!sendSuccess) {
          throw new Error(sendError || 'Send failed');
        }

        // 6. Mark success
        const sentAt = new Date();
        await markAsSent(item.id, messageId, {
          provider: senderCredentials.service || 'nodemailer',
          sent_from: senderCredentials.email
        });

        workerLogger.logSendAttempt(item.id, true, {
          message_id: messageId,
          sender: senderCredentials.email,
          sent_at: sentAt.toISOString()
        });

        // Increment sender today count

        // Increment sender today count
        await executeQuery(
          `UPDATE email_senders SET sent_today = sent_today + 1 WHERE id = $1`,
          [senderCredentials.id || item.sender_id]
        );

        // 7. Activate dependent emails
        workerLogger.log('info', 'worker', `Activating dependents for ${item.id}`);
        const activationResult = await activateDependentEmails(item.id, sentAt);

        if (activationResult.activated_count > 0) {
          workerLogger.logActivation(
            item.id,
            activationResult.activated_count,
            {
              activations: activationResult.activations,
              failed: activationResult.failed_count
            }
          );
        }

        // Log performance
        const processingTime = Date.now() - itemStartTime;
        workerLogger.logPerformance(item.id, processingTime);

        results.push({
          id: item.id,
          status: 'sent',
          message_id: messageId,
          dependents_activated: activationResult.activated_count
        });

      } catch (sendError: any) {
        const processingTime = Date.now() - itemStartTime;
        console.error(`Error sending email ${item.id}:`, sendError);

        workerLogger.logError(item.id, sendError.message, {
          processing_time_ms: processingTime,
          stack: sendError.stack
        });

        // Handle failure with retry logic
        const failureResult = await markAsFailed(item.id, sendError.message, 3);

        workerLogger.logSendAttempt(item.id, false, {
          error: sendError.message,
          attempts: failureResult.attempts,
          is_fatal: failureResult.is_fatal
        });

        // If fatal failure, cancel downstream sequence emails
        if (failureResult.is_fatal) {
          workerLogger.log('warning', 'worker', `Fatal failure for ${item.id}, cancelling dependents`);

          const cancelledCount = await cancelDependentEmails(
            item.id,
            `Parent email failed after ${failureResult.attempts} attempts: ${sendError.message}`
          );

          workerLogger.log('info', 'worker', `Cancelled ${cancelledCount} dependent emails`);
        }

        results.push({
          id: item.id,
          status: failureResult.new_status,
          error: sendError.message,
          attempts: failureResult.attempts,
          is_fatal: failureResult.is_fatal
        });
      }
    }

    const totalProcessingTime = Date.now() - startTime;
    workerLogger.log('info', 'worker', `Batch processing completed in ${totalProcessingTime}ms`);

    // Update last process time for countdown timer
    await executeQuery(`
      INSERT INTO email_settings (key, value, label, description, updated_at)
      VALUES ('last_queue_process', NOW(), 'Last Queue Process', 'Timestamp of last auto-queue processing', NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = NOW(),
        updated_at = NOW()
    `);

    workerLogger.endRun();

    const metrics = workerLogger.getCurrentMetrics();

    return NextResponse.json({
      success: true,
      processed: results.length,
      processing_time_ms: totalProcessingTime,
      metrics,
      results
    });

  } catch (err: any) {
    workerLogger.logError('system', err.message, {
      stack: err.stack
    });

    workerLogger.endRun();

    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
}
