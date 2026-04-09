#!/usr/bin/env node
/**
 * Diagnostic script to check batch processor setup
 * Run: node scripts/diagnose-batch-processor.js
 */

require("dotenv").config({ path: ".env" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(" Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log("🔍 Batch Processor Diagnostic\n");
  console.log("=".repeat(60));

  try {
    // 1. Check today's emails
    const today = new Date().toISOString().split("T")[0];
    console.log(`\n📅 Today's date: ${today}`);

    const { data: todayEmails, error: todayError } = await supabase
      .from("email_queue")
      .select("*")
      .eq("scheduled_at", today);

    if (todayError) throw todayError;

    console.log(`📧 Emails scheduled for today: ${todayEmails?.length || 0}`);

    // 2. Check eligible emails
    const { data: eligibleEmails, error: eligibleError } = await supabase
      .from("email_queue")
      .select("*")
      .in("status", ["queued", "pending", "scheduled", "ready_to_send"])
      .gte("scheduled_at", today)
      .lte("scheduled_at", today + "T23:59:59")
      .order("scheduled_at", { ascending: true })
      .limit(20);

    if (eligibleError) throw eligibleError;

    console.log(
      `✅ Eligible emails to process: ${eligibleEmails?.length || 0}`,
    );

    if (eligibleEmails && eligibleEmails.length > 0) {
      console.log("\n📋 Next 5 eligible emails:");
      eligibleEmails.slice(0, 5).forEach((email, idx) => {
        console.log(`\n   [${idx + 1}] ${email.recipient_email}`);
        console.log(`       Subject: ${email.subject}`);
        console.log(`       Status: ${email.status}`);
        console.log(`       Scheduled: ${email.scheduled_at}`);
        console.log(`       Sender ID: ${email.sender_id || "Not assigned"}`);
        console.log(`       Queue ID: ${email.id}`);
      });
    }

    // 3. Check senders
    const { data: senders, error: sendersError } = await supabase
      .from("email_senders")
      .select("*")
      .eq("is_active", true);

    if (sendersError) throw sendersError;

    console.log(`\n📤 Active senders: ${senders?.length || 0}`);

    if (senders && senders.length > 0) {
      console.log("\n📋 Sender details:");
      senders.forEach((sender, idx) => {
        const capacity = sender.daily_limit - sender.sent_today;
        console.log(`\n   [${idx + 1}] ${sender.email}`);
        console.log(`       Name: ${sender.name}`);
        console.log(`       Daily Limit: ${sender.daily_limit}`);
        console.log(`       Sent Today: ${sender.sent_today}`);
        console.log(`       Remaining Capacity: ${capacity}`);
        console.log(`       SMTP: ${sender.smtp_host}:${sender.smtp_port}`);
        console.log(
          `       Has App Password: ${sender.app_password ? "✅" : ""}`,
        );
      });

      const totalCapacity = senders.reduce(
        (sum, s) => sum + (s.daily_limit - s.sent_today),
        0,
      );
      console.log(`\n   📊 Total remaining capacity: ${totalCapacity} emails`);
    } else {
      console.log(
        "   ⚠️ No active senders found! Add senders in the Senders page.",
      );
    }

    // 4. Check recent sends
    const { data: recentSends, error: sendsError } = await supabase
      .from("email_send_log")
      .select("*")
      .gte("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("sent_at", { ascending: false })
      .limit(10);

    if (sendsError) throw sendsError;

    console.log(
      `\n📊 Emails sent in last 24 hours: ${recentSends?.length || 0}`,
    );

    if (recentSends && recentSends.length > 0) {
      console.log("\n📋 Recent sends:");
      recentSends.forEach((log, idx) => {
        const time = new Date(log.sent_at).toLocaleTimeString();
        console.log(
          `   [${idx + 1}] ${time} - ${log.contact_email} (${log.status})`,
        );
      });
    }

    // 5. Check failed emails
    const { data: failedEmails, error: failedError } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(5);

    if (failedError) throw failedError;

    console.log(`\n Failed emails: ${failedEmails?.length || 0}`);

    if (failedEmails && failedEmails.length > 0) {
      console.log("\n📋 Recent failures:");
      failedEmails.forEach((email, idx) => {
        console.log(`\n   [${idx + 1}] ${email.recipient_email}`);
        console.log(`       Subject: ${email.subject}`);
        console.log(`       Error: ${email.error_message}`);
        console.log(`       Attempts: ${email.attempts}`);
        console.log(`       Failed At: ${email.updated_at}`);
      });
    }

    // 6. Summary
    console.log("\n" + "=".repeat(60));
    console.log("\n📊 SUMMARY:\n");

    const hasEligibleEmails = (eligibleEmails?.length || 0) > 0;
    const hasActiveSenders = (senders?.length || 0) > 0;
    const hasCapacity =
      senders && senders.some((s) => s.daily_limit - s.sent_today > 0);

    console.log(`   ✅ Eligible emails: ${hasEligibleEmails ? "YES" : "NO"}`);
    console.log(`   ✅ Active senders: ${hasActiveSenders ? "YES" : "NO"}`);
    console.log(`   ✅ Sender capacity: ${hasCapacity ? "YES" : "NO"}`);

    if (hasEligibleEmails && hasActiveSenders && hasCapacity) {
      console.log("\n   🎉 Ready to start batch processor!");
      console.log(
        '   Go to http://localhost:3000/history and click "Start Queue for Today"',
      );
    } else if (!hasEligibleEmails) {
      console.log("\n   ⚠️ No eligible emails to process.");
      console.log("   Add emails to the queue or check scheduled dates.");
    } else if (!hasActiveSenders) {
      console.log("\n   ⚠️ No active senders found.");
      console.log("   Add senders in the Senders page and set them as active.");
    } else if (!hasCapacity) {
      console.log("\n   ⚠️ All senders have reached daily limits.");
      console.log("   Wait for daily reset or increase sender limits.");
    }

    console.log("\n" + "=".repeat(60));
  } catch (error) {
    console.error("\n Error during diagnostic:", error.message);
    console.error(error.stack);
  }
}

diagnose().then(() => process.exit(0));
