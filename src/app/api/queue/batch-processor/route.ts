import { NextResponse } from "next/server";
import { executeQuery } from "@/lib/db/postgres";
import { sendEmailWithNodemailer } from "@/lib/email/sender";
import { getCountryName } from "@/lib/email-variables";

// In-memory queue processor state (in production, use Redis or database)
const processorState = {
  running: false,
  paused: false,
  stopped: false,
  currentBatch: 0,
  emailsSentInBatch: 0,
  totalProcessed: 0,
  totalSent: 0,
  totalFailed: 0,
  startTime: null as Date | null,
  lastActivity: null as Date | null,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    switch (action) {
      case "status":
        return NextResponse.json({
          success: true,
          state: processorState,
        });

      case "start":
        if (processorState.running) {
          return NextResponse.json({
            success: false,
            error: "Processor is already running",
          });
        }
        // Start processing in background
        startBatchProcessor();
        return NextResponse.json({
          success: true,
          message: "Batch processor started",
        });

      case "stop":
        processorState.stopped = true;
        processorState.running = false;
        return NextResponse.json({
          success: true,
          message: "Processor stopped",
        });

      case "pause":
        processorState.paused = true;
        return NextResponse.json({
          success: true,
          message: "Processor paused",
        });

      case "resume":
        processorState.paused = false;
        return NextResponse.json({
          success: true,
          message: "Processor resumed",
        });

      case "cancel-all":
        // Cancel all queued emails
        const cancelResult = await executeQuery(
          `UPDATE email_queue
           SET status = 'cancelled',
               error_message = 'Cancelled by user',
               updated_at = NOW()
           WHERE status IN ('queued', 'pending', 'scheduled', 'ready_to_send')
           AND DATE(scheduled_at) >= CURRENT_DATE`,
        );
        return NextResponse.json({
          success: true,
          message: `Cancelled queued emails`,
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action",
          },
          { status: 400 },
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}

// POST method for starting processor (more explicit than GET)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action;

    if (action === "start") {
      if (processorState.running) {
        return NextResponse.json({
          success: false,
          error: "Processor is already running",
        });
      }
      // Start processing in background
      startBatchProcessor();
      return NextResponse.json({
        success: true,
        message: "Batch processor started",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Invalid action",
      },
      { status: 400 },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}

async function startBatchProcessor() {
  if (processorState.running) return;

  processorState.running = true;
  processorState.paused = false;
  processorState.stopped = false;
  processorState.currentBatch = 0;
  processorState.emailsSentInBatch = 0;
  processorState.totalProcessed = 0;
  processorState.totalSent = 0;
  processorState.totalFailed = 0;
  processorState.startTime = new Date();

  console.log("🚀 Batch processor started at", processorState.startTime);

  try {
    await processQueue();
  } catch (error: any) {
    console.error(" Batch processor error:", error);
  } finally {
    processorState.running = false;
    processorState.lastActivity = new Date();
    console.log("🏁 Batch processor stopped at", processorState.lastActivity);
  }
}

async function processQueue() {
  const BATCH_SIZE = 5;
  const EMAIL_DELAY_MS = 60 * 1000; // 1 minute between emails
  const BATCH_BREAK_MS = 5 * 60 * 1000; // 5 minutes after batch of 5

  while (!processorState.stopped) {
    // Check if paused
    while (processorState.paused && !processorState.stopped) {
      console.log("⏸️ Processor paused, waiting...");
      await sleep(5000); // Check every 5 seconds
    }

    if (processorState.stopped) break;

    // Fetch emails scheduled for TODAY
    const today = new Date().toISOString().split("T")[0];

    const queueItems = await executeQuery(
      `
      SELECT q.*,
             s.app_password, s.email as sender_email, s.smtp_host, s.smtp_port, s.smtp_user, s.name as sender_name,
             s.service as sender_service,
             s.alias_email as sender_alias_email,
             st.url as website_url,
             c.country_code,
             st.country as site_country
      FROM email_queue q
      LEFT JOIN email_senders s ON q.sender_id = s.id
      LEFT JOIN contacts c ON q.contact_id = c.id
      LEFT JOIN sites st ON c.site_id = st.id
      WHERE q.status IN ('queued', 'pending', 'scheduled', 'ready_to_send')
      AND DATE(q.scheduled_at) = $1
      AND (q.adjusted_scheduled_at IS NULL OR q.adjusted_scheduled_at <= NOW())
      ORDER BY q.scheduled_at ASC
      LIMIT $2
      `,
      [today, BATCH_SIZE],
    );

    if (!queueItems || queueItems.length === 0) {
      console.log("✅ No more emails to process for today");
      break;
    }

    console.log(
      `📧 Processing batch ${processorState.currentBatch + 1} with ${queueItems.length} emails`,
    );

    // Process each email in the batch
    for (let i = 0; i < queueItems.length; i++) {
      if (processorState.stopped) {
        console.log("🛑 Processor stopped during batch");
        return;
      }

      while (processorState.paused) {
        console.log("⏸️ Waiting for resume...");
        await sleep(5000);
      }

      const item = queueItems[i];
      processorState.totalProcessed++;

      console.log(
        `\n📨 [${processorState.totalProcessed}] Sending to: ${item.recipient_email}`,
      );
      console.log(`   Subject: ${item.subject}`);
      console.log(`   Queue ID: ${item.id}`);

      try {
        // Mark as sending
        await executeQuery(
          `UPDATE email_queue SET status = 'sending', updated_at = NOW() WHERE id = $1`,
          [item.id],
        );

        // Assign sender if not already assigned
        let senderCredentials = item;
        if (!item.sender_id || !item.app_password) {
          const avSender = await executeQuery(
            `SELECT * FROM email_senders
             WHERE is_active = true
             AND sent_today < daily_limit
             LIMIT 1`,
          );

          if (avSender.length === 0) {
            throw new Error("No active senders available with capacity");
          }

          senderCredentials = { ...item, ...avSender[0] };
          await executeQuery(
            `UPDATE email_queue SET sender_id = $1 WHERE id = $2`,
            [senderCredentials.id, item.id],
          );
        }

        // Send email
        // Use alias_email if available, otherwise use main email
        const fromAlias = item.sender_alias_email ? {
          aliasEmail: item.sender_alias_email,
          aliasName: senderCredentials.name
        } : undefined;

        console.log(
          `📤 Sending via ${senderCredentials.sender_email || senderCredentials.email}${fromAlias ? ` as ${fromAlias.aliasEmail}` : ''}...`,
        );

        // Fetch country name if country_code or site_country is available
        const countryCodeInput = item.country_code || item.site_country;
        const countryName = countryCodeInput ? await getCountryName(countryCodeInput) : "";

        const info = await sendEmailWithNodemailer(
          senderCredentials.id || senderCredentials.sender_id || item.sender_id,
          item.recipient_email,
          item.subject,
          item.html_content || "",
          item.id,
          {
            recipientName: item.recipient_name,
            recipientEmail: item.recipient_email,
            websiteUrl: item.website_url,
            senderName: fromAlias?.aliasName || senderCredentials.name,
            region: countryName
          },
          fromAlias
        );

        // 6. Mark as sent (Centralized update)
        const { markAsSent } = await import("@/lib/queue/queue-status-manager");
        await markAsSent(item.id, info.messageId, {
          provider: senderCredentials.service || "nodemailer",
          sent_from: senderCredentials.email || senderCredentials.sender_email,
        });

        // Increment sender count
        await executeQuery(
          `UPDATE email_senders SET sent_today = sent_today + 1 WHERE id = $1`,
          [
            senderCredentials.id ||
              senderCredentials.sender_id ||
              item.sender_id,
          ],
        );

        processorState.totalSent++;
        processorState.emailsSentInBatch++;

        console.log(`   ✅ Sent successfully! Message ID: ${info.messageId}`);
        console.log(
          `   📊 Batch progress: ${processorState.emailsSentInBatch}/${BATCH_SIZE}`,
        );

        // Delay between emails (1 minute), but not after the last email in batch
        if (i < queueItems.length - 1 && !processorState.stopped) {
          console.log(`   ⏳ Waiting 1 minute before next email...`);
          await sleep(EMAIL_DELAY_MS);
        }
      } catch (error: any) {
        processorState.totalFailed++;

        console.error(`    Failed to send: ${error.message}`);

        await executeQuery(
          `
          UPDATE email_queue
          SET status = 'failed',
              attempts = attempts + 1,
              error_message = $1,
              updated_at = NOW()
          WHERE id = $2
          `,
          [error.message, item.id],
        );
      }

      processorState.lastActivity = new Date();
    }

    // Check if we need to take a break after the batch
    if (queueItems.length === BATCH_SIZE && !processorState.stopped) {
      processorState.currentBatch++;
      processorState.emailsSentInBatch = 0;

      console.log(`\n☕ Batch ${processorState.currentBatch} complete!`);
      console.log(`   📊 Total sent so far: ${processorState.totalSent}`);
      console.log(`   ⏳ Taking 5-minute break before next batch...`);

      // Check for pause during break
      const breakStartTime = Date.now();
      while (Date.now() - breakStartTime < BATCH_BREAK_MS) {
        if (processorState.stopped) {
          console.log("🛑 Processor stopped during break");
          return;
        }

        while (processorState.paused) {
          console.log("⏸️ Paused during break");
          await sleep(5000);
        }

        await sleep(10000); // Check every 10 seconds
      }

      console.log("   ✅ Break complete, starting next batch...");
    }
  }

  console.log("\n✅ All emails processed for today!");
  console.log(`📊 Final stats:`);
  console.log(`   Total processed: ${processorState.totalProcessed}`);
  console.log(`   Sent: ${processorState.totalSent}`);
  console.log(`   Failed: ${processorState.totalFailed}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
