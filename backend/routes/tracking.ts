// Tracking routes — extracted from server.ts (Phase 3 decomposition, 3.6.6)
// Owns: SOS request creation, public tracking lookup, requester cancel/reopen/fulfill/broadcast-toggle
import express, { Router } from "express";
import { randomUUID, randomBytes } from "node:crypto";
import { getCollection as dbGetCollection, getDoc as dbGetDoc, saveDoc as dbSaveDoc } from "../src/lib/serverDb";
import { cacheInvalidatePrefix, cacheSetNX, cacheDel } from "../src/lib/redisCache";
import { getAuthenticatedUser, getLinkedProfile, consumeOtpTicket } from "../middleware/auth";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { normalizePhone, isValidIndianPhone } from "../helpers/phone";
import { nowISO } from "../helpers/time";
import { matchAndNotifyRequest, releaseDonorLock, TERMINAL_REQUEST_STATUSES } from "../services/matchingEngine";
import { sendErrorResponse, UnauthorizedError, NotFoundError, ForbiddenError, ValidationError, AppError } from "../helpers/errors";
import { sendDonorWhatsApp } from "../src/lib/waha";
import { buildRequestCancelledDonorNotice } from "../services/notificationService";
import { MAX_UNITS_PER_REQUEST } from "../src/types";
import type { BloodRequest, Match, User } from "../src/types";
import { recomputeUnitsConfirmed } from "../helpers/requestLifecycle";
import { log } from "../helpers/logger";


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

// ─── Helper: log a request lifecycle event ────────────────────────────────────
async function logRequestEvent(requestId: string, event: string, actor: string = "system") {
  try {
    const id = randomUUID();
    const record = { id, request_id: requestId, event, actor, at: nowISO() };
    await dbSaveDoc("request_events", id, record as unknown as Record<string, unknown>);
  } catch (e: any) {
    console.error(`[Audit] Failed to log event for ${requestId}:`, e.message);
  }
}

// ─── Helper: verify requester via auth session or SOS OTP ticket ─────────────
// Phase 8: the requester-read surfaces (dashboard GET /api/requester/requests)
// resolve identity generously (authUid, linked profile id, verified phone), but
// the closing mutations used a strict authUid/email match. Requests store the
// *profile* id as requester_id (resolveRequester in requester.ts), so a user
// whose auth UID maps to a different profile via auth_profile_links (Google
// complete-verification, accountSettings link-google) — and any phone signup
// whose email is null — got 403 on cancel/fulfill/reopen even though they own
// the request. Authorize against the same identity chain used at creation.
const checkRequesterAuth = async (req: express.Request, request: BloodRequest) => {
  const authUser = await getAuthenticatedUser(req);
  if (authUser) {
    if (authUser.id && authUser.id === request.requester_id) return true;
    if (
      authUser.email && request.requester_email &&
      authUser.email.toLowerCase().trim() === request.requester_email.toLowerCase().trim()
    ) {
      return true;
    }
    // Profile-linked owner: request.requester_id is a profile id the auth UID
    // is bound to via auth_profile_links. Non-fatal if resolution fails.
    try {
      const linked = await getLinkedProfile(authUser.id);
      if (request.requester_id && linked?.profile?.id === request.requester_id) return true;
    } catch {
      /* fall through to OTP ticket validation */
    }
  }
  const { verificationToken } = req.body || {};
  if (verificationToken && request.requester_phone) {
    const normalizedPhone = normalizePhone(request.requester_phone);
    if (await consumeOtpTicket(String(verificationToken), normalizedPhone, "sos")) return true;
  }
  return false;
};

