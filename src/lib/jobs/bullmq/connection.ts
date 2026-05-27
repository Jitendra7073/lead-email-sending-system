import IORedis from 'ioredis';

import { getBullMqRuntimeConfig } from './config';

let bullRedisConnection: IORedis | null = null;

/**
 * Get a singleton Redis connection for BullMQ.
 * BullMQ recommends maxRetriesPerRequest = null for worker stability.
 */
export function getBullRedisConnection(): IORedis {
    if (bullRedisConnection) {
        return bullRedisConnection;
    }

    const { redisUrl } = getBullMqRuntimeConfig();

    bullRedisConnection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
    });

    bullRedisConnection.on('error', (err) => {
        console.error('[bullmq] redis connection error:', err?.message || err);
    });

    return bullRedisConnection;
}

/**
 * Close the singleton BullMQ Redis connection.
 */
export async function closeBullRedisConnection(): Promise<void> {
    if (!bullRedisConnection) {
        return;
    }

    await bullRedisConnection.quit();
    bullRedisConnection = null;
}

/**
 * Quick local connection state check.
 */
export function isBullRedisOpen(): boolean {
    return bullRedisConnection?.status === 'ready' || bullRedisConnection?.status === 'connect';
}
