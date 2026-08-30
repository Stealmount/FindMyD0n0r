// Matching routes — extracted from server.ts (Phase 3 decomposition, 3.6.5)
// Owns: match approve/decline, public token response, status polling,
//       notification-sent/reminder-sent/timeout/confirm-donation, next-donor
import express, { Router } from "express";
import { randomUUID, randomBytes } from "node:crypto";
import { getCollection as dbGetCollection, getDoc as dbGetDoc, saveDoc as dbSaveDoc } from "../src/lib/serverDb";
import {
  cacheGet,
  cacheSet,
  cacheInvalidatePrefix,
} from "../src/lib/redisCache";
import { getAuthenticatedUser, getLinkedProfile, timingSafeEqualStr } from "../middleware/auth";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { validate } from "../validation";
import { respondPublicSchema } from "../validation/matching";
import { normalizePhone } from "../helpers/phone";
import { nowISO, daysFromNow } from "../helpers/time";
import { reconcileRequestLifecycle } from "../helpers/requestLifecycle";
import { claimUnitSlot, computeApprovedSlots } from "../helpers/capacityClaim";
import {
  sendWhatsApp,
  sendDonorWhatsApp,
  buildDonorConfirmedDetailsMessage,
  buildRequesterConfirmMessage,
  buildDonorDeclineAckMessage,
  buildDonorThankYouMessage,
  buildDonorReferralMessage,
} from "../src/lib/waha";
import { buildRequesterConfirmEmailHTML, buildDonorConfirmedDetailsEmailHTML } from "../src/lib/email";
import { sendEmailViaResend } from "../services/notificationService";
import {
  releaseDonorLock,
  createNextDonorMatch,
  matchAndNotifyRequest,
  findEligibleDonors,
  TERMINAL_REQUEST_STATUSES,
} from "../services/matchingEngine";
import { sendErrorResponse, UnauthorizedError, NotFoundError, ForbiddenError, AppError } from "../helpers/errors";
import type { BloodRequest, Match, User } from "../src/types";

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

