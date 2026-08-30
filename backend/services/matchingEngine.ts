// Matching engine service — extracted from server.ts (Phase 3 decomposition, 3.8/3.6.3 prerequisite)
// Owns donor eligibility, match creation, notification dispatch, and the open-request
// re-match trigger used by donor route completion.
import { randomUUID, randomBytes } from "node:crypto";
import { getCollection as dbGetCollection, getDoc as dbGetDoc, saveDoc as dbSaveDoc, deleteDoc as dbDeleteDoc } from "../src/lib/serverDb";
import { getByIndex as storeGetByIndex, mgetDocs as storeMget } from "../src/lib/store";
import {
  cacheGet,
  cacheSet,
  cacheSetNX,
  cacheDel,
  cacheInvalidatePrefix,
} from "../src/lib/redisCache";
import { getUpstash, isUpstashConfigured, k } from "../src/lib/upstash";
import { normalizePhone } from "../helpers/phone";
import { nowISO, nowDate } from "../helpers/time";
import {
  sendWhatsApp,
  buildDonorSosMessage,
  buildRequesterSystemAlertMessage,
  buildNoDonorsFoundAlertMessage,
} from "../src/lib/waha";
import { buildDonorSosEmailHTML, buildDonorConfirmedDetailsEmailHTML, buildDonorsMatchedEmailHTML, buildNoDonorsYetEmailHTML } from "../src/lib/email";
import { sendEmailViaResend } from "./notificationService";
import { enqueueMessage } from "../src/lib/messaging";
import {
  isBloodCompatible,
  BLOOD_COMPATIBILITY_MATRIX,
  INITIAL_BATCH_SIZE,
  ELIGIBLE_POOL_SIZE,
  MAX_SEARCH_BATCHES,
  type BloodType,
} from "../src/types";
import type { BloodRequest, DonationLog, Match, NotificationLog, User } from "../src/types";
import { mapProfile } from "../src/lib/serverDb";
import { getDistanceBetweenPincodes } from "../src/lib/geo";
import { PINCODE_COORDS } from "../src/data/pincode_coords";
import { log } from "../helpers/logger";

// ─── Shared Constants ────────────────────────────────────────────────────────
// ponytail: single source of truth — worker was filtering only ["open","matching"],
// missing "broadcasting" and "partially_matched" entirely (P0 bug)
export const ACTIVE_REQUEST_STATUSES: readonly string[] = ["broadcasting", "matching", "open", "partially_matched"];

// Phase 3: consent on one terminal set. `closed` is included temporarily so
// legacy rows written before the sweepWorker 'closed'→'expired' switch stay
// terminal — remove after backfill-closed-to-expired has run in production.
export const TERMINAL_REQUEST_STATUSES: readonly string[] = ["cancelled", "fulfilled", "expired", "closed"];

export const DONOR_LOCK_TTL_S = 5 * 60; // 5 minutes

// Helper sorting function: oldest last_donation_date first (null/never donated gets priority)
function sortDonorsByActivity(a: any, b: any) {
  if (!a.last_donation_date && b.last_donation_date) return -1;
  if (a.last_donation_date && !b.last_donation_date) return 1;
  if (a.last_donation_date && b.last_donation_date) {
    return a.last_donation_date.localeCompare(b.last_donation_date);
  }
  // ponytail: descending — fresher profiles sort first (was ascending, putting stalest first)
  return (b.updated_at || '').localeCompare(a.updated_at || '');
}

// Feature 2: Deprioritize stale donors (>90 days since updated_at) — bump rank by 1 (max 5)
function applyStalenessTier(donors: { match_rank: number; updated_at?: string }[]) {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  for (const d of donors) {
    if (d.updated_at && new Date(d.updated_at).getTime() < cutoff) {
      d.match_rank = Math.min(d.match_rank + 1, 5);
    }
  }
}

// ── Donor reservation lock helpers (prevents double-booking) ─────────────────
function donorLockKey(donorId: string): string {
  return `donor_lock_${donorId}`;
}

// ── Authoritative terminal guard (Phase 8 close-lifecycle hardening) ─────────
// A worker/trigger may hold a STALE in-memory request snapshot while the
// requester closes the request in the authoritative store. Nothing that creates
// donor matches may trust that snapshot: writes that advance matching use a
// Redis-Lua conditional that re-reads the LIVE request document and refuses
// terminal/absent documents atomically. A plain full-doc overwrite of a stale
// snapshot could resurrect a closed request and clobber its terminal state (or
// its truthful counters), so it is never used for a status transition.
const TERMINAL_LUA = "local terminal = { ['cancelled']=1, ['fulfilled']=1, ['expired']=1, ['closed']=1 }";

/**
 * Atomically try to acquire a donor reservation lock — but only for a LIVE,
 * non-terminal request. The Lua script re-reads the request document inside
 * Redis, so even a worker holding a stale snapshot can never lock a donor for
 * a request the requester just closed (the lock-creation path is the last
 * defensive point for BOTH matchAndNotifyRequest and createNextDonorMatch).
 * Returns true if the lock was acquired, false otherwise.
 */
const GUARDED_LOCK_SCRIPT = `
local reqRaw = redis.call('GET', KEYS[2])
if not reqRaw then return {'request_not_found'} end
local req = cjson.decode(reqRaw)
${TERMINAL_LUA}
if terminal[req.status] then return {'terminal'} end
if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then return {'ok'} end
return {'locked'}
`;