// ─── POST /api/sos/requests — unauthenticated SOS flow ─────────────────────────
router.post("/api/sos/requests", rateLimitMiddleware(10, 60_000), wrap(async (req, res) => {
  const body = req.body || {};
  const { verificationToken, requester_name, requester_phone } = body;
  if (!verificationToken || !String(requester_name || "").trim() || !String(requester_phone || "").trim()) {
    return sendErrorResponse(res, new ValidationError("Provide a verified SOS ticket, your name, and your WhatsApp number."));
  }
  const normalizedContact = normalizePhone(String(requester_phone));
  if (!isValidIndianPhone(normalizedContact)) {
    return sendErrorResponse(res, new ValidationError("Enter a valid Indian mobile number."));
  }
  if (!await consumeOtpTicket(String(verificationToken), normalizedContact, "sos")) {
    return sendErrorResponse(res, new ForbiddenError("WhatsApp verification expired. Request a new OTP."));
  }
  const bloodGroups = new Set(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]);
  const units = Number(body.units_required);
  if (!body.patient_name || !bloodGroups.has(body.blood_type_needed) || !Number.isInteger(units) || units < 1 || units > MAX_UNITS_PER_REQUEST ||
    !body.hospital_name || !/^\d{6}$/.test(String(body.hospital_pincode)) || !body.hospital_area || !body.hospital_city) {
    return sendErrorResponse(res, new ValidationError("Complete the patient, exact blood group, units (1-5), and hospital location fields."));
  }
  if (body.component_needed && !["Whole Blood (WB)", "Packed Red Blood Cells (PRBC)"].includes(body.component_needed)) {
    return sendErrorResponse(res, new ValidationError("Component-specific matching requires blood-bank review. Use whole blood or PRBC for this pilot."));
  }

  const id = randomUUID();
  const now = nowISO();
  const request: BloodRequest = {
    id,
    tracking_code: `BLD-${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`,
    patient_name: String(body.patient_name).trim(),
    patient_age: body.patient_age ? Number(body.patient_age) : undefined,
    patient_gender: body.patient_gender,
    blood_type_needed: body.blood_type_needed,
    component_needed: body.component_needed,
    units_required: units,
    hospital_name: String(body.hospital_name).trim(),
    hospital_uhid: body.hospital_uhid,
    attending_doctor: body.attending_doctor,
    hospital_pincode: String(body.hospital_pincode),
    hospital_area: String(body.hospital_area).trim(),
    hospital_city: String(body.hospital_city).trim(),
    hospital_state: body.hospital_state,
    urgency_level: body.urgency_level || "critical",
    requester_id: `sos:${normalizedContact}`,
    requester_name: String(requester_name).trim(),
    requester_email: "",
    requester_phone: normalizedContact,
    additional_notes: body.additional_notes || "",
    status: "broadcasting",
    showcase_opt_in: Boolean(body.showcase_opt_in),
    share_contact_immediately: Boolean(body.share_contact_immediately),
    expires_at: body.expires_at || new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    fulfilled_at: null,
    created_at: now,
  };
  await dbSaveDoc("blood_requests", id, request as unknown as Record<string, unknown>);

  let matched = 0;
  try {
    const result = await matchAndNotifyRequest(request);
    matched = result.matched;
  } catch (matchErr: any) {
    console.error("[SOS Matching] failed for", id, ":", matchErr.message);
  }
  return res.status(201).json({
    requestId: id,
    trackingCode: request.tracking_code,
    status: "broadcasting",
    matched,
    verifiedContact: normalizedContact,
  });
}));

// ─── GET /api/requests/public/:id — safe public request detail ─────────────
router.get("/api/requests/public/:id", wrap(async (req, res) => {
  const r = await dbGetDoc<BloodRequest>("blood_requests", req.params.id);
  if (!r) return sendErrorResponse(res, new NotFoundError("Request not found."));

  const safePublic: Record<string, unknown> = {
    id: r.id,
    code: r.tracking_code,
    blood_group: r.blood_type_needed,
    units_needed: r.units_required,
    patient_age: r.patient_age ?? null,
    urgency: r.urgency_level,
    status: r.status,
    hospital_pincode: r.hospital_pincode,
    hospital_city: r.hospital_city,
    created_at: r.created_at,
  };

  // Authenticated users get slightly more detail
  const authUser = await getAuthenticatedUser(req);
  if (authUser) {
    safePublic.hospital_name = r.hospital_name;
    // Partial address: area only, never the full street/landmark
    safePublic.hospital_area = r.hospital_area;
  }

  return res.json({ request: safePublic });
}));

