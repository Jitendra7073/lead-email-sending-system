import { NextResponse } from 'next/server';

import {
    getBullMqStatus,
    pauseProcessing,
    resumeProcessing,
    runProcessingNow,
    startProcessingScheduler,
    stopProcessingScheduler,
} from '@/lib/jobs/bullmq/manager';

type ControlAction =
    | 'status'
    | 'start'
    | 'stop'
    | 'pause'
    | 'resume'
    | 'run-now'
    | 'set-interval';

interface ControlRequestBody {
    action?: ControlAction;
    intervalMs?: number;
    pauseQueue?: boolean;
    source?: string;
}

/**
 * Read BullMQ queue/scheduler status.
 */
export async function GET() {
    try {
        const result = await getBullMqStatus();
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown BullMQ status error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

/**
 * Control BullMQ scheduler and queue lifecycle.
 */
export async function POST(request: Request) {
    let body: ControlRequestBody = {};

    try {
        body = await request.json();
    } catch {
        body = {};
    }

    const action = body.action || 'status';

    try {
        switch (action) {
            case 'status': {
                return NextResponse.json(await getBullMqStatus());
            }

            case 'start': {
                return NextResponse.json(
                    await startProcessingScheduler({
                        intervalMs: body.intervalMs,
                        resumeQueue: true,
                    }),
                );
            }

            case 'set-interval': {
                if (!body.intervalMs || body.intervalMs <= 0) {
                    return NextResponse.json(
                        { success: false, error: 'intervalMs must be a positive number' },
                        { status: 400 },
                    );
                }

                return NextResponse.json(
                    await startProcessingScheduler({
                        intervalMs: body.intervalMs,
                        resumeQueue: true,
                    }),
                );
            }

            case 'stop': {
                return NextResponse.json(
                    await stopProcessingScheduler({
                        pauseQueue: Boolean(body.pauseQueue),
                    }),
                );
            }

            case 'pause': {
                return NextResponse.json(await pauseProcessing());
            }

            case 'resume': {
                return NextResponse.json(await resumeProcessing());
            }

            case 'run-now': {
                return NextResponse.json(await runProcessingNow(body.source || 'api-control'));
            }

            default: {
                return NextResponse.json({ success: false, error: `Unsupported action: ${action}` }, { status: 400 });
            }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown BullMQ control error';
        return NextResponse.json({ success: false, action, error: message }, { status: 500 });
    }
}