// ─── Helper: approve a match by ID ────────────────────────────────────────────
export async function approveMatchById(
  matchId: string,
  timestamp?: string
): Promise<{ ok: boolean; error?: string; status?: number; data?: Record<string, unknown> }> {
  const match = await dbGetDoc<Match>("matches", matchId);
  if (!match) return { ok: false, error: "Match not found", status: 404 };
  if (match.donor_response !== "pending") {
    // Fast-path idempotent retry: this match is already resolved. If it was
    // APPROVED (a prior claim won), the authoritative allocation is committed
    // in the store/ledger, but the request's derived lifecycle counters may be
    // stale if the winner's post-claim persistence failed (e.g. crash between
    // claim and request-doc write). Reconcile the derivation so the retry
    // converges — best-effort (logged, never silent) so an idempotent
    // "Already resolved" is not turned into an error. Declined/expired matches
    // never reconcile, and a terminal request is never touched.
    if (match.donor_response === "approved") {
      try {
        const reqForReconcile = await dbGetDoc<BloodRequest>("blood_requests", match.request_id);
        if (reqForReconcile) {
          await reconcileRequestLifecycle(reqForReconcile.id, reqForReconcile.units_required || 1);
        }
      } catch (e: any) {
        console.warn(`[Matching] Reconcile on already-approved retry failed for ${match.request_id}:`, e?.message);
      }
    }
    return { ok: false, error: "Already resolved", status: 409 };
  }
  const [request, donor] = await Promise.all([
    dbGetDoc<BloodRequest>("blood_requests", match.request_id),
    dbGetDoc<User>("users", match.donor_id),
  ]);
  if (!request || !donor) return { ok: false, error: "Request or donor not found", status: 404 };
  // Phase 6: never let an approval land on a dead request (fast path; the
  // atomic claim re-verifies the live status inside Redis).
  if (TERMINAL_REQUEST_STATUSES.includes(request.status)) {
    return { ok: false, error: "Request no longer active", status: 409 };
  }

  const allRequestMatches = await dbGetCollection<Match>("matches");
  const approvedSlots = computeApprovedSlots(allRequestMatches, match.request_id);

  // THE capacity claim: a Redis Lua script atomically enforces every guard
  // (pending match, non-terminal request, remaining capacity, unique lowest-free
  // slot) and flips the match to approved. Concurrent final-slot approvals
  // cannot both succeed — plain read→calculate→save cannot guarantee that.
  const claim = await claimUnitSlot({
    matchId: match.id,
    requestId: match.request_id,
    unitsRequired: request.units_required || 1,
    approvedSlots,
    timestamp: timestamp || nowISO(),
  });

  if (claim.status === "already_resolved") {
    // The atomic claim was already won (by this same approval or a concurrent
    // one) — the match is `approved` in the authoritative store and holds its
    // slot. This is the idempotent retry path: reconcile the request's derived
    // lifecycle counters so a retry that arrives after a partial persistence
    // failure (claim OK but request-doc write failed) still converges, then
    // report the idempotent conflict. Reconciliation is a best-effort here — a
    // reconcile failure must not turn an idempotent "Already resolved" into an
    // error, but it is logged, never silent.
    if (request) {
      try {
        await reconcileRequestLifecycle(request.id, request.units_required || 1);
      } catch (e: any) {
        console.warn(`[Matching] Reconcile on already-resolved retry failed for ${request.id}:`, e?.message);
      }
    }
    return { ok: false, error: "Already resolved", status: 409 };
  }
  if (claim.status === "terminal" || claim.status === "full") {
    // Failure behaviour: the losing donor is NOT marked approved, claims no
    // unit slot, gets no contact sharing, and no success notifications fire.
    return { ok: false, error: "Request is already full or closed", status: 409 };
  }
  if (claim.status === "not_found") {
    return { ok: false, error: "Match or request not found", status: 404 };
  }
  if (claim.status !== "ok") {
    return { ok: false, error: "Failed to claim request capacity", status: 500 };
  }

  // Phase 2 + post-claim-window hardening: reconcile the request's derived
  // counters from live approved match state (the atomic flip is already
  // persisted and the ledger owns allocation). Routing through the single
  // reconcile helper keeps every approval site deriving identical state and
  // makes a partial persistence failure recoverable via retry.
  await reconcileRequestLifecycle(request.id, request.units_required);
  if (request.requester_phone) {
    await sendWhatsApp(request.requester_phone, buildRequesterConfirmMessage(request, donor.full_name));
  }
  if (request.requester_email) {
    // ponytail: same decoupling rule as notification_status — channel failure
    // must never mutate/fail the match outcome. Upgrade path: enqueueMessage.
    try {
      const ep = buildRequesterConfirmEmailHTML({
        requesterName: request.requester_name,
        donorName: donor.full_name,
        bloodType: request.blood_type_needed,
        trackingCode: request.tracking_code,
        hospitalName: request.hospital_name,
      });
      await sendEmailViaResend(request.requester_email, ep.subject, ep.html, ep.text);
    } catch (e: any) {
      console.warn(`[Matching] Requester confirm email failed for ${request.tracking_code}:`, e?.message);
    }
  }
  if (donor.email) {
    try {
      const ep = buildDonorConfirmedDetailsEmailHTML(request, donor.full_name);
      await sendEmailViaResend(donor.email, ep.subject, ep.html, ep.text);
    } catch (e: any) {
      console.warn(`[Matching] Donor confirmed details email failed for ${request.tracking_code}:`, e?.message);
    }
  }
  await cacheInvalidatePrefix("match_status_");
  await cacheInvalidatePrefix("pending_matches_");
  await cacheInvalidatePrefix("req_status_");
  return { ok: true, data: { success: true } };
}

// ─── Helper: decline a match by ID ───────────────────────────────────────────
export async function declineMatchById(
  matchId: string,
  timestamp?: string
): Promise<{ ok: boolean; error?: string; status?: number }> {
  const match = await dbGetDoc<Match>("matches", matchId);
  if (!match) return { ok: false, error: "Match not found", status: 404 };
  await dbSaveDoc("matches", matchId, {
    ...match,
    donor_response: "declined",
    donor_response_at: timestamp || nowISO(),
  });
  await releaseDonorLock(match.donor_id, match.request_id);
  await cacheInvalidatePrefix("match_status_");
  await cacheInvalidatePrefix("pending_matches_");
  return { ok: true };
}

// ─── POST /api/matches/:matchId/approve ───────────────────────────────────────
router.post("/api/matches/:matchId/approve", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  const profileId = linked?.profile?.id || authUser.id;
  const match = await dbGetDoc<Match>("matches", req.params.matchId);
  if (!match || (match.donor_id !== authUser.id && match.donor_id !== profileId)) return sendErrorResponse(res, new NotFoundError("Match not found or unauthorized"));
  const result = await approveMatchById(req.params.matchId, req.body?.responseTimestamp);
  if (!result.ok) return sendErrorResponse(res, new AppError(result.error || "Failed to approve match", result.status || 500));
  return res.json(result.data);
}));

// ─── POST /api/matches/:matchId/decline ───────────────────────────────────────
router.post("/api/matches/:matchId/decline", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  const profileId = linked?.profile?.id || authUser.id;
  const match = await dbGetDoc<Match>("matches", req.params.matchId);
  if (!match || (match.donor_id !== authUser.id && match.donor_id !== profileId)) return sendErrorResponse(res, new NotFoundError("Match not found or unauthorized"));
  const result = await declineMatchById(req.params.matchId, req.body?.responseTimestamp);
  if (!result.ok) return sendErrorResponse(res, new AppError(result.error || "Failed to decline match", result.status || 500));
  return res.json({ success: true });
}));

