import { NextResponse } from "next/server";
import { processDueQueue, resetSenderDailyLimitsIfNeeded } from "@/lib/queue/queue-processor";

const processorState = {
  running: false,
  lastActivity: null as Date | null,
  totalProcessed: 0,
  totalSent: 0,
  totalFailed: 0,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    switch (action) {
      case "status":
        return NextResponse.json({ success: true, state: processorState });

      case "reset-daily-limits": {
        const reset = await resetSenderDailyLimitsIfNeeded();
        return NextResponse.json({
          success: true,
          reset,
          message: reset
            ? "Sender daily limits reset"
            : "Sender daily limits already reset today",
        });
      }

      case "start":
      case "run-once":
      case null: {
        if (processorState.running) {
          return NextResponse.json({
            success: false,
            error: "Processor is already running",
          }, { status: 409 });
        }

        processorState.running = true;
        const result = await processDueQueue({ batchSize: 20 });
        processorState.running = false;
        processorState.lastActivity = new Date();
        processorState.totalProcessed += result.processed;
        processorState.totalSent += result.sent;
        processorState.totalFailed += result.failed;

        return NextResponse.json({
          success: true,
          message: "Queue processor run completed",
          state: processorState,
          result,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 },
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown queue processing error";
    processorState.running = false;
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST() {
  return GET(new Request("http://localhost/api/queue/batch-processor?action=run-once"));
}