// ─── GET /api/requests/:trackingCode — public tracking lookup ────────────────
router.get("/api/requests/:trackingCode", wrap(async (req, res) => {
  const all = await dbGetCollection<BloodRequest>("blood_requests");
  const request = all.find(r => r.tracking_code.toUpperCase() === req.params.trackingCode.toUpperCase().trim() || r.id === req.params.trackingCode);
  if (!request) return sendErrorResponse(res, new NotFoundError("No active blood request found with this tracking code. Please verify the code and try again."));
  const allMatches = await dbGetCollection<Match>("matches");
  const rawMatches = allMatches.filter(m => m.request_id === request.id);
  const allDonors = await dbGetCollection<User>("users");

  // Privacy gate (§5): PII (donor name/phone, requester contact, patient details)
  // is only returned to the authenticated linked requester or an admin.
  const authUser = await getAuthenticatedUser(req);
  const isAdmin = authUser ? (authUser as { role?: string }).role === "admin" || authUser.id === "admin-id" : false;
  const isRequester = authUser ? (authUser.id === request.requester_id || authUser.email === request.requester_email) : false;
  const canSeePII = isAdmin || isRequester;

  for (const m of rawMatches) {
    if (!m.public_token) {
      m.public_token = randomBytes(16).toString("hex");
      await dbSaveDoc("matches", m.id, { ...m });
    }
  }

  const matches = rawMatches.map(m => {
    const d = allDonors.find(u => u.id === m.donor_id);
    return {
      matchToken:           m.public_token,
      blood_type:           d?.blood_type,
      area:                 d?.area,
      city:                 d?.city,
      distance_km:          m.distance_km,
      status:               m.donor_response,
      unit_slot:            m.unit_slot ?? null,
      // Approved donor contact is sensitive — only the linked requester/admin
      // may see a donor's name/phone from a public tracking lookup.
      ...(canSeePII && m.donor_response === "approved" ? {
        donor_name:  d?.full_name,
        donor_phone: d?.whatsapp_number || d?.phone,
      } : {}),
    };
  });

  const safeRequest: Record<string, unknown> = { ...request };
  if (!canSeePII) {
    delete safeRequest.requester_name;
    delete safeRequest.requester_email;
    delete safeRequest.requester_phone;
    delete safeRequest.requester_id;
    delete safeRequest.patient_name;
    delete safeRequest.patient_age;
    delete safeRequest.patient_gender;
  }
  return res.json({ request: safeRequest, matches });
}));

// ─── PATCH /api/requests/:trackingCode/cancel ──────────────────────────────

// ─── Helper: retire dangling pending invitations + release their locks ───────
// Used by cancelRequest and by the fulfilled branch of fulfillRequest so a
// closed search never keeps live invite cards in the donor dashboard and never
// holds a donor lock for a request that can no longer match.
//
// Phase 8 hardening: every allSettled outcome is inspected. A failed retire is
// logged with request/match/donor identifiers and audited as a
// close_cleanup_partial_failure event — it must never be silent.
export interface RetireInvitesReport { attempted: number; failed: number; }

async function logCleanupFailureEvent(requestId: string, detail: Record<string, unknown>) {
  try {
    const id = randomUUID();
    await dbSaveDoc("request_events", id, {
      id,
      request_id: requestId,
      event: "close_cleanup_partial_failure",
      actor: "system",
      detail,
      at: nowISO(),
    } as unknown as Record<string, unknown>);
  } catch (e: any) {
    console.error(`[Audit] Failed to log cleanup-failure event for ${requestId}:`, e.message);
  }
}

// Test-only fault injection seam (production-safe): when NODE_ENV=test /
// TEST_MODE=1 and TEST_FAULT_RETIRE lists a match id (or '*'), retiring that
// invite throws before persisting — letting regression tests prove a failed
// cleanup step is recorded and does not silently vanish, and that re-running
// the close converges. Never consulted outside test builds.
function isRetireFaultInjected(matchId: string): boolean {
  if (process.env.NODE_ENV !== "test" && process.env.TEST_MODE !== "1") return false;
  const targets = process.env.TEST_FAULT_RETIRE;
  if (!targets) return false;
  return targets === "*" || targets.split(",").includes(matchId);
}

export async function retireOpenInvites(request: BloodRequest): Promise<RetireInvitesReport> {
  const allMatches = await dbGetCollection<Match>("matches");
  const pendingMatches = allMatches.filter((m) => m.request_id === request.id && m.donor_response === "pending");
  const results = await Promise.allSettled(
    pendingMatches.map(async (m) => {
      if (isRetireFaultInjected(m.id)) {
        throw new Error(`[test] injected retire fault (${m.id})`);
      }
      await dbSaveDoc("matches", m.id, { ...m, donor_response: "timed_out", donor_response_at: nowISO() });
      await releaseDonorLock(m.donor_id, m.request_id);
    })
  );
  let failed = 0;
  results.forEach((r, i) => {
    if (r.status !== "rejected") return;
    failed++;
    const reason = (r as PromiseRejectedResult).reason;
    log.error("Close-lifecycle: retire pending invite FAILED", {
      requestId: request.id,
      trackingCode: request.tracking_code,
      matchId: pendingMatches[i]?.id,
      donorId: pendingMatches[i]?.donor_id,
      err: (reason as Error)?.message ?? String(reason),
    });
  });
  return { attempted: pendingMatches.length, failed };
}

