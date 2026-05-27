import 'dotenv/config';

import { Queue, QueueEvents, Worker } from 'bullmq';
import IORedis from 'ioredis';

const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const CRON_SECRET = process.env.CRON_SECRET || process.env.NEXT_PUBLIC_CRON_SECRET;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const QUEUE_NAME = process.env.BULLMQ_QUEUE_NAME || 'email-processing';
const JOB_NAME = process.env.BULLMQ_PROCESS_JOB_NAME || 'process-due-email-queue';
const REPEAT_KEY = process.env.BULLMQ_REPEAT_KEY || 'email-processing-repeat';
const INTERVAL_MS = Number.parseInt(process.env.BULLMQ_PROCESS_INTERVAL_MS || '60000', 10);
const CONCURRENCY = Number.parseInt(process.env.BULLMQ_WORKER_CONCURRENCY || '1', 10);
const AUTO_SCHEDULE_ON_START = (process.env.BULLMQ_AUTO_SCHEDULE_ON_START || 'true').toLowerCase() === 'true';

/**
 * Create Redis connection shared by Queue/Worker/QueueEvents.
 */
function createConnection() {
    return new IORedis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
    });
}

/**
 * Call the existing queue processor endpoint.
 */
async function runQueueProcessingRequest() {
    if (!CRON_SECRET) {
        throw new Error('CRON_SECRET is required for BullMQ worker');
    }

    const response = await fetch(`${APP_URL}/api/workers/process-queue`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${CRON_SECRET}`,
        },
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok || body?.success === false) {
        throw new Error(body?.error || response.statusText || 'process-queue request failed');
    }

    return body;
}

/**
 * Ensure centralized repeat timer is present (or updated) using repeat key.
 */
async function upsertTimer(queue) {
    await queue.add(
        JOB_NAME,
        {
            requestedAt: new Date().toISOString(),
            source: 'worker-startup',
        },
        {
            repeat: {
                every: INTERVAL_MS,
                key: REPEAT_KEY,
            },
            jobId: REPEAT_KEY,
            removeOnComplete: 200,
            removeOnFail: 500,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
        },
    );
}

async function main() {
    const connection = createConnection();

    const queue = new Queue(QUEUE_NAME, {
        connection,
    });

    const queueEvents = new QueueEvents(QUEUE_NAME, {
        connection,
    });

    const worker = new Worker(
        QUEUE_NAME,
        async (job) => {
            if (job.name !== JOB_NAME) {
                return { skipped: true, reason: `Unknown job name ${job.name}` };
            }

            const result = await runQueueProcessingRequest();
            const processed = result?.processed || 0;
            const sent = result?.sent || 0;
            const failed = result?.failed || 0;
            console.log(`[bullmq-worker] processed=${processed} sent=${sent} failed=${failed}`);
            return result;
        },
        {
            connection,
            concurrency: CONCURRENCY > 0 ? CONCURRENCY : 1,
        },
    );

    worker.on('completed', (job) => {
        console.log(`[bullmq-worker] completed job=${job.id} name=${job.name}`);
    });

    worker.on('failed', (job, err) => {
        console.error(
            `[bullmq-worker] failed job=${job?.id || 'unknown'} name=${job?.name || 'unknown'} error=${err.message}`,
        );
    });

    worker.on('error', (err) => {
        console.error('[bullmq-worker] worker error:', err.message);
    });

    queueEvents.on('active', ({ jobId, prev }) => {
        console.log(`[bullmq-events] job=${jobId} active prev=${prev}`);
    });

    queueEvents.on('completed', ({ jobId }) => {
        console.log(`[bullmq-events] job=${jobId} completed`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
        console.error(`[bullmq-events] job=${jobId} failed reason=${failedReason}`);
    });

    if (AUTO_SCHEDULE_ON_START) {
        await upsertTimer(queue);
    }

    console.log(
        `[bullmq-worker] started queue=${QUEUE_NAME} intervalMs=${INTERVAL_MS} concurrency=${CONCURRENCY} autoSchedule=${AUTO_SCHEDULE_ON_START}`,
    );

    const shutdown = async () => {
        console.log('[bullmq-worker] shutting down...');
        await worker.close();
        await queueEvents.close();
        await queue.close();
        await connection.quit();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((error) => {
    console.error('[bullmq-worker] fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
});