export async function acquireDonorLock(donorId: string, requestId: string): Promise<boolean> {
  const key = donorLockKey(donorId);
  if (isUpstashConfigured()) {
    try {
      const res = (await getUpstash().eval(
        GUARDED_LOCK_SCRIPT,
        [k(key), k(`blood_requests:${requestId}`)],
        [JSON.stringify(requestId), String(DONOR_LOCK_TTL_S)]
      )) as unknown;
      const tag = Array.isArray(res) ? res[0] : res;
      if (tag === "ok") return true;
      if (tag === "terminal") {
        log.warn("Donor lock refused — request is terminal", { donorId, requestId });
        return false;
      }
      return false; // 'locked' by another request, or request doc missing
    } catch (e: any) {
      // Degrade safely: re-check the LIVE request before the plain NX so a
      // stale snapshot still cannot lock a donor for a closed request.
      log.warn("Donor lock Lua guard failed — falling back to live re-check + NX", {
        donorId,
        requestId,
        err: e?.message,
      });
    }
  }
  try {
    const live = await dbGetDoc<BloodRequest>("blood_requests", requestId);
    if (!live || TERMINAL_REQUEST_STATUSES.includes(live.status)) return false;
  } catch {
    /* proceed to NX */
  }
  return cacheSetNX(key, requestId, DONOR_LOCK_TTL_S);
}

/**
 * Atomically advance a request's status (and optionally search_batch) against
 * the LIVE document. Refuses (returns false) when the request is missing or
 * already terminal — the caller must then treat the request as closed and
 * roll back anything it was about to persist. In local/no-store mode this
 * degrades to a live-read + guarded save (the terminal revalidation is never
 * dropped, so a stale snapshot can never write over a closed request).
 * Exported for the sweep worker, which uses it for the expire transition.
 */
const TRANSITION_SCRIPT = `
local reqRaw = redis.call('GET', KEYS[1])
if not reqRaw then return 0 end
local req = cjson.decode(reqRaw)
${TERMINAL_LUA}
if terminal[req.status] then return 0 end
req.status = ARGV[1]
if ARGV[2] ~= '' then req.search_batch = tonumber(ARGV[2]) end
req.updated_at = ARGV[3]
redis.call('SET', KEYS[1], cjson.encode(req))
return 1
`;

export async function transitionRequestStatusIfActive(
  requestId: string,
  status: string,
  patch: { search_batch?: number } = {}
): Promise<boolean> {
  if (isUpstashConfigured()) {
    try {
      const res = (await getUpstash().eval(
        TRANSITION_SCRIPT,
        [k(`blood_requests:${requestId}`)],
        [String(status), patch.search_batch != null ? String(patch.search_batch) : "", nowISO()]
      )) as unknown;
      return Number(Array.isArray(res) ? res[0] : res) === 1;
    } catch (e: any) {
      log.warn("transitionRequestStatusIfActive Lua failed — falling back to guarded JS save", {
        requestId,
        status,
        err: e?.message,
      });
    }
  }
  try {
    const live = await dbGetDoc<BloodRequest>("blood_requests", requestId);
    if (!live || TERMINAL_REQUEST_STATUSES.includes(live.status)) return false;
    await dbSaveDoc("blood_requests", requestId, {
      ...live,
      status,
      ...(patch.search_batch != null ? { search_batch: patch.search_batch } : {}),
      updated_at: nowISO(),
    } as unknown as Record<string, unknown>);
    return true;
  } catch (e: any) {
    log.warn("transitionRequestStatusIfActive guarded save failed", { requestId, status, err: e?.message });
    return false;
  }
}

/**
 * Delete freshly-created match rows and release their donor locks. Called when
 * a match round wins its locks but the authoritative status bump (or the final
 * notify gate) discovers the request was closed mid-round — leaving the rows or
 * locks behind would leave invitations and bookings that must not exist. Every
 * outcome is inspected; failures are logged so they are never silently lost.
 */
async function rollbackJustCreatedMatches(requestId: string, matches: Match[]): Promise<void> {
  if (matches.length === 0) return;
  const results = await Promise.allSettled(
    matches.map(async (m) => {
      await dbDeleteDoc("matches", m.id);
      await releaseDonorLock(m.donor_id, m.request_id);
    })
  );
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const reason = (r as PromiseRejectedResult).reason;
      log.error("Close-lifecycle: rollback of newly-created match FAILED", {
        requestId,
        matchId: matches[i]?.id,
        donorId: matches[i]?.donor_id,
        err: (reason as Error)?.message ?? String(reason),
      });
    }
  });
}

/** Release a donor's reservation lock (on decline, timeout, or match fulfillment). requestId is required to avoid releasing another request's lock. */
export async function releaseDonorLock(donorId: string, requestId: string): Promise<void> {
  const key = donorLockKey(donorId);
  if (isUpstashConfigured()) {
    try {
      const script = `local current = redis.call("GET", KEYS[1]) if current == ARGV[1] then return redis.call("DEL", KEYS[1]) end return 0`;
      // cacheSetNX stores JSON.stringify(requestId), so compare against JSON-encoded value
      await getUpstash().eval(script, [k(key)], [JSON.stringify(requestId)]);
      return;
    } catch {
      // fall through to conditional delete
    }
  }
  // Memory/fallback path: compare before delete — if lock is held by a different request, keep it
  try {
    const current = await cacheGet<string>(key);
    if (current !== null && current !== requestId) return;
  } catch {
    /* ignore read error — proceed to delete */
  }
  await cacheDel(key);
}

/**
 * Returns eligible donors for a request, ordered by proximity.
 * Results are Redis-cached for 60 s to keep lookups fast.
 * Donors are tagged as `is_exact_match` (exact ABO/Rh) vs compatible (fallback).
 */