// ─── Helper: courtesy-notify approved donors of a cancelled search ───────────
// Every allSettled outcome inspected; channel failures are logged (warn) with
// identifiers — never silent, never fatal to the close itself.
export async function notifyApprovedDonorsCancelled(request: BloodRequest): Promise<RetireInvitesReport> {
  const allMatches = await dbGetCollection<Match>("matches");
  const approved = allMatches.filter((m) => m.request_id === request.id && m.donor_response === "approved");
  const results = await Promise.allSettled(
    approved.map(async (m) => {
      const donor = await dbGetDoc<User>("users", m.donor_id);
      if (!donor) return;
      await sendDonorWhatsApp(donor, buildRequestCancelledDonorNotice(request.tracking_code));
    })
  );
  let failed = 0;
  results.forEach((r, i) => {
    if (r.status !== "rejected") return;
    failed++;
    const reason = (r as PromiseRejectedResult).reason;
    log.warn("Close-lifecycle: approved-donor courtesy notify FAILED", {
      requestId: request.id,
      trackingCode: request.tracking_code,
      matchId: approved[i]?.id,
      donorId: approved[i]?.donor_id,
      err: (reason as Error)?.message ?? String(reason),
    });
  });
  return { attempted: approved.length, failed };
}

// ─── Helper: invalidate every status/matching cache touched by a request ─────
async function invalidateRequestRelatedCaches() {
  await Promise.all([
    cacheInvalidatePrefix("req_status_"),
    cacheInvalidatePrefix("match_status_"),
    cacheInvalidatePrefix("pending_matches_"),
    cacheInvalidatePrefix("eligible_"),
  ]);
}

/**
 * Persist a cancellation and fan out: free reserved donors, retire dangling
 * pending invites, courtesy-notify donors who already accepted (Phase 6).
 * Every cleanup outcome is inspected and failures are audited (never silent).
 * Exported for direct testing; callers own auth + terminal-state guarding.
 */
export async function cancelRequest(request: BloodRequest): Promise<BloodRequest> {
  const updated = { ...request, status: "cancelled" as const, updated_at: nowISO() };
  await dbSaveDoc("blood_requests", request.id, updated);

  const retire = await retireOpenInvites(request);
  const notify = await notifyApprovedDonorsCancelled(request);

  if (retire.failed > 0 || notify.failed > 0) {
    log.warn("Close-lifecycle: cleanup partial failure", {
      requestId: request.id,
      trackingCode: request.tracking_code,
      pendingRetired: retire.attempted - retire.failed,
      pendingFailed: retire.failed,
      approvedNotified: notify.attempted - notify.failed,
      approvedNotifyFailed: notify.failed,
    });
    await logCleanupFailureEvent(request.id, {
      pendingAttempted: retire.attempted,
      pendingFailed: retire.failed,
      approvedAttempted: notify.attempted,
      approvedNotifyFailed: notify.failed,
    });
  }
  await invalidateRequestRelatedCaches();
  await logRequestEvent(request.id, "cancelled", request.requester_id).catch(() => {});
  return updated;
}

// ─── Idempotent close (Phase 8 hardening) ─────────────────────────────────────
// Closing is a transition + fan-out with side effects (retire, lock release,
// notifications, audit events). Repeated or concurrent closes must CONVERGE on
// the current terminal state without duplicating any of those side effects:
//   1. Already terminal → immediate success replay (fast, heavyweight path
//      skipped; the duplicate is invisible to outcome, events, and notifications).
//   2. Otherwise only ONE caller runs the transition — an NX close-claim
//      serializes racing closes; the loser polls until the winner's terminal
//      write lands (bounded), then replays it idempotently.
//   3. The claim TTL bounds the crash window: after the TTL, a retry simply
//      claims and finishes the close — every close operation is idempotent.
const CLOSE_CLAIM_TTL_S = 60;
const CLOSE_CLAIM_POLL_MS = 120;
const CLOSE_CLAIM_MAX_ROUNDS = 30;