// ─── POST /api/notify-match (deprecated 410) ──────────────────────────────────
router.post("/api/notify-match", rateLimitMiddleware(30, 60_000), wrap(async (_req, res) => {
  return sendErrorResponse(res, new AppError("Deprecated. Requests now start matching through POST /api/requests.", 410, "GONE"));
}));

// ─── POST /api/request/match-and-notify (deprecated 410) ─────────────────────
router.post("/api/request/match-and-notify", rateLimitMiddleware(20, 60_000), wrap(async (_req, res) => {
  return sendErrorResponse(res, new AppError("Deprecated. Requests now start matching through POST /api/requests.", 410, "GONE"));
}));

// ─── GET /api/requests/:requestId/status ─────────────────────────────────────
router.get("/api/requests/:requestId/status", wrap(async (req, res) => {
  const cacheKey = `req_status_${req.params.requestId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) { res.setHeader("X-Cache", "HIT"); return res.json(cached); }
  const request = await dbGetDoc<BloodRequest>("blood_requests", req.params.requestId);
  if (!request) return sendErrorResponse(res, new NotFoundError("Request not found"));
  const payload = { status: request.status };
  await cacheSet(cacheKey, payload, 15);
  res.setHeader("X-Cache", "MISS");
  return res.json(payload);
}));

// ─── GET /api/matches/:matchId/status ────────────────────────────────────────
router.get("/api/matches/:matchId/status", wrap(async (req, res) => {
  const cacheKey = `match_status_${req.params.matchId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) { res.setHeader("X-Cache", "HIT"); return res.json(cached); }
  const match = await dbGetDoc<Match>("matches", req.params.matchId);
  if (!match) return sendErrorResponse(res, new NotFoundError("Match not found"));
  const payload = { donor_response: match.donor_response };
  await cacheSet(cacheKey, payload, 15);
  res.setHeader("X-Cache", "MISS");
  return res.json(payload);
}));

// ─── POST /api/matches/:matchId/notification-sent ────────────────────────────
router.post("/api/matches/:matchId/notification-sent", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Authentication required"));
  const linked = await getLinkedProfile(authUser.id);
  const profileId = linked?.profile?.id || authUser.id;
  const match = await dbGetDoc<Match>("matches", req.params.matchId);
  if (!match) return sendErrorResponse(res, new NotFoundError("Match not found"));
  const isAdmin = (authUser as any).role === "admin" || authUser.id === "admin-id";
  if (!isAdmin && match.donor_id !== authUser.id && match.donor_id !== profileId) return sendErrorResponse(res, new ForbiddenError("Not authorized"));
  await dbSaveDoc("matches", req.params.matchId, {
    ...match,
    notification_sent_at: nowISO(),
  });
  return res.json({ success: true });
}));

// ─── POST /api/matches/respond-public ────────────────────────────────────────
router.post("/api/matches/respond-public", rateLimitMiddleware(10, 60_000), validate(respondPublicSchema), wrap(async (req, res) => {
  const { response, token } = req.body;

  const allMatches = await dbGetCollection<Match>("matches");
  let match: Match | null = null;
  for (const m of allMatches) {
    if (m.public_token && timingSafeEqualStr(token, m.public_token)) {
      match = m;
      break;
    }
  }

  if (!match) return sendErrorResponse(res, new ForbiddenError("Invalid or expired capability token"));
  if (match.donor_response !== "pending")
    return sendErrorResponse(res, new AppError("Already resolved", 409, "ALREADY_RESOLVED"));

  const result = response === "approved"
    ? await approveMatchById(match.id)
    : await declineMatchById(match.id);
  if (!result.ok) return sendErrorResponse(res, new AppError(result.error || "Failed to respond", result.status || 500));
  return res.json({ ok: true });
}));

// ─── POST /api/matches/:matchId/reminder-sent ────────────────────────────────
router.post("/api/matches/:matchId/reminder-sent", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Authentication required"));
  const linked = await getLinkedProfile(authUser.id);
  const profileId = linked?.profile?.id || authUser.id;
  const match = await dbGetDoc<Match>("matches", req.params.matchId);
  if (!match) return sendErrorResponse(res, new NotFoundError("Match not found"));
  const isAdmin = (authUser as any).role === "admin" || authUser.id === "admin-id";
  if (!isAdmin && match.donor_id !== authUser.id && match.donor_id !== profileId) return sendErrorResponse(res, new ForbiddenError("Not authorized"));
  await dbSaveDoc("matches", req.params.matchId, {
    ...match,
    reminder_sent_at: req.body?.sentAt || nowISO(),
  });
  return res.json({ success: true });
}));