export async function findEligibleDonors(
  request: BloodRequest
): Promise<(User & { distance_km: number; match_rank: number; is_exact_match: boolean })[]> {
  // Phase 4: cache per-request (requestId slice) so two concurrent requests
  // over the same blood/pin/urgency never share a candidate snapshot — the
  // shared key could serve the same donor list to both and double-invite.
  // cacheInvalidatePrefix('eligible_') still covers these keys for invalidation.
  const cacheKey = `eligible_${request.blood_type_needed}_${request.hospital_pincode}_${request.urgency_level ?? "urgent"}_${request.id.slice(0, 8)}`;
  const cached = await cacheGet<(User & { distance_km: number; match_rank: number; is_exact_match: boolean })[]>(cacheKey);
  if (cached) return cached;

  // Prefer index-backed candidate fetch (narrows the set in the store) with
  // the full-table scan as automatic fallback.
  const dbCandidates = await findEligibleDonorsFromDB(request);
  const allDonors = dbCandidates !== null
    ? dbCandidates
    : await dbGetCollection<User>('users');
  const allMatches = await dbGetCollection<Match>('matches');
  const today = nowDate();

  // ── Anti-Spam: Donors alerted within last 6 hours on other requests ────────
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const recentAlertedDonors = new Set(
    allMatches
      .filter(m => m.notification_sent_at && new Date(m.notification_sent_at) > sixHoursAgo && m.request_id !== request.id)
      .map(m => m.donor_id)
  );

  // ── Hard filters ────────────────────────────────────────────────────────
  const eligible = allDonors.filter((d) => {
    if (d.account_status !== "active") return false;
    if (d.availability_status === "unavailable") return false;
    if (d.cooldown_until && d.cooldown_until >= today) return false;

    // Anti-spam throttle: prevent rapid-fire repeated texts across requests
    if (recentAlertedDonors.has(d.id) && request.urgency_level !== "critical") return false;

    // Blood compatibility: use the full ABO/Rh matrix, NOT exact-only.
    if (request.blood_type_needed !== 'ANY') {
      const donorType = (d.blood_type || '').toUpperCase().trim() as BloodType;
      if (!isBloodCompatible(donorType, request.blood_type_needed as BloodType)) return false;
    }

    // Emergency-only restriction removed: all requests match available donors
    // if (d.emergency_only && request.urgency_level !== "critical") return false;

    // Self-match prevention.
    // normalizePhone(null|undefined) → "" (see helpers/phone.ts: String(phone || "")),
    // which will never equal a valid requester phone (91XXXXXXXXXX format).
    // Donors with phone=null are therefore NOT excluded from matching by this guard.
    if (normalizePhone(d.phone) === normalizePhone(request.requester_phone)) return false;
    if (d.whatsapp_number && normalizePhone(d.whatsapp_number) === normalizePhone(request.requester_phone)) return false;
    if (d.email && request.requester_email && d.email.toLowerCase().trim() === request.requester_email.toLowerCase().trim()) return false;

    return true;
  });

  // ── Tag exact vs compatible ─────────────────────────────────────────────
  const donorsWithDistance = eligible.map((d) => {
    const dist = getDistanceBetweenPincodes(d.pincode, request.hospital_pincode);
    const is_exact_match = request.blood_type_needed === 'ANY'
      ? true
      : (d.blood_type || '').toUpperCase().trim() === request.blood_type_needed.toUpperCase().trim();
    return { ...d, distance_km: dist, match_rank: 4, is_exact_match };
  });

  // ── 4-tier geographic expansion (exact matches surfaced first per tier) ──
  // Tier 1: 0-3 km | Tier 2: 3-10 km | Tier 3: 10-25 km | Tier 4: >25 km
  const isRare = ['O-', 'AB-'].includes((request.blood_type_needed || '').toUpperCase().trim());

  let finalDonors: (User & { distance_km: number; match_rank: number; is_exact_match: boolean })[] = [];

  const sortTier = (a: typeof donorsWithDistance[0], b: typeof donorsWithDistance[0]) => {
    if (a.match_rank !== b.match_rank) return a.match_rank - b.match_rank;
    // Exact matches first within each tier
    if (a.is_exact_match !== b.is_exact_match) return a.is_exact_match ? -1 : 1;
    // Proximity first: physically nearest donor (distance_km) gets contacted first
    if (Math.abs(a.distance_km - b.distance_km) > 0.01) {
      return a.distance_km - b.distance_km;
    }
    return sortDonorsByActivity(a, b);
  };

  const tier1 = donorsWithDistance.filter(d => d.distance_km <= 3).map(d => ({ ...d, match_rank: 1 }));
  applyStalenessTier(tier1);
  tier1.sort(sortTier);
  finalDonors.push(...tier1);

  if (finalDonors.length < 3 || isRare) {
    const tier2 = donorsWithDistance.filter(d => d.distance_km > 3 && d.distance_km <= 10).map(d => ({ ...d, match_rank: 2 }));
    applyStalenessTier(tier2);
    tier2.sort(sortTier);
    finalDonors.push(...tier2);
  }

  if (finalDonors.length < 3 || isRare) {
    const tier3 = donorsWithDistance.filter(d => d.distance_km > 10 && d.distance_km <= 25).map(d => ({ ...d, match_rank: 3 }));
    applyStalenessTier(tier3);
    tier3.sort(sortTier);
    finalDonors.push(...tier3);
  }

  if (finalDonors.length < 3 || isRare) {
    const tier4 = donorsWithDistance.filter(d => d.distance_km > 25).map(d => ({ ...d, match_rank: 4 }));
    applyStalenessTier(tier4);
    tier4.sort(sortTier);
    finalDonors.push(...tier4);
  }

  // Deduplicate
  const seen = new Map<string, (User & { distance_km: number; match_rank: number; is_exact_match: boolean })>();
  for (const d of finalDonors) {
    if (!seen.has(d.id)) seen.set(d.id, d);
  }
  const result = Array.from(seen.values());

  await cacheSet(cacheKey, result, 60);
  return result;
}