async function closeRequestIdempotently(
  request: BloodRequest,
  closeFn: (r: BloodRequest) => Promise<BloodRequest>
): Promise<{ request: BloodRequest; idempotent: boolean }> {
  // Fast idempotent path: already terminal → replay the current state. Callers
  // have ALREADY authorized (checkRequesterAuth runs before this helper), so a
  // repeated close never turns into an error on retry.
  const liveNow = await dbGetDoc<BloodRequest>("blood_requests", request.id);
  const current = liveNow ?? request;
  if (TERMINAL_REQUEST_STATUSES.includes(current.status)) {
    return { request: current, idempotent: true };
  }

  const claimKey = `close_x_${request.id}`;
  for (let round = 0; round < CLOSE_CLAIM_MAX_ROUNDS; round++) {
    const claimed = await cacheSetNX(claimKey, "1", CLOSE_CLAIM_TTL_S);
    if (claimed) {
      try {
        const afterClaim = await dbGetDoc<BloodRequest>("blood_requests", request.id);
        const base = afterClaim ?? request;
        if (TERMINAL_REQUEST_STATUSES.includes(base.status)) {
          return { request: base, idempotent: true };
        }
        const updated = await closeFn(base);
        return { request: updated, idempotent: false };
      } finally {
        await cacheDel(claimKey).catch(() => {});
      }
    }
    // Another closer holds the claim — wait for its terminal write to land so
    // concurrent closes converge on one coherent result and one fan-out.
    await new Promise((resolve) => setTimeout(resolve, CLOSE_CLAIM_POLL_MS));
    const nowLive = await dbGetDoc<BloodRequest>("blood_requests", request.id);
    if (nowLive && TERMINAL_REQUEST_STATUSES.includes(nowLive.status)) {
      return { request: nowLive, idempotent: true };
    }
  }
  throw new AppError("Request close is already in progress. Please retry shortly.", 409, "CLOSE_IN_PROGRESS");
}

router.patch("/api/requests/:trackingCode/cancel", wrap(async (req, res) => {
  const allRequests = await dbGetCollection<BloodRequest>("blood_requests");
  const request = allRequests.find(r => r.tracking_code === req.params.trackingCode || r.id === req.params.trackingCode);
  if (!request) return sendErrorResponse(res, new NotFoundError("Request not found"));
  if (!await checkRequesterAuth(req, request)) return sendErrorResponse(res, new ForbiddenError("Unauthorized"));
  // Phase 8: cancel is idempotent — an authorized retry on an already-closed
  // request replays the current terminal state (200) instead of erroring, and
  // concurrent closes converge on ONE transition + fan-out.
  const { request: updated, idempotent } = await closeRequestIdempotently(request, cancelRequest);
  return res.json({ success: true, request: updated, idempotent });
}));

// ─── PATCH /api/requests/:trackingCode/reopen ────────────────────────────────

/**
 * Reopen a cancelled request. Approved allocations are retained through
 * cancel/reopen (cancel only retires pending invites, never approved rows), so
 * units_confirmed is recomputed from live approved matches and the retained
 * unit_slots keep the capslot ledger coherent — a fresh wave of donors is
 * searched only for the still-open units (search_batch reset to 0 = round 1).
 * Exported for direct testing; callers own auth + status guarding.
 */
export async function reopenRequest(request: BloodRequest): Promise<BloodRequest> {
  // Phase 3: reopen must not inherit stale counters or search rounds — recompute
  // units_confirmed from live approved matches and reset search_batch so a fresh
  // wave of donors can be searched for the still-open units.
  const lifecycle = await recomputeUnitsConfirmed(request.id, request.units_required);
  const updated = {
    ...request,
    status: "open" as const,
    units_confirmed: lifecycle.units_confirmed,
    search_batch: 0,
    updated_at: nowISO(),
  };
  await dbSaveDoc("blood_requests", request.id, updated);
  await cacheInvalidatePrefix("req_status_");
  logRequestEvent(request.id, "reopened", request.requester_id).catch(() => {});
  return updated;
}

router.patch("/api/requests/:trackingCode/reopen", wrap(async (req, res) => {
  const allRequests = await dbGetCollection<BloodRequest>("blood_requests");
  const request = allRequests.find(r => r.tracking_code === req.params.trackingCode || r.id === req.params.trackingCode);
  if (!request) return sendErrorResponse(res, new NotFoundError("Request not found"));
  if (!await checkRequesterAuth(req, request)) return sendErrorResponse(res, new ForbiddenError("Unauthorized"));
  // Phase 6: reopen is only meaningful for cancelled requests.
  if (request.status !== "cancelled") {
    return sendErrorResponse(res, new AppError("Only cancelled requests can be reopened.", 409, "INVALID_STATUS"));
  }
  const updated = await reopenRequest(request);
  return res.json({ success: true, request: updated });
}));