// ─── POST /api/matches/:matchId/timeout ──────────────────────────────────────
router.post("/api/matches/:matchId/timeout", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Authentication required"));
  const linked = await getLinkedProfile(authUser.id);
  const profileId = linked?.profile?.id || authUser.id;
  const match = await dbGetDoc<Match>("matches", req.params.matchId);
  if (!match) return sendErrorResponse(res, new NotFoundError("Match not found"));
  const isAdmin = (authUser as any).role === "admin" || authUser.id === "admin-id";
  if (!isAdmin && match.donor_id !== authUser.id && match.donor_id !== profileId) return sendErrorResponse(res, new ForbiddenError("Not authorized"));
  await dbSaveDoc("matches", req.params.matchId, {
    ...match,
    donor_response: "timed_out",
    donor_response_at: req.body?.timedOutAt || nowISO(),
  });
  return res.json({ success: true });
}));

// ─── POST /api/matches/:matchId/confirm-donation ─────────────────────────────
router.post("/api/matches/:matchId/confirm-donation", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Authentication required"));
  const linked = await getLinkedProfile(authUser.id);
  const profileId = linked?.profile?.id || authUser.id;
  const match = await dbGetDoc<Match>("matches", req.params.matchId);
  if (!match) return sendErrorResponse(res, new NotFoundError("Match not found"));
  const donor = await dbGetDoc<User>("users", match.donor_id);
  if (!donor) return sendErrorResponse(res, new NotFoundError("Donor not found"));

  const isAdmin = (authUser as any).role === "admin" || authUser.id === "admin-id";
  if (!isAdmin && match.donor_id !== authUser.id && match.donor_id !== profileId) return sendErrorResponse(res, new ForbiddenError("Not authorized"));

  const confirmedAt  = req.body?.confirmedAt || nowISO();
  const donationDate = confirmedAt.split("T")[0];
  const cooldownEnd  = daysFromNow(90);
  const request = await dbGetDoc<BloodRequest>("blood_requests", match.request_id);

  await Promise.all([
    dbSaveDoc("matches", req.params.matchId, {
      ...match,
      outcome: "donated",
      outcome_confirmed_at: confirmedAt,
    }),
    dbSaveDoc("donation_log", `donation_${req.params.matchId}`, {
      id:            `donation_${req.params.matchId}`,
      donor_id:      donor.id,
      match_id:      match.id,
      request_id:    match.request_id,
      donation_date: donationDate,
      source:        "platform_match",
      notes:         "Confirmed via platform",
      created_at:    nowISO(),
    }),
    dbSaveDoc("users", donor.id, {
      ...donor,
      cooldown_until: cooldownEnd,
      account_status: "cooldown",
      updated_at:     nowISO(),
    }),
  ]);

  await sendDonorWhatsApp(
    donor,
    // ponytail fix: was passing match.request_id (internal UUID) where the
    // template renders a human-facing ticket code — live copy bug.
    buildDonorThankYouMessage(donor, request?.tracking_code || match.request_id, cooldownEnd)
  );
  await sendDonorWhatsApp(
    donor,
    buildDonorReferralMessage(donor.full_name)
  );

  await cacheInvalidatePrefix("match_status_");
  await cacheInvalidatePrefix("pending_matches_");
  await cacheInvalidatePrefix("req_status_");
  await cacheInvalidatePrefix("eligible_");

  return res.json({ success: true });
}));

// ─── POST /api/matches/:matchId/donation-not-completed ───────────────────────
router.post("/api/matches/:matchId/donation-not-completed", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Authentication required"));
  const match = await dbGetDoc<Match>("matches", req.params.matchId);
  if (!match) return sendErrorResponse(res, new NotFoundError("Match not found"));
  await dbSaveDoc("matches", req.params.matchId, {
    ...match,
    outcome: "not_donated",
    outcome_confirmed_at: nowISO(),
  });
  await cacheInvalidatePrefix("match_status_");
  await cacheInvalidatePrefix("pending_matches_");
  return res.json({ success: true });
}));

// ─── POST /api/requests/:requestId/next-donor ────────────────────────────────
router.post("/api/requests/:requestId/next-donor", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Authentication required"));
  const request = await dbGetDoc<BloodRequest>("blood_requests", req.params.requestId);
  if (!request) return sendErrorResponse(res, new NotFoundError("Request not found"));
  const result = await createNextDonorMatch(request, req.body?.declinedMatchId || req.body?.timedOutMatchId);
  return res.json({ success: !!result, match: result || null });
}));

export default router;