/**
 * Index-backed candidate fetch — avoids scanning the full table
 * scan with a DB-side filtered query: donor_profiles.is_available = true AND
 * blood_group IN (compatible types) AND pincode IN (nearby pincodes).
 *
 * Returns a flat candidate list mapped to the same User shape mapProfile()
 * produces; findEligibleDonors applies the remaining filters + 4-tier geo
 * ranking. Returns null when the index path is unavailable so callers fall back to
 * the full scan.
 */
export async function findEligibleDonorsFromDB(
  request: BloodRequest
): Promise<(User & { distance_km: number; match_rank: number; is_exact_match: boolean })[] | null> {
  try {
    // Compatible donor blood types for this request (ANY → all).
    const compatibleTypes = request.blood_type_needed === 'ANY'
      ? Object.keys(BLOOD_COMPATIBILITY_MATRIX)
      : BLOOD_COMPATIBILITY_MATRIX[request.blood_type_needed as BloodType];

    // Nearby pincodes: exact + 3-digit-prefix neighbors (covers all 110xxx for Delhi NCR) + exact
    const requestPin = String(request.hospital_pincode || '').replace(/\s+/g, '');
    const nearbyPincodes = new Set<string>();
    if (requestPin) {
      nearbyPincodes.add(requestPin);
      for (const code of Object.keys(PINCODE_COORDS)) {
        if (code.slice(0, 3) === requestPin.slice(0, 3) && code.length >= 3) {
          nearbyPincodes.add(code);
        }
      }
    }

    // Store index queries batch pincodes (max 30 per round); batch if needed.
    const pincodeArray = Array.from(nearbyPincodes);
    const donorProfiles: any[] = [];

    const pincodeBatches: string[][] = [];
    if (pincodeArray.length <= 30) {
      pincodeBatches.push(pincodeArray);
    } else {
      for (let i = 0; i < pincodeArray.length; i += 30) {
        pincodeBatches.push(pincodeArray.slice(i, i + 30));
      }
    }

    for (const batch of pincodeBatches) {
      // Store strategy: union of per-pincode SETs, then in-app predicates
      // mirroring the original query chain (is_available equality,
      // blood_group IN when 1..30 values, pincode IN via the index itself).
      const candidates = await storeGetByIndex<any>('donor_profiles', 's:dprof:pin:', batch);
      const bgFilterActive = compatibleTypes.length > 0 && compatibleTypes.length <= 30;
      const filtered = candidates.filter((dp: any) =>
        dp.is_available === true && (!bgFilterActive || compatibleTypes.includes(dp.blood_group))
      );
      donorProfiles.push(...filtered.slice(0, 200));
    }

    if (donorProfiles.length === 0) return [];

    // Fetch corresponding profiles from the profiles collection
    const profileIds = [...new Set(donorProfiles.map((dp: any) => dp.profile_id).filter(Boolean))];
    const profilesMap = new Map<string, any>();

    for (let i = 0; i < profileIds.length; i += 30) {
      const batch = profileIds.slice(i, i + 30);
      if (batch.length === 0) continue;
      const hydrated = await storeMget<any>('profiles', batch);
      hydrated.forEach((p: any) => { if (p) profilesMap.set(p.id, p); });
    }

    // Reshape to match the profiles-with-donor_profile structure mapProfile expects
    const data = donorProfiles.map((dp: any) => {
      const profile = profilesMap.get(dp.profile_id) || {};
      return {
        ...profile,
        donor_profile: { blood_group: dp.blood_group, pincode: dp.pincode, is_available: dp.is_available, emergency_only: dp.emergency_only, cooldown_until: dp.cooldown_until },
      };
    });

    // Map to the same User shape mapProfile() produces. All filtering beyond
    // the DB-side availability/blood/pincode predicates (anti-spam, self-match,
    // cooldown, geo-tiering) is applied once in findEligibleDonors.
    return data.map(mapProfile) as (User & {
      distance_km: number;
      match_rank: number;
      is_exact_match: boolean;
    })[];
  } catch (err) {
    console.warn(`[Matching] findEligibleDonorsFromDB fallback to full scan:`, (err as any)?.message || err);
    return null;
  }
}

interface NotifyResult {
  donorId: string;
  whatsapp: boolean;
  email: boolean;
  /** True when the notification was deliberately suppressed because the
   *  request became terminal (or the match was resolved) between match
   *  creation and the actual delivery commit. No channel was sent and no
   *  notification bookkeeping was written — the caller must roll back the
   *  invitation. */
  suppressed: boolean;
}

/**
 * Authoritative delivery-time guard (notification hardening).
 *
 * A donor SOS invite is only legitimate while the request is still LIVE and the
 * match is still PENDING in the authoritative store. This re-reads both live
 * documents immediately before dispatch — not a stale worker snapshot, but the
 * store's current state — so a notification created while the request passed
 * the earlier `preNotify` gate is still suppressed if the requester closed the
 * request in the microseconds in between. A suppressed invite carries no
 * WhatsApp/email send and no notification/match status write; the caller rolls
 * back the invitation so no actionable invite survives on a closed request.
 */
async function deliveryGuard(
  match: Match
): Promise<{ blocked: boolean; reason: string }> {
  const live = await dbGetDoc<BloodRequest>("blood_requests", match.request_id);
  if (!live) return { blocked: true, reason: "request_not_found" };
  if (TERMINAL_REQUEST_STATUSES.includes(live.status)) return { blocked: true, reason: "terminal" };
  const liveMatch = await dbGetDoc<Match>("matches", match.id);
  if (!liveMatch) return { blocked: true, reason: "match_not_found" };
  if (liveMatch.donor_response !== "pending") return { blocked: true, reason: "match_resolved" };
  return { blocked: false, reason: "" };
}

