import { NextResponse } from "next/server";
import {
  processDueQueue,
  type QueueProcessorResult,
} from "@/lib/queue/queue-processor";

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_BATCHES = 5;

function isAuthorized(request: Request) {
  const expectedSecret = process.env.WORKER_SECRET;

  if (!expectedSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  return token === expectedSecret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized worker request" },
      { status: 401 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const batchSize = Number.parseInt(
      String(body.batchSize || DEFAULT_BATCH_SIZE),
      10,
    );
    const maxRetries = body.maxRetries
      ? Number.parseInt(String(body.maxRetries), 10)
      : undefined;
    const maxBatches = Number.parseInt(
      String(body.maxBatches || DEFAULT_MAX_BATCHES),
      10,
    );
    const effectiveBatchSize =
      Number.isFinite(batchSize) && batchSize > 0 ? batchSize : DEFAULT_BATCH_SIZE;
    const effectiveMaxBatches =
      Number.isFinite(maxBatches) && maxBatches > 0
        ? Math.min(maxBatches, 10)
        : DEFAULT_MAX_BATCHES;
    const drainDue = body.drainDue === true;

    const results: QueueProcessorResult[] = [];

    for (let batch = 0; batch < (drainDue ? effectiveMaxBatches : 1); batch++) {
      const result = await processDueQueue({
        batchSize: effectiveBatchSize,
        maxRetries:
          maxRetries && Number.isFinite(maxRetries) && maxRetries > 0
            ? maxRetries
            : undefined,
      });

      results.push(result);

      if (result.processed < effectiveBatchSize) {
        break;
      }
    }

    const summary = results.reduce(
      (acc, result) => {
        acc.processed += result.processed;
        acc.sent += result.sent;
        acc.failed += result.failed;
        acc.skipped += result.skipped;
        acc.reset_daily_limits = acc.reset_daily_limits || result.reset_daily_limits;
        acc.results.push(...result.results);
        return acc;
      },
      {
        processed: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        reset_daily_limits: false,
        results: [] as QueueProcessorResult["results"],
      },
    );

    return NextResponse.json({
      success: true,
      source: body.source || "worker",
      batches: results.length,
      batchSize: effectiveBatchSize,
      drainDue,
      ...summary,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown queue processing error";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
