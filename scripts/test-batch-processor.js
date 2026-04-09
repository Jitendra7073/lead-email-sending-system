#!/usr/bin/env node
/**
 * Test script for batch processor API
 * Run: node scripts/test-batch-processor.js
 */

const BASE_URL = "http://localhost:3000";

async function testAPI(action) {
  try {
    const url = `${BASE_URL}/api/queue/batch-processor?action=${action}`;
    console.log(`\n🔄 Testing: ${url}`);

    const response = await fetch(url);
    const data = await response.json();

    console.log(`Status: ${response.status}`);
    console.log("Response:", JSON.stringify(data, null, 2));

    return data;
  } catch (error) {
    console.error(" Error:", error.message);
    return null;
  }
}

async function runTests() {
  console.log("🧪 Batch Processor API Tests\n");
  console.log("=".repeat(60));

  // Test 1: Check status
  console.log("\n📊 Test 1: Check processor status");
  const status = await testAPI("status");

  if (status && status.success) {
    console.log("\n✅ Status check successful");
    console.log(`   Running: ${status.state.running}`);
    console.log(`   Paused: ${status.state.paused}`);
    console.log(`   Total Sent: ${status.state.totalSent}`);
  }

  // Test 2: Check today's queue
  console.log("\n📧 Test 2: Check today's queue");
  try {
    const today = new Date().toISOString().split("T")[0];
    const queueUrl = `${BASE_URL}/api/queue?limit=10&status=queued`;
    console.log(`\n🔄 Testing: ${queueUrl}`);

    const queueResponse = await fetch(queueUrl);
    const queueData = await queueResponse.json();

    if (queueData.success) {
      console.log(`\n✅ Queue check successful`);
      console.log(`   Total queue items: ${queueData.data?.length || 0}`);
      console.log(`   Filter: status=queued`);

      if (queueData.data && queueData.data.length > 0) {
        console.log("\n📋 Sample queue items:");
        queueData.data.slice(0, 3).forEach((item, idx) => {
          console.log(`   [${idx + 1}] ${item.recipient_email}`);
          console.log(`       Subject: ${item.subject}`);
          console.log(`       Status: ${item.status}`);
          console.log(`       Scheduled: ${item.scheduled_at}`);
        });
      }
    }
  } catch (error) {
    console.error(" Queue check failed:", error.message);
  }

  // Test 3: Check senders
  console.log("\n📤 Test 3: Check active senders");
  try {
    const sendersUrl = `${BASE_URL}/api/senders`;
    console.log(`\n🔄 Testing: ${sendersUrl}`);

    const sendersResponse = await fetch(sendersUrl);
    const sendersData = await sendersResponse.json();

    if (sendersData.success) {
      const activeSenders = sendersData.data?.filter((s) => s.is_active) || [];
      console.log(`\n✅ Senders check successful`);
      console.log(`   Total senders: ${sendersData.data?.length || 0}`);
      console.log(`   Active senders: ${activeSenders.length}`);

      if (activeSenders.length > 0) {
        console.log("\n📋 Active senders:");
        activeSenders.forEach((sender, idx) => {
          const capacity = sender.daily_limit - sender.sent_today;
          console.log(`   [${idx + 1}] ${sender.email}`);
          console.log(`       Name: ${sender.name}`);
          console.log(`       Capacity: ${capacity}/${sender.daily_limit}`);
        });
      }
    }
  } catch (error) {
    console.error(" Senders check failed:", error.message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n✅ All tests completed!");
  console.log("\n💡 Next steps:");
  console.log(
    "   1. If queue has emails and senders are active: Go to http://localhost:3000/history",
  );
  console.log('   2. Click "Start Queue for Today" to begin processing');
  console.log("   3. Monitor progress in real-time");
}

// Run tests
runTests().then(() => process.exit(0));
