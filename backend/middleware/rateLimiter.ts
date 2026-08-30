// Rate limiter middleware — Phase 2 (upstash-migration): Upstash REST-backed,
// in-memory fallback preserved from the pre-migration version.
// Atomic INCR (+EXPIRE on window start); falls back to the original in-memory
// Map so local dev and tests work without Upstash.
import express from "express";
import { getUpstash, isUpstashConfigured, k } from "../src/lib/upstash";

// ─── In-memory fallback (original implementation, kept for no-Upstash envs) ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function memRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

/**
 * Upstash-backed rate limit check. Atomic INCR + EXPIRE over REST.
 * Returns true if the request is allowed.
 * Fail-mode unchanged: REST/config failure falls through to memory (fail-open).
 */
export async function checkRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  if (isUpstashConfigured()) {
    try {
      const pkey = k(key);
      const lua = `local c=redis.call('INCR',KEYS[1]) if c==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end return c`;
      const raw = (await getUpstash().eval(lua, [pkey], [String(windowMs)])) as unknown as number | string;
      const count = typeof raw === "string" ? parseInt(raw, 10) : (raw as number);
      return count <= max;
    } catch {
      // Upstash transient failure — fall through to memory (fail-open)
    }
  }
  return memRateLimit(key, max, windowMs);
}

import { sendErrorResponse, RateLimitError } from "../helpers/errors";

function rateLimitMiddleware(max: number, windowMs = 60_000, tag = "") {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Test runs drive flows that intentionally exceed prod-friendly budgets.
    // Skip enforcement so suites stay deterministic (memory/Upstash counters
    // would otherwise bleed across tests).
    if (process.env.NODE_ENV === "test" || process.env.TEST_MODE === "1") return next();
    const ip = req.ip || "unknown";
    // Tag distinguishes the app-wide /api budget from route-local budgets so
    // they don't share a key (two middlewares both running when a route applies
    // its own tighter limit — without the tag they would double-INCR and
    // effectively halve both limits).
    const key = `rl:${req.method}:${req.baseUrl || ""}${req.path}:${ip}:${tag}`;
    if (!(await checkRateLimit(key, max, windowMs))) {
      return sendErrorResponse(res, new RateLimitError("Too many requests. Please try again later."));
    }
    next();
  };
}

// Periodically clean up rate limit map (memory fallback only)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitMap.entries()) {
    if (now > v.resetAt) rateLimitMap.delete(k);
  }
}, 60_000);

export default rateLimitMiddleware;
