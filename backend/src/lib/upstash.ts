/**
 * Upstash Redis REST client — singleton access + key prefixing.
 *
 * Env vars:
 *   UPSTASH_REDIS_REST_URL  — Upstash console REST URL
 *   UPSTASH_REDIS_REST_TOKEN — Upstash console REST token
 *   UPSTASH_KEY_PREFIX      — logical namespace prefix (default "fmd:")
 *
 * getUpstash() throws when env is missing — callers decide their own fallback
 * (redisCache falls back to in-memory LRU; store.ts lets errors propagate).
 */

import { Redis } from "@upstash/redis";

export type { Redis };

let client: Redis | null = null;

export function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

export function getUpstash(): Redis {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Upstash is not configured: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"
    );
  }
  client = new Redis({ url, token });
  return client;
}

export function k(key: string): string {
  return `${process.env.UPSTASH_KEY_PREFIX ?? "fmd:"}${key}`;
}
