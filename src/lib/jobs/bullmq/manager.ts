import { closeBullRedisConnection, isBullRedisOpen } from './connection';
import { getBullMqRuntimeConfig } from './config';
import {
    addRunNowJob,
    closeProcessingQueueResources,
    getProcessingQueueStatus,
    pauseProcessingQueue,
    removeProcessingTimer,
    resumeProcessingQueue,
    upsertProcessingTimer,
} from './queue';

export interface StartSchedulerOptions {
    intervalMs?: number;
    resumeQueue?: boolean;
}

export interface StopSchedulerOptions {
    pauseQueue?: boolean;
}

/**
 * Start or update the centralized BullMQ timer job.
 */
export async function startProcessingScheduler(options: StartSchedulerOptions = {}) {
    const intervalMs = options.intervalMs;

    if (options.resumeQueue !== false) {
        await resumeProcessingQueue();
    }

    const repeatJob = await upsertProcessingTimer(intervalMs);
    const status = await getProcessingQueueStatus();

    return {
        success: true,
        action: 'start',
        repeatJobId: repeatJob.id,
        status,
    };
}

/**
 * Stop recurring timer jobs and optionally pause the queue.
 */
export async function stopProcessingScheduler(options: StopSchedulerOptions = {}) {
    const removedTimers = await removeProcessingTimer();

    if (options.pauseQueue) {
        await pauseProcessingQueue();
    }

    const status = await getProcessingQueueStatus();

    return {
        success: true,
        action: 'stop',
        removedTimers,
        status,
    };
}

/**
 * Trigger one immediate queue processing job.
 */
export async function runProcessingNow(source = 'manual') {
    const job = await addRunNowJob({ source });
    const status = await getProcessingQueueStatus();

    return {
        success: true,
        action: 'run-now',
        jobId: job.id,
        status,
    };
}

/**
 * Pause processing globally.
 */
export async function pauseProcessing() {
    await pauseProcessingQueue();
    const status = await getProcessingQueueStatus();

    return {
        success: true,
        action: 'pause',
        status,
    };
}

/**
 * Resume processing globally.
 */
export async function resumeProcessing() {
    await resumeProcessingQueue();
    const status = await getProcessingQueueStatus();

    return {
        success: true,
        action: 'resume',
        status,
    };
}

/**
 * Read current BullMQ scheduler and queue status.
 */
export async function getBullMqStatus() {
    const status = await getProcessingQueueStatus();
    const config = getBullMqRuntimeConfig();

    return {
        success: true,
        action: 'status',
        redisOpen: isBullRedisOpen(),
        config: {
            queueName: status.queueName,
            appUrl: config.appUrl,
            processIntervalMs: config.processIntervalMs,
            workerConcurrency: config.workerConcurrency,
        },
        status,
    };
}

/**
 * Gracefully close queue + redis resources.
 */
export async function shutdownBullMqResources() {
    await closeProcessingQueueResources();
    await closeBullRedisConnection();
}
