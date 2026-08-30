// Pincode resolution route — Phase 1 (auth redesign, Rev 3 §9-10).
//
// Resolves a 6-digit PIN to City / District / State nationwide via
// api.postalpincode.in, cached in Redis for 30 days (PIN metadata is static).
// On lookup failure or unknown PIN it returns source:"none" so the frontend
// falls back to manual city/district/state entry — onboarding never blocks.
import express, { Router } from "express";
import { cacheGet, cacheSet } from "../src/lib/redisCache";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { sendErrorResponse, ValidationError, NotFoundError } from "../helpers/errors";

const router = Router();


// Express 4 does not forward rejected async handlers to its error middleware.
const wrap = (handler: express.RequestHandler): express.RequestHandler => (req, res, next) => {
  try {
    const result = handler(req, res, next) as unknown;
    if (result && typeof (result as Promise<unknown>).catch === "function") {
      void (result as Promise<unknown>).catch(next);
    }
  } catch (error) {
    next(error);
  }
};

export interface PincodeLookup {
  pincode: string;
  area: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  source: "api" | "cache" | "none";
}

const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days — PIN metadata is static

async function fetchFromPostalPincode(pincode: string): Promise<PincodeLookup> {
  const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
    signal: AbortSignal.timeout(5000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`postalpincode.in HTTP ${res.status}`);
  const body = (await res.json()) as Array<{
    Status: string;
    PostOffice?: Array<{ Name: string; District: string; State: string; Division?: string }>;
  }>;
  const entry = body?.[0];
  const po = entry?.PostOffice?.[0];
  if (entry?.Status !== "Success" || !po) {
    return { pincode, area: null, city: null, district: null, state: null, source: "none" };
  }
  return {
    pincode,
    area: po.Name || null,
    city: po.Division || po.Name || null,
    district: po.District || null,
    state: po.State || null,
    source: "api",
  };
}

/**
 * Resolve a PIN to location metadata. Cache-first, then external API, then
 * source:"none" (never throws — callers must handle the none case).
 */
export async function resolvePincode(pincode: string): Promise<PincodeLookup> {
  const code = String(pincode || "").trim().replace(/\s+/g, "");
  const cacheKey = `pincode:${code}`;
  const cached = await cacheGet<PincodeLookup>(cacheKey);
  if (cached) return { ...cached, source: "cache" };
  try {
    const result = await fetchFromPostalPincode(code);
    if (result.source === "api") await cacheSet(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
  } catch (e) {
    console.warn(`[Pincode] lookup failed for ${code}:`, (e as Error)?.message || e);
    return { pincode: code, area: null, city: null, district: null, state: null, source: "none" };
  }
}

// GET /api/pincode/:pin
router.get(
  "/pincode/:pin",
  rateLimitMiddleware(30, 60_000),
  wrap(async (req, res) => {
    const pin = String(req.params.pin || "").trim();
    if (!/^\d{6}$/.test(pin)) {
      return sendErrorResponse(res, new ValidationError("Enter a valid 6-digit PIN code."));
    }
    const result = await resolvePincode(pin);
    if (result.source === "none") {
      return sendErrorResponse(res, new NotFoundError("PIN code not found. Enter your city, district, and state manually."));
    }
    return res.json(result);
  })
);

export default router;
