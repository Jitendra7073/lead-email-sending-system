import dotenv from "dotenv";
import { createClient } from "redis";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

/**
 * Acquire a lock for a given key using SET NX PX.
 * Returns a token string when acquired, or null when not acquired.
 * @param {string} key
 * @param {number} ttlMs
 */
export async function acquireLock(key, ttlMs = 30000) {
    const client = createClient({ url: REDIS_URL });
    await client.connect();
    try {
        const token = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const ok = await client.set(key, token, { NX: true, PX: ttlMs });
        if (ok) return { client, token };
        await client.disconnect();
        return null;
    } catch (err) {
        try {
            await client.disconnect();
        } catch (_) { }
        throw err;
    }
}

/**
 * Release a lock previously acquired.
 * Uses a Lua script to check-and-del.
 * @param {{client: import('redis').RedisClientType, token: string}} lockHandle
 * @param {string} key
 */
export async function releaseLock(lockHandle, key) {
    if (!lockHandle) return false;
    const { client, token } = lockHandle;
    const lua = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
    try {
        const res = await client.eval(lua, { keys: [key], arguments: [token] });
        await client.disconnect();
        return Number(res) > 0;
    } catch (err) {
        try {
            await client.disconnect();
        } catch (_) { }
        throw err;
    }
}
