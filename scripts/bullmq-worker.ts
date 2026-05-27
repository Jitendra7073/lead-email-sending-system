import 'dotenv/config';

import { closeBullRedisConnection } from '@/lib/jobs/bullmq/connection';
import { getBullMqRuntimeConfig, BULLMQ_QUEUE_NAME } from '@/lib/jobs/bullmq/config';
import { closeProcessingQueueResources, getProcessingQueue, upsertProcessingTimer } from '@/lib/jobs/bullmq/queue';
import { closeProcessingWorker, getProcessingWorker } from '@/lib/jobs/bullmq/worker';

const config = getBullMqRuntimeConfig();
const AUTO_SCHEDULE_ON_START = (process.env.BULLMQ_AUTO_SCHEDULE_ON_START || 'true').toLowerCase() === 'true';

/**
 * Start BullMQ resources and keep the worker alive.
 */
async function main() {
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