// ─── PATCH /api/requests/:trackingCode/fulfill ───────────────────────────────

/**
 * Manual fulfilment sign-off (explicit requester override, Phase 6). The only
 * way a request may enter the 'fulfilled' lifecycle state is when the
 * authoritative approved count reaches units_required — the state never lies
 * about allocation. An under-filled manual close uses the established cancel
 * domain flow (frees reservations, retires pending invites, courtesy-notifies
 * approved donors) so "close the search early" stays truthful and reopenable.
 * Either way the search is closed: pending invitations are retired and donor
 * locks released, so no live invite card survives in the donor dashboard and no
 * late responder can be offered an already-closed request.
 * Exported for direct testing; callers own auth + terminal-state guarding.
 */
export async function fulfillRequest(request: BloodRequest): Promise<BloodRequest> {
  // Phase 5: stamp the counter if approvals never wrote it (manual fulfill).
  // Phase 2: routed through the same lifecycle helper so the fulfilled
  // transition and units_confirmed agree with every other approval site.
  const lifecycle = await recomputeUnitsConfirmed(request.id, request.units_required);
  if (lifecycle.status === "fulfilled") {
    const updated = {
      ...request,
      status: "fulfilled" as const,
      fulfilled_at: nowISO(),
      units_confirmed: lifecycle.units_confirmed,
      updated_at: nowISO(),
    };
    await dbSaveDoc("blood_requests", request.id, updated);
    // Phase 8: a fulfilled search is closed too — retire leftover pending
    // invites, release their locks, and invalidate all related caches (not
    // just req_status_) so donors stop seeing the request on any refresh.
    // Cleanup outcomes are inspected; a partial failure is audited (never
    // silent) and never mutates the fulfilled terminal state.
    const retire = await retireOpenInvites(request);
    if (retire.failed > 0) {
      log.warn("Close-lifecycle: cleanup partial failure after fulfilled close", {
        requestId: request.id,
        trackingCode: request.tracking_code,
        pendingRetired: retire.attempted - retire.failed,
        pendingFailed: retire.failed,
      });
      await logCleanupFailureEvent(request.id, {
        pendingAttempted: retire.attempted,
        pendingFailed: retire.failed,
      });
    }
    await invalidateRequestRelatedCaches();
    logRequestEvent(request.id, "fulfilled", request.requester_id).catch(() => {});
    return updated;
  }
  // Under-filled manual close: reuse the established cancel domain flow —
  // never stamp 'fulfilled' on a request whose allocation is incomplete.
  await cancelRequest(request);
  const updated = {
    ...request,
    status: "cancelled" as const,
    fulfilled_at: null,
    units_confirmed: lifecycle.units_confirmed,
    updated_at: nowISO(),
  };
  await dbSaveDoc("blood_requests", request.id, updated);
  return updated;
}

router.patch("/api/requests/:trackingCode/fulfill", wrap(async (req, res) => {
  const all = await dbGetCollection<BloodRequest>("blood_requests");
  const r = all.find(x => x.tracking_code === req.params.trackingCode || x.id === req.params.trackingCode);
  if (!r) return sendErrorResponse(res, new NotFoundError("Request not found"));
  if (!await checkRequesterAuth(req, r)) return sendErrorResponse(res, new ForbiddenError("Unauthorized"));
  // Phase 8: fulfil is idempotent for the authorized owner — a retry after a
  // successful close replays the current terminal state (200) instead of
  // "Failed to fulfill request", and concurrent fulfils converge on ONE
  // transition + fan-out (no duplicate cleanup / events / notifications).
  const { request: updated, idempotent } = await closeRequestIdempotently(r, fulfillRequest);
  return res.json({ success: true, request: updated, idempotent });
}));

// ─── PATCH /api/requests/:trackingCode/broadcast-toggle ──────────────────────
router.patch("/api/requests/:trackingCode/broadcast-toggle", wrap(async (req, res) => {
  const all = await dbGetCollection<BloodRequest>("blood_requests");
  const r = all.find(x => x.tracking_code === req.params.trackingCode || x.id === req.params.trackingCode);
  if (!r) return sendErrorResponse(res, new NotFoundError("Request not found"));
  if (!await checkRequesterAuth(req, r)) return sendErrorResponse(res, new ForbiddenError("Unauthorized"));
  await dbSaveDoc("blood_requests", r.id, { ...r, broadcast_to_simulator: !r.broadcast_to_simulator });
  return res.json({ success: true });
}));

export default router;
