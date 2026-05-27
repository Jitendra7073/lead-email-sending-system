import { Worker } from 'bullmq';

import { BULLMQ_PROCESS_JOB_NAME, BULLMQ_QUEUE_NAME, getBullMqRuntimeConfig } from './config';
import { processDueQueue } from '@/lib/queue/queue-processor';

export interface WorkerRuntimeOptions {
    concurrency?: number;
}

let processingWorker: Worker | null = null;

function getBullMqConnectionOptions() {
    const { redisUrl } = getBullMqRuntimeConfig();

    return {
        url: redisUrl,
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
    };
}

/**
 * Process one BullMQ job by running the shared queue processor directly.
 */
async function processDueQueueJob(): Promise<Record<string, unknown>> {
    const result = await processDueQueue({ batchSize: 20 });

    return {
        success: true,
        ...result,
    };
}

/**
 * Create or return a singleton worker for the processing queue.
 */
export function getProcessingWorker(options: WorkerRuntimeOptions = {}): Worker {
    if (processingWorker) {
        return processingWorker;
    }

    const config = getBullMqRuntimeConfig();
    const concurrency = options.concurrency || config.workerConcurrency;

    processingWorker = new Worker(
        BULLMQ_QUEUE_NAME,
        async (job) => {
            if (job.name !== BULLMQ_PROCESS_JOB_NAME) {
                return { skipped: true, reason: `Unknown job name: ${job.name}` };
            }

            return processDueQueueJob();
        },
        {
            connection: getBullMqConnectionOptions(),
            concurrency,
        },
    );

    processingWorker.on('completed', (job) => {
        console.log(`[bullmq-worker] completed job=${job.id} name=${job.name}`);
    });

    processingWorker.on('failed', (job, err) => {
        console.error(
            `[bullmq-worker] failed job=${job?.id || 'unknown'} name=${job?.name || 'unknown'} error=${err.message}`,
        );
    });

    processingWorker.on('error', (err) => {
        console.error('[bullmq-worker] worker error:', err.message);
    });

    return processingWorker;
}

/**
 * Gracefully close the singleton processing worker.
 */
export async function closeProcessingWorker(): Promise<void> {
    if (!processingWorker) {
        return;
    }

    await processingWorker.close();
    processingWorker = null;
}

/**
 * Quick worker-local state check.
 */
export function isProcessingWorkerRunning(): boolean {
    return processingWorker !== null;
}
