export const BULLMQ_QUEUE_NAME = 'email-processing';
export const BULLMQ_PROCESS_JOB_NAME = 'process-due-email-queue';
export const BULLMQ_REPEAT_KEY = 'email-processing-repeat';
const DEFAULT_PROCESS_INTERVAL_MS = 300000;

export interface BullMqRuntimeConfig {
    redisUrl: string;
    appUrl: string;
    workerSecret?: string;
    processIntervalMs: number;
    workerConcurrency: number;
}

/**
 * Read and normalize BullMQ runtime configuration from environment variables.
 */
export function getBullMqRuntimeConfig(): BullMqRuntimeConfig {
    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const processIntervalMs = Number.parseInt(
        process.env.BULLMQ_PROCESS_INTERVAL_MS || String(DEFAULT_PROCESS_INTERVAL_MS),
        10,
    );
    const workerConcurrency = Number.parseInt(process.env.BULLMQ_WORKER_CONCURRENCY || '1', 10);

    return {
        redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
        appUrl,
        workerSecret: process.env.WORKER_SECRET,
        processIntervalMs: Number.isFinite(processIntervalMs) && processIntervalMs > 0
            ? processIntervalMs
            : DEFAULT_PROCESS_INTERVAL_MS,
        workerConcurrency: Number.isFinite(workerConcurrency) && workerConcurrency > 0 ? workerConcurrency : 1,
    };
}
