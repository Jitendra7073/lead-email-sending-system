import { Queue, QueueEvents, JobsOptions } from 'bullmq';

import {
    BULLMQ_PROCESS_JOB_NAME,
    BULLMQ_QUEUE_NAME,
    BULLMQ_REPEAT_KEY,
    getBullMqRuntimeConfig,
} from './config';

export interface ProcessingQueueStatus {
    queueName: string;
    paused: boolean;
    counts: Record<string, number>;
    repeatables: Array<{
        key: string;
        name: string;
        every?: string;
        pattern?: string;
        next?: number;
    }>;
}

let processingQueue: Queue | null = null;
let processingQueueEvents: QueueEvents | null = null;

function getBullMqConnectionOptions() {
    const { redisUrl } = getBullMqRuntimeConfig();

    return {
        url: redisUrl,
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
    };
}

/**
 * Return a singleton BullMQ queue instance used for email processing jobs.
 */
export function getProcessingQueue(): Queue {
    if (processingQueue) {
        return processingQueue;
    }

    processingQueue = new Queue(BULLMQ_QUEUE_NAME, {
        connection: getBullMqConnectionOptions(),
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
            removeOnComplete: 200,
            removeOnFail: 500,
        },
    });

    return processingQueue;
}

/**
 * Return a singleton QueueEvents instance for centralized observability.
 */
export function getProcessingQueueEvents(): QueueEvents {
    if (processingQueueEvents) {
        return processingQueueEvents;
    }

    processingQueueEvents = new QueueEvents(BULLMQ_QUEUE_NAME, {
        connection: getBullMqConnectionOptions(),
    });

    return processingQueueEvents;
}

/**
 * Add an immediate one-off processing job.
 */
export async function addRunNowJob(data: Record<string, unknown> = {}, options: JobsOptions = {}) {
    const queue = getProcessingQueue();

    return queue.add(BULLMQ_PROCESS_JOB_NAME, {
        requestedAt: new Date().toISOString(),
        ...data,
    }, {
        ...options,
    });
}

/**
 * Upsert the centralized repeatable processing timer.
 * Uses a custom repeat key to allow updating interval by re-adding same key.
 */
export async function upsertProcessingTimer(intervalMs?: number) {
    const queue = getProcessingQueue();
    const config = getBullMqRuntimeConfig();
    const effectiveInterval = intervalMs && intervalMs > 0 ? intervalMs : config.processIntervalMs;

    return queue.add(
        BULLMQ_PROCESS_JOB_NAME,
        {
            requestedAt: new Date().toISOString(),
            source: 'timer',
        },
        {
            repeat: {
                every: effectiveInterval,
                key: BULLMQ_REPEAT_KEY,
            },
            jobId: BULLMQ_REPEAT_KEY,
        },
    );
}

/**
 * Remove the centralized repeatable processing timer if present.
 */
export async function removeProcessingTimer(): Promise<number> {
    const queue = getProcessingQueue();
    const repeatables = await queue.getRepeatableJobs();
    let removed = 0;

    for (const repeatJob of repeatables) {
        if (repeatJob.key === BULLMQ_REPEAT_KEY) {
            const ok = await queue.removeRepeatableByKey(repeatJob.key);
            if (ok) {
                removed += 1;
            }
        }
    }

    return removed;
}

/**
 * Pause queue globally so workers stop picking up new jobs.
 */
export async function pauseProcessingQueue(): Promise<void> {
    const queue = getProcessingQueue();
    await queue.pause();
}

/**
 * Resume queue globally.
 */
export async function resumeProcessingQueue(): Promise<void> {
    const queue = getProcessingQueue();
    await queue.resume();
}

/**
 * Fetch queue stats and current timer metadata.
 */
export async function getProcessingQueueStatus(): Promise<ProcessingQueueStatus> {
    const queue = getProcessingQueue();
    const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'completed',
        'failed',
        'paused',
    );
    const repeatables = await queue.getRepeatableJobs();

    return {
        queueName: BULLMQ_QUEUE_NAME,
        paused: await queue.isPaused(),
        counts,
        repeatables: repeatables.map((item) => ({
            key: item.key,
            name: item.name,
            every: item.every ?? undefined,
            pattern: item.pattern ?? undefined,
            next: item.next,
        })),
    };
}

/**
 * Gracefully close queue resources.
 */
export async function closeProcessingQueueResources(): Promise<void> {
    if (processingQueueEvents) {
        await processingQueueEvents.close();
        processingQueueEvents = null;
    }

    if (processingQueue) {
        await processingQueue.close();
        processingQueue = null;
    }
}
