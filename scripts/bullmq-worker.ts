import 'dotenv/config';

import { createServer, type Server } from 'http';
import { closeBullRedisConnection } from '@/lib/jobs/bullmq/connection';
import { getBullMqRuntimeConfig, BULLMQ_QUEUE_NAME } from '@/lib/jobs/bullmq/config';
import { closeProcessingQueueResources, getProcessingQueue, upsertProcessingTimer } from '@/lib/jobs/bullmq/queue';
import { closeProcessingWorker, getProcessingWorker } from '@/lib/jobs/bullmq/worker';

const config = getBullMqRuntimeConfig();
const AUTO_SCHEDULE_ON_START = (process.env.BULLMQ_AUTO_SCHEDULE_ON_START || 'true').toLowerCase() === 'true';
let healthServer: Server | null = null;

function startHealthServer() {
    const port = Number.parseInt(process.env.PORT || '', 10);

    if (!Number.isFinite(port) || port <= 0) {
        return;
    }

    healthServer = createServer((req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                service: 'bullmq-worker',
                queue: BULLMQ_QUEUE_NAME,
                timestamp: new Date().toISOString(),
            }));
            return;
        }

        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('bullmq-worker running');
    });

    healthServer.listen(port, () => {
        console.log(`[bullmq-worker] health server listening on port=${port}`);
    });
}

function closeHealthServer() {
    return new Promise<void>((resolve, reject) => {
        if (!healthServer) {
            resolve();
            return;
        }

        healthServer.close((error) => {
            healthServer = null;
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

/**
 * Start BullMQ resources and keep the worker alive.
 */
async function main() {
    startHealthServer();

    getProcessingQueue();
    getProcessingWorker({ concurrency: config.workerConcurrency });

    if (AUTO_SCHEDULE_ON_START) {
        await upsertProcessingTimer(config.processIntervalMs);
    }

    console.log(
        `[bullmq-worker] started queue=${BULLMQ_QUEUE_NAME} intervalMs=${config.processIntervalMs} concurrency=${config.workerConcurrency} autoSchedule=${AUTO_SCHEDULE_ON_START}`,
    );

    const shutdown = async () => {
        console.log('[bullmq-worker] shutting down...');
        await closeHealthServer();
        await closeProcessingWorker();
        await closeProcessingQueueResources();
        await closeBullRedisConnection();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((error) => {
    console.error('[bullmq-worker] fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
});
