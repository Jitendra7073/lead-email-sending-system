import { NextResponse } from "next/server";
import { processDueQueue } from "@/lib/queue/queue-processor";

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
    const batchSize = Number.parseInt(String(body.batchSize || "20"), 10);
    const maxRetries = body.maxRetries
      ? Number.parseInt(String(body.maxRetries), 10)
      : undefined;

    const result = await processDueQueue({
      batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 20,
      maxRetries:
        maxRetries && Number.isFinite(maxRetries) && maxRetries > 0
          ? maxRetries
          : undefined,
    });

    return NextResponse.json({
      success: true,
      source: body.source || "worker",
      ...result,
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
