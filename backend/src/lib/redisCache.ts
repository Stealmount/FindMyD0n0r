/**
 * Redis Cache Service — Upstash REST port (Phase 2, upstash-migration).
 * Same exported API as the pre-migration version. Falls back to the same
 * in-memory LRU when Upstash is not configured or a REST call fails.
 *
 * Required env vars:
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 *   UPSTASH_KEY_PREFIX — key namespace (default "fmd:")
 *
 * Error-swallow contract preserved: callers never see cache errors; failures
 * degrade to the in-memory LRU exactly like before.
 */

import { getUpstash, isUpstashConfigured, k } from "./upstash";

// ─── In-memory LRU fallback (same as original cacheService.ts) ────────────────
const MAX_MEMORY_ENTRIES = 500;
const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();

function memGet<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memoryCache.delete(key); return null; }
  return entry.value as T;
}

function memSet(key: string, value: unknown, ttlSeconds: number): void {
  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    // Evict oldest entry
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function memInvalidatePrefix(prefix: string): void {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

let upstashActive = true; // closeRedis() flips this off (test teardown parity)
let lastRedisWarningAt = 0;
let redisWarned = false;

function warnRedis(message: string): void {
  const now = Date.now();
  if (redisWarned && now - lastRedisWarningAt < 600_000) return; // warn at most every 10 min after first
  redisWarned = true;
  lastRedisWarningAt = now;
  console.warn(`[Redis] ⚠️  ${message}`);
}

function useUpstash(): boolean {
  return upstashActive && isUpstashConfigured();
}

/**
 * Legacy accessor — its only consumer (the Redis-backed rate limiter) now uses
 * Upstash directly. Kept so no exported name disappears.
 */
export function getRedisClient(): null {
  return null;
}

/**
 * Get a cached value. Returns null on miss or error.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (useUpstash()) {
    try {
      // @upstash/redis auto-parses JSON responses; since we always store
      // JSON.stringify(value), the client hands back the original value.
      const value = await getUpstash().get<T>(k(key));
      if (value == null) return null;
      if (typeof value === "string") {
        // Defensive: raw non-JSON payloads come back as plain strings.
        try { return JSON.parse(value) as T; } catch { return value as unknown as T; }
      }
      return value;
    } catch (e: any) {
      warnRedis(`cacheGet failed: ${e?.message || e}`);
      /* fall through */
    }
  }
  return memGet<T>(key);
}

/**
 * Set a cached value with TTL in seconds.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  if (useUpstash()) {
    try {
      await getUpstash().set(k(key), JSON.stringify(value), { ex: ttlSeconds });
      return;
    } catch (e: any) {
      warnRedis(`cacheSet failed: ${e?.message || e}`);
      /* fall through */
    }
  }
  memSet(key, value, ttlSeconds);
}

/**
 * Atomic set-if-not-exists (NX). Returns true if key was set, false if already existed.
 * Used for idempotency keys, duplicate guards and worker locks.
 */
export async function cacheSetNX(key: string, value: unknown, ttlSeconds = 60): Promise<boolean> {
  if (useUpstash()) {
    try {
      const result = await getUpstash().set(k(key), JSON.stringify(value), {
        ex: ttlSeconds,
        nx: true,
      });
      return result === "OK";
    } catch (e: any) {
      warnRedis(`cacheSetNX failed: ${e?.message || e}`);
      /* fall through */
    }
  }
  // Memory fallback: check-then-set (race possible but acceptable for local dev)
  if (memoryCache.has(key)) return false;
  memSet(key, value, ttlSeconds);
  return true;
}

/**
 * Delete all keys that begin with `prefix`.
 */
export async function cacheInvalidatePrefix(prefix: string): Promise<void> {
  if (useUpstash()) {
    try {
      // SCAN is O(N) but non-blocking — safe for production
      let cursor: string | number = "0";
      do {
        const [next, keys] = await getUpstash().scan(cursor, {
          match: `${k(prefix)}*`,
          count: 200,
        });
        cursor = next;
        if (keys.length > 0) await getUpstash().del(...keys);
      } while (String(cursor) !== "0");
      return;
    } catch (e: any) {
      warnRedis(`cacheInvalidatePrefix failed: ${e?.message || e}`);
      /* fall through */
    }
  }
  memInvalidatePrefix(prefix);
}

/**
 * Delete a single key.
 */
export async function cacheDel(key: string): Promise<void> {
  if (useUpstash()) {
    try {
      await getUpstash().del(k(key));
      return;
    } catch (e: any) {
      warnRedis(`cacheDel failed: ${e?.message || e}`);
      /* fall through */
    }
  }
  memoryCache.delete(key);
}

/**
 * Cache stats (compatible with legacy /api/cache/stats endpoint).
 */
export function getCacheStats() {
  return {
    backend: useUpstash() ? 'upstash' : 'memory-lru',
    memoryEntries: memoryCache.size,
    redisConnected: useUpstash(),
  };
}

/**
 * Stop background reconnection machinery. The REST client is stateless (no
 * sockets/timers), so this only flips the backend flag — kept because tests
 * import it to guarantee process exit.
 */
export function closeRedis(): void {
  upstashActive = false;
}
