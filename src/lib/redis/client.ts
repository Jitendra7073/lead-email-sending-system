import { createClient, RedisClientType } from "redis";

let client: RedisClientType | null = null;

/**
 * Create and return a shared Redis client.
 * @param {string} [url] Redis connection URL (e.g. redis://localhost:6379)
 * @returns {RedisClientType} connected Redis client
 */
export async function getRedisClient(url?: string): Promise<RedisClientType> {
    if (client) return client;

    const connectionUrl = url || process.env.REDIS_URL || "redis://127.0.0.1:6379";
    client = createClient({ url: connectionUrl });

    client.on("error", (err) => {
        // Keep console logging minimal here — callers can handle errors too
        console.error("[redis] client error:", err?.message || err);
    });

    await client.connect();
    return client;
}

/**
 * Disconnect the shared Redis client.
 */
export async function disconnectRedis(): Promise<void> {
    if (!client) return;
    try {
        await client.disconnect();
    } finally {
        client = null;
    }
}

/**
 * Get a value by key from Redis.
 * @param {string} key
 */
export async function redisGet(key: string): Promise<string | null> {
    const c = await getRedisClient();
    return c.get(key);
}

/**
 * Set a value in Redis with optional TTL seconds.
 * @param {string} key
 * @param {string} value
 * @param {number} [ttlSeconds]
 */
export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const c = await getRedisClient();
    if (ttlSeconds && ttlSeconds > 0) {
        await c.set(key, value, { EX: ttlSeconds });
    } else {
        await c.set(key, value);
    }
}

/**
 * Delete a key from Redis.
 * @param {string} key
 */
export async function redisDel(key: string): Promise<number> {
    const c = await getRedisClient();
    return c.del(key);
}

/**
 * Check whether the shared client is currently open (fast, does not send network traffic).
 * Returns `false` if the client has not been created yet or is closed.
 */
export function isRedisConnected(): boolean {
    return Boolean(client && (client as any).isOpen);
}

/**
 * Perform a PING against Redis to verify liveness.
 * This will call `getRedisClient()` which will connect if needed.
 * @returns {Promise<boolean>} `true` when Redis responds to PING, otherwise `false`.
 */
export async function pingRedis(): Promise<boolean> {
    try {
        const c = await getRedisClient();
        // `ping()` returns 'PONG' on success for node-redis v4
        const res = await c.ping();
        return res === "PONG" || res === "OK" || res === undefined;
    } catch (err) {
        return false;
    }
}

/**
 * Acquire a simple lock using SET NX with expiry.
 * Returns the lock token (a random string) when acquired, or null if not acquired.
 * Caller SHOULD call releaseLock with the returned token.
 * @param {string} key lock key
 * @param {number} ttlMs lock ttl in milliseconds
 */
export async function acquireLock(key: string, ttlMs: number): Promise<string | null> {
    const c = await getRedisClient();
    const token = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const ok = await c.set(key, token, { NX: true, PX: ttlMs });
    return ok ? token : null;
}

/**
 * Release a lock previously acquired with acquireLock.
 * Uses a small Lua script to ensure only the owner deletes the key.
 * @param {string} key
 * @param {string} token
 */
export async function releaseLock(key: string, token: string): Promise<boolean> {
    const c = await getRedisClient();
    const lua = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
    const res = await c.eval(lua, { keys: [key], arguments: [token] });
    return Number(res) > 0;
}

/**
 * Publish a message to a channel.
 * @param {string} channel
 * @param {string} message
 */
export async function publish(channel: string, message: string): Promise<number> {
    const c = await getRedisClient();
    return c.publish(channel, message);
}

/**
 * Subscribe to a channel.
 * NOTE: This returns a dedicated client you must disconnect when done.
 * @param {string} channel
 * @param {(message: string) => void} onMessage
 */
export async function subscribe(channel: string, onMessage: (message: string) => void) {
    const conn = createClient({ url: process.env.REDIS_URL || "redis://127.0.0.1:6379" });
    await conn.connect();
    const subscriber = conn.duplicate();
    await subscriber.connect();
    await subscriber.subscribe(channel, (message) => onMessage(message));
    return subscriber; // caller responsible for calling .disconnect()
}

export default {
    getRedisClient,
    disconnectRedis,
    redisGet,
    redisSet,
    redisDel,
    acquireLock,
    releaseLock,
    publish,
    subscribe,
};