/**
 * Test-only fault seam (production-safe): NODE_ENV=test / TEST_MODE=1 with
 * TEST_NOTIFY_CLOSE listing a request id (or '*') writes that request to the
 * terminal 'cancelled' state at the worst possible moment — after the atomic
 * status bump and the pre-notify live gate but immediately before the
 * notification fan-out. This deterministically simulates the requester closing
 * the request in the final delivery window, letting regression tests prove the
 * delivery-time guard suppresses unsent invites and rolls them back. Never
 * consulted outside test builds.
 */
async function maybeInjectDeliveryClose(requestId: string): Promise<void> {
  if (process.env.NODE_ENV !== "test" && process.env.TEST_MODE !== "1") return;
  const targets = process.env.TEST_NOTIFY_CLOSE;
  if (!targets) return;
  if (targets !== "*" && !targets.split(",").includes(requestId)) return;
  await dbSaveDoc("blood_requests", requestId, {
    status: "cancelled",
    updated_at: nowISO(),
  } as unknown as Record<string, unknown>);
}

/**
 * Fires WhatsApp + Email in parallel for a single donor/match pair.
 * Both channels are attempted regardless of individual failures.
 * Email is dispatched via the async message queue (enqueueMessage) so the
 * caller returns near-instantly; retries are handled by messageWorker.
 */
async function notifyDonor(
  match: Match,
  request: BloodRequest,
  donor: User
): Promise<NotifyResult> {
  // Post-claim/-match delivery-time guard: never commit a NEW actionable
  // invite for a request that closed after match creation, or a match that was
  // resolved out from under this notification (e.g. by an in-app approval that
  // claimed the same donor's slot). Suppresses all channels and skips every
  // side effect; the caller rolls the invitation back.
  const gate = await deliveryGuard(match);
  if (gate.blocked) {
    console.log(
      `[Notify] Suppressed delivery for ${match.request_id}/${match.donor_id}: ${gate.reason}`
    );
    return { donorId: donor.id, whatsapp: false, email: false, suppressed: true };
  }

  const whatsappPhone = donor.whatsapp_number;
  // Pass the capability token so the donor's WhatsApp link uses matchToken= (S-1 fix).
  const sosMessage = buildDonorSosMessage(request, donor, match.id, match.public_token);
  // PRODUCT RULE: only the explicitly stored WhatsApp number may be used as a
  // WhatsApp destination. NEVER fall back to donor.phone. If no WhatsApp number
  // exists, skip dispatch, log a structured warning, and continue safely.
  let waOk = false;
  if (whatsappPhone) {
    waOk = await sendWhatsApp(whatsappPhone, sosMessage);
  } else {
    console.warn(`[Notify] Skipping WhatsApp notification: donor ${donor.id} (${donor.full_name}) has no WhatsApp number (request ${request.id}). Phone is never used as a WhatsApp destination.`);
  }

  // Dedup: skip email if match already has notification_sent_at set
  let emailOk = false;
  if (match.notification_sent_at) {
    console.log(`[Notify] Skipping email for ${donor.id}: already notified at ${match.notification_sent_at}`);
  } else if (donor.email && donor.email.includes("@") && !donor.email.endsWith(".local")) {
    try {
      const emailPayload = buildDonorSosEmailHTML({
        donorName: donor.full_name,
        bloodType: request.blood_type_needed,
        units: request.units_required,
        component: request.component_needed ?? "Whole Blood",
        hospitalName: request.hospital_name,
        hospitalArea: request.hospital_area,
        hospitalCity: request.hospital_city,
        urgencyLevel: request.urgency_level || "urgent",
        trackingCode: request.tracking_code,
        hospitalPincode: request.hospital_pincode,
        distanceKm: match.distance_km,
        expiresAt: request.expires_at,
      });
      const idempotencyKey = `blood-request/${request.id}/${donor.id}`;
      await enqueueMessage({
        channel: "email",
        recipient: donor.email,
        type: "donor_match",
        payload: {
          subject: emailPayload.subject,
          html: emailPayload.html,
          text: emailPayload.text,
          idempotencyKey,
          tags: [{ name: "request_id", value: request.tracking_code }],
          request_id: request.id,
          match_id: match.id,
        },
        delaySeconds: 0,
      });
      emailOk = true;
    } catch (e: any) {
      console.warn(`[Notify] Email enqueue failed for ${donor.email}:`, e?.message);
    }
  }

  // Log notification
  const notifId = randomUUID();
  await dbSaveDoc("notifications", notifId, {
    id: notifId,
    type: waOk ? "whatsapp" : emailOk ? "email" : "failed",
    recipient_type: "donor",
    recipient_id: donor.id,
    trigger_event: "match_found",
    message_body: sosMessage.slice(0, 400),
    status: waOk || emailOk ? "sent" : "failed",
    sent_at: waOk || emailOk ? nowISO() : null,
    created_at: nowISO(),
  } satisfies NotificationLog);

  // Delivery bookkeeping — writes ONLY notification_status, never donor_response
  // (Phase 3 decoupling: a failed WhatsApp must never read as a dead match).
  const delivered = waOk || emailOk;
  await dbSaveDoc("matches", match.id, {
    ...match,
    notification_sent_at: nowISO(),
    notification_channel: waOk ? "whatsapp" : emailOk ? "email" : "failed", // honest: no in-app inbox exists — status carries the failure
    notification_status: delivered ? "sent" : "retrying",
  });
  if (!delivered) {
    // Queue-backed retry with backoff for BOTH channels independently
    if (whatsappPhone) {
      await enqueueMessage({
        channel: "whatsapp",
        recipient: whatsappPhone,
        type: "match_sos_retry",
        payload: { text: sosMessage, request_id: request.id, match_id: match.id },
        delaySeconds: 30,
      }).catch((e: any) => console.error(`[Notify] WA retry enqueue failed for ${donor.id}:`, e?.message));
    }
    if (donor.email && donor.email.includes("@") && !donor.email.endsWith(".local")) {
      try {
        const retryPayload = buildDonorSosEmailHTML({
          donorName: donor.full_name,
          bloodType: request.blood_type_needed,
          units: request.units_required,
          component: request.component_needed ?? "Whole Blood",
          hospitalName: request.hospital_name,
          hospitalArea: request.hospital_area,
          hospitalCity: request.hospital_city,
          urgencyLevel: request.urgency_level || "urgent",
          trackingCode: request.tracking_code,
          hospitalPincode: request.hospital_pincode,
          distanceKm: match.distance_km,
          expiresAt: request.expires_at,
        });
        await enqueueMessage({
          channel: "email",
          recipient: donor.email,
          type: "match_sos_retry",
          payload: {
            subject: retryPayload.subject,
            html: retryPayload.html,
            text: retryPayload.text,
            idempotencyKey: `blood-request/${request.id}/${donor.id}/retry`,
            tags: [{ name: "request_id", value: request.tracking_code }],
            request_id: request.id,
            match_id: match.id,
          },
          delaySeconds: 30,
        });
      } catch (e: any) {
        console.error(`[Notify] Email retry enqueue failed for ${donor.id}:`, e?.message);
      }
    }
  }

  console.log(`[Notify] Donor ${donor.full_name} — WA:${waOk ? "sent" : "failed"} | Email:${emailOk ? "sent" : "failed"}`);
  return { donorId: donor.id, whatsapp: waOk, email: emailOk, suppressed: false };
}

