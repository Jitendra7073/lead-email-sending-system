import "dotenv/config";

const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const CRON_SECRET = process.env.CRON_SECRET || process.env.NEXT_PUBLIC_CRON_SECRET;
const INTERVAL_MS = parseInt(process.env.QUEUE_WORKER_INTERVAL_MS || "60000", 10);

if (!CRON_SECRET) {
  console.error("CRON_SECRET is required to run the queue worker.");
  process.exit(1);
}

let running = false;

async function runOnce() {
  if (running) return;
  running = true;

  try {
    const response = await fetch(`${APP_URL}/api/workers/process-queue?secret=${encodeURIComponent(CRON_SECRET)}`);
    const body = await response.json().catch(() => ({}));

    if (!response.ok || body.success === false) {
      console.error("[queue-worker] Processor failed:", body.error || response.statusText);
      return;
    }

    const sent = body.sent || 0;
    const failed = body.failed || 0;
    const processed = body.processed || 0;
    const reset = body.reset_daily_limits ? " daily limits reset;" : "";
    console.log(
      `[queue-worker]${reset} processed=${processed} sent=${sent} failed=${failed} at ${new Date().toISOString()}`
    );
  } catch (error) {
    console.error("[queue-worker] Request failed:", error instanceof Error ? error.message : String(error));
  } finally {
    running = false;
  }
}

console.log(`[queue-worker] Polling ${APP_URL}/api/workers/process-queue every ${INTERVAL_MS}ms`);
runOnce();
setInterval(runOnce, INTERVAL_MS);
