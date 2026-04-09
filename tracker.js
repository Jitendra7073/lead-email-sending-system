const { google } = require("googleapis");
const Bottleneck = require("bottleneck");

// --- 1. YOUR CREDENTIALS ---
const CLIENT_ID = "";
const CLIENT_SECRET = "";
const REFRESH_TOKEN = "";

// --- 2. AUTHENTICATION SETUP ---
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const gmail = google.gmail({ version: "v1", auth: oauth2Client });

// --- 3. THE TRAFFIC COP (Prevents 429 Rate Limit Crashes) ---
// This forces the script to wait 250 milliseconds between every API call.
// Maximum speed: 4 requests per second (extremely safe).
const limiter = new Bottleneck({
  minTime: 250,
});

// --- 4. THE CORE POLLING FUNCTION ---
async function checkInboxForReplies() {
  console.log("🔍 Waking up to check for new backlink replies...");

  try {
    // Step A: Search for unread emails in the inbox
    const response = await limiter.schedule(() =>
      gmail.users.messages.list({
        userId: "me",
        q: "is:unread label:inbox",
      }),
    );

    const messages = response.data.messages;

    if (!messages || messages.length === 0) {
      console.log("😴 No new replies. Going back to sleep.");
      return; // Stop here if the inbox is empty
    }

    console.log(`📥 Found ${messages.length} unread emails. Processing now...`);

    // Step B: Loop through each email safely
    for (const msg of messages) {
      // Fetch ONLY the metadata (The "Postcard" - prevents memory crashes!)
      const messageData = await limiter.schedule(() =>
        gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["In-Reply-To", "From", "Subject"],
        }),
      );

      const headers = messageData.data.payload.headers;

      const inReplyToHeader = headers.find((h) => h.name === "In-Reply-To");
      const fromHeader = headers.find((h) => h.name === "From");
      const subjectHeader = headers.find((h) => h.name === "Subject");

      // Step C: Check if it's a reply to your cold email
      if (inReplyToHeader) {
        const originalMessageId = inReplyToHeader.value;
        console.log(`\n✅ BOOM! NEW REPLY DETECTED!`);
        console.log(`From: ${fromHeader ? fromHeader.value : "Unknown"}`);
        console.log(
          `Subject: ${subjectHeader ? subjectHeader.value : "No Subject"}`,
        );
        console.log(`Original Message-ID: ${originalMessageId}`);

        // ---------------------------------------------------------
        // 🚨 YOUR DATABASE CODE GOES HERE 🚨
        // Example: await database.updateProspectStatus(originalMessageId, 'Replied');
        // ---------------------------------------------------------
      } else {
        console.log(
          `⏭️ Skipped non-reply email from ${fromHeader ? fromHeader.value : "Unknown"}.`,
        );
      }

      // Step D: Mark the email as READ so we don't process it again
      await limiter.schedule(() =>
        gmail.users.messages.modify({
          userId: "me",
          id: msg.id,
          requestBody: {
            removeLabelIds: ["UNREAD"],
          },
        }),
      );
      console.log(`🧹 Marked email ${msg.id} as read.`);
    }
  } catch (error) {
    console.error(" Error checking emails:", error.message);
  }
}

// --- 5. THE INFINITE LOOP ---
// Run immediately on startup...
checkInboxForReplies();

// ...and then run every 5 minutes (300,000 milliseconds) forever.
setInterval(checkInboxForReplies, 300000);