export async function matchAndNotifyRequest(request: BloodRequest) {
  // Phase 8: terminal requests are closed — no new matches, no donor
  // notifications, no requester alerts. Guards the sweep, the match-and-notify
  // triggers, and any direct callers (reopen resets status, freeing the guard).
  if (TERMINAL_REQUEST_STATUSES.includes(request.status)) {
    return { matched: 0, deliveries: [] as PromiseSettledResult<unknown>[] };
  }

  // Phase 8 hardening: callers (background sweep, re-match triggers, direct
  // tests) may hold a STALE snapshot while the requester closed the request in
  // the authoritative store. The stale object is never authority to create
  // matches, locks, or notifications — re-read the LIVE document and no-op if
  // the request is gone or terminal.
  const liveNow = await dbGetDoc<BloodRequest>("blood_requests", request.id);
  if (!liveNow || TERMINAL_REQUEST_STATUSES.includes(liveNow.status)) {
    log.warn("Stale worker snapshot skipped — request already closed", {
      requestId: request.id,
      trackingCode: request.tracking_code,
      staleStatus: request.status,
      liveStatus: liveNow?.status ?? "missing",
    });
    return { matched: 0, deliveries: [] as PromiseSettledResult<unknown>[] };
  }
  request = liveNow;

  const eligibleDonors = await findEligibleDonors(request);
  const existingMatches = await dbGetCollection<Match>("matches");
  const requestMatches = existingMatches.filter((m) => m.request_id === request.id);
  const alreadyOffered = new Set(requestMatches.map((m) => m.donor_id));
  const approvedCount = requestMatches.filter((m) => m.donor_response === "approved").length;
  // Phase 5: trust the server-side counter once it exists; fall back to live count.
  const unitsConfirmed = request.units_confirmed ?? approvedCount;
  const openSlots = Math.max(0, request.units_required - Math.max(unitsConfirmed, approvedCount));
  // Progressive batching gate: wait out every pending invite before spawning the
  // next round; hard-stop when fulfilled or MAX_SEARCH_BATCHES reached (Phase 2).
  const hasPendingInvites = requestMatches.some((m) => m.donor_response === "pending");
  if (hasPendingInvites || openSlots === 0) return { matched: 0, deliveries: [] };
  const batch = (request.search_batch ?? 0) + 1;
  if (batch > MAX_SEARCH_BATCHES) return { matched: 0, deliveries: [] };

  // Filter out already-offered AND currently-locked donors
  const lockChecks = await Promise.all(
    eligibleDonors
      .filter((d) => !alreadyOffered.has(d.id))
      .map(async (d) => {
        const lockVal = await cacheGet<string>(donorLockKey(d.id));
        // Locked by a DIFFERENT request → skip
        if (lockVal && lockVal !== request.id) return null;
        return d;
      })
  );
  const freeDonors = lockChecks.filter(Boolean) as (User & {
    distance_km: number;
    match_rank: number;
    is_exact_match: boolean;
  })[];

  // Race model: intentionally over-invite up to INITIAL_BATCH_SIZE nearest free
  // donors per round — fastest responders claim slots (user-approved tradeoff).
  const selectedDonors = freeDonors.slice(0, ELIGIBLE_POOL_SIZE).slice(0, INITIAL_BATCH_SIZE);

  // Phase 4 observability: progressive multi-unit rounds are audit-able from
  // logs — confirmed counter, open slots, next round, and this wave's size.
  if (request.units_required > 1) {
    console.log(`[Matching] ${request.tracking_code} — confirmed ${request.units_confirmed ?? approvedCount}/${request.units_required}, openSlots ${openSlots}, batch ${request.search_batch ?? 0}→${batch}, hasPending ${hasPendingInvites}, selected ${selectedDonors.length}`);
  }

  // Acquire locks for selected donors before writing match records
  const lockResults = await Promise.all(
    selectedDonors.map((d) => acquireDonorLock(d.id, request.id))
  );
  const lockedDonors = selectedDonors.filter((_, i) => lockResults[i]);

  const inserts = await Promise.all(
    lockedDonors.map(async (donor) => {
      const match: Match = {
        id: randomUUID(),
        request_id: request.id,
        donor_id: donor.id,
        match_rank: donor.match_rank,
        notification_channel: "whatsapp",
        notification_sent_at: null,
        reminder_sent_at: null,
        donor_response: "pending",
        donor_response_at: null,
        contact_shared_at: null,
        outcome: null,
        outcome_confirmed_at: null,
        created_at: nowISO(),
        distance_km: donor.distance_km,
        is_exact_match: donor.is_exact_match,
        public_token: randomBytes(16).toString("hex"),
        notification_status: "pending",
        search_batch: batch,
      };
      await dbSaveDoc("matches", match.id, match as unknown as Record<string, unknown>);
      return { match, donor };
    })
  );

  // Phase 8 hardening: persist the batch advance ATOMICALLY against the LIVE
  // document. A plain full-doc overwrite of the (now-live, but seconds-old)
  // snapshot could clobber a concurrent close back into 'matching'/'open' and
  // resurrect the search; the Lua conditional refuses terminal/absent
  // documents. On refusal, the rows just created are rolled back — a closed
  // request must never gain matches, locks, or notifications.
  const bumped = await transitionRequestStatusIfActive(
    request.id,
    inserts.length ? "matching" : "open",
    { search_batch: batch }
  );
  if (!bumped) {
    log.warn("Match round save refused — request closed concurrently; rolling back new matches", {
      requestId: request.id,
      trackingCode: request.tracking_code,
      batch,
      newMatches: inserts.length,
    });
    await rollbackJustCreatedMatches(request.id, inserts.map((i) => i.match));
    return { matched: 0, deliveries: [] as PromiseSettledResult<unknown>[] };
  }

  // Final safety gate before any notification fan-out: confirms the request is
  // still live. The authoritative invariants (match rows + locks + status) are
  // already closed by the atomic steps above; this narrows the notification
  // window so a close that lands a moment later does not fan out donor invites.
  const preNotify = await dbGetDoc<BloodRequest>("blood_requests", request.id);
  if (!preNotify || TERMINAL_REQUEST_STATUSES.includes(preNotify.status)) {
    log.warn("Notify gate refused — request closed during match round", {
      requestId: request.id,
      trackingCode: request.tracking_code,
    });
    await rollbackJustCreatedMatches(request.id, inserts.map((i) => i.match));
    return { matched: 0, deliveries: [] as PromiseSettledResult<unknown>[] };
  }

  // Test-only fault seam: simulates the requester closing the request in the
  // window between the pre-notify live gate and the notification fan-out, so
  // regression tests can prove unsent invites are suppressed and rolled back.
  // Never consulted outside test builds (mirrors TEST_FAULT_RETIRE).
  await maybeInjectDeliveryClose(request.id);

  const deliveries = await Promise.allSettled(
    inserts.map(({ match, donor }) => notifyDonor(match, request, donor))
  );

  // Delivery-time hardening: if the request was closed (or the match resolved)
  // in the window between match creation and the delivery commit, each affected
  // notifyDonor returned `suppressed` — no invite was sent and no bookkeeping
  // written. Roll those invitations back so no actionable invite survives on a
  // closed request. A suppressed donor must not be told they were contacted.
  const suppressedInserts = inserts.filter((_, i) => {
    const r = deliveries[i];
    return r.status === "fulfilled" && (r.value as NotifyResult).suppressed;
  });
  if (suppressedInserts.length > 0) {
    log.warn("Notify suppressed — request closed or match resolved before delivery; rolling back invitations", {
      requestId: request.id,
      trackingCode: request.tracking_code,
      suppressed: suppressedInserts.length,
    });
    await rollbackJustCreatedMatches(request.id, suppressedInserts.map((i) => i.match));
  }

  if (inserts.length > 0 && suppressedInserts.length === 0) {
    if (request.requester_phone) {
      const text = buildRequesterSystemAlertMessage(request, inserts.length);
      await sendWhatsApp(request.requester_phone, text).catch(e => console.error("[WAHA] Failed to alert requester:", e.message));
    }
    if (request.requester_email && request.requester_email.includes("@")) {
      const mail = buildDonorsMatchedEmailHTML({
        requesterName: request.requester_name,
        matchedCount: inserts.length,
        trackingCode: request.tracking_code,
        hospitalName: request.hospital_name,
      });
      await sendEmailViaResend(request.requester_email, mail.subject, mail.html, mail.text).catch(e => console.error("[Email] Failed to alert requester:", e.message));
    }
  }

  // "No donors found" alert — de-duped: one per request per 2 hours (same pattern as SLA)
  if (inserts.length === 0 && alreadyOffered.size === 0) {
    const noDonorKey = `no_donor_alert_${request.id}`;
    const alreadyAlerted = await cacheSetNX(noDonorKey, "1", 2 * 60 * 60); // 2h TTL
    if (!alreadyAlerted) return { matched: 0, deliveries: [] };

    if (request.requester_phone) {
      const noMatchText = buildNoDonorsFoundAlertMessage(request);
      await sendWhatsApp(request.requester_phone, noMatchText).catch(e => console.error("[WAHA] Failed to send no-match alert:", e.message));
    }
    if (request.requester_email && request.requester_email.includes("@")) {
      const mail = buildNoDonorsYetEmailHTML({
        requesterName: request.requester_name,
        bloodType: request.blood_type_needed,
        trackingCode: request.tracking_code,
        hospitalName: request.hospital_name,
      });
      await sendEmailViaResend(request.requester_email, mail.subject, mail.html, mail.text).catch(e => console.error("[Email] Failed to send no-match alert:", e.message));
    }
  }

  await cacheInvalidatePrefix("eligible_");
  await cacheInvalidatePrefix("req_status_");
  return { matched: inserts.length, deliveries };
}
// ponytail: reuses existing matchAndNotifyRequest dedup (acquireDonorLock + alreadyOffered)
export async function notifyOpenRequestsForNewDonor(
  donorBloodGroup: string,
  donorPincode: string,
) {
  try {
    const allRequests = await dbGetCollection<BloodRequest>("blood_requests");
    const now = nowISO();
    const URGENCY_RANK: Record<string, number> = { critical: 0, urgent: 1, planned: 2 };
    const candidates = allRequests
      .filter((r) =>
        ACTIVE_REQUEST_STATUSES.includes(r.status) &&
        (!r.expires_at || r.expires_at >= now) &&
        (r.blood_type_needed === "ANY" || isBloodCompatible(donorBloodGroup as BloodType, r.blood_type_needed as BloodType)) &&
        getDistanceBetweenPincodes(donorPincode, r.hospital_pincode) <= 25
      )
      .sort((a, b) => {
        const ur = (URGENCY_RANK[a.urgency_level] ?? 9) - (URGENCY_RANK[b.urgency_level] ?? 9);
        if (ur !== 0) return ur;
        return getDistanceBetweenPincodes(donorPincode, a.hospital_pincode) - getDistanceBetweenPincodes(donorPincode, b.hospital_pincode);
      })
      .slice(0, 10);
    for (const req of candidates) {
      matchAndNotifyRequest(req).catch((e) =>
        console.error(`[EarlyMatch] matchAndNotify failed for ${req.tracking_code}:`, e.message)
      );
    }
  } catch (e: any) {
    console.error("[EarlyMatch] Failed to scan open requests:", e.message);
  }
}

export async function createNextDonorMatch(request: BloodRequest, excludedDonorId?: string) {
  // Phase 8: no cascade matches for a closed request — a cancelled/fulfilled/
  // expired request must not resurrect donor invitations.
  if (TERMINAL_REQUEST_STATUSES.includes(request.status)) return null;
  // Phase 8 hardening: never trust a stale snapshot to cascade a match onto a
  // request the requester closed after the snapshot was read.
  const liveNow = await dbGetDoc<BloodRequest>("blood_requests", request.id);
  if (!liveNow || TERMINAL_REQUEST_STATUSES.includes(liveNow.status)) {
    log.warn("Cascade refused — request closed concurrently", {
      requestId: request.id,
      trackingCode: request.tracking_code,
      staleStatus: request.status,
      liveStatus: liveNow?.status ?? "missing",
    });
    return null;
  }
  request = liveNow;
  const existingMatches = await dbGetCollection<Match>("matches");
  const excludedDonorIds = new Set(existingMatches.filter((match) => match.request_id === request.id).map((match) => match.donor_id));
  if (excludedDonorId) {
    const matchDoc = await dbGetDoc<Match>("matches", excludedDonorId);
    if (matchDoc) excludedDonorIds.add(matchDoc.donor_id);
    else excludedDonorIds.add(excludedDonorId);
  }
  const eligible = await findEligibleDonors(request);

  // Phase 4: the next donor MUST be reserved atomically — skip any donor whose
  // reservation lock is held by a different request (double-booking guard).
  const next = eligible.find((donor) => !excludedDonorIds.has(donor.id));
  if (!next) return null;

  const lockAcquired = await acquireDonorLock(next.id, request.id);
  if (!lockAcquired) {
    console.log(`[Matching] createNextDonorMatch: donor ${next.id} busy elsewhere for request ${request.id} — no cascade match`);
    return null;
  }

  const matchId = randomUUID();
  const match: Match = {
    id: matchId,
    request_id: request.id,
    donor_id: next.id,
    match_rank: next.match_rank,
    notification_channel: "whatsapp",
    notification_sent_at: null,
    reminder_sent_at: null,
    donor_response: "pending",
    donor_response_at: null,
    contact_shared_at: null,
    outcome: null,
    outcome_confirmed_at: null,
    created_at: nowISO(),
    distance_km: next.distance_km,
    is_exact_match: next.is_exact_match,
    public_token: randomBytes(16).toString("hex"),
    search_batch: (request.search_batch ?? 1),
  };

  await dbSaveDoc("matches", matchId, match);
  // Final live gate before the notification: the lock itself is atomic and
  // terminal-guarded, but this last re-read lets the cascade roll back cleanly
  // if the requester closed the request in the microseconds since.
  const stillLive = await dbGetDoc<BloodRequest>("blood_requests", request.id);
  if (!stillLive || TERMINAL_REQUEST_STATUSES.includes(stillLive.status)) {
    await dbDeleteDoc("matches", matchId);
    await releaseDonorLock(next.id, request.id);
    log.warn("Cascade notify gate refused — match rolled back", {
      requestId: request.id,
      donorId: next.id,
      matchId,
    });
    return null;
  }
  const delivery = await notifyDonor(match, request, next);
  // Delivery-time guard: if the request closed (or the match resolved) during
  // the final window, notifyDonor suppressed the invite — roll the cascade back
  // so no actionable invite survives on a closed request.
  if (delivery.suppressed) {
    await dbDeleteDoc("matches", matchId);
    await releaseDonorLock(next.id, request.id);
    log.warn("Cascade delivery suppressed — match rolled back", {
      requestId: request.id,
      donorId: next.id,
      matchId,
    });
    return null;
  }
  return { donorId: next.id, donorName: next.full_name };
}
