// Requester routes — extracted from server.ts (Phase 3 decomposition, 3.6.4)
import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import { getCollection as dbGetCollection, getDoc as dbGetDoc, saveDoc as dbSaveDoc } from "../src/lib/serverDb";
import { zrangeByScore as storeZrangeByScore, mgetDocs as storeMget } from "../src/lib/store";
import { cacheSetNX, cacheGet, cacheSet } from "../src/lib/redisCache";
import { getAuthenticatedUser, getLinkedProfile, consumeOtpTicket } from "../middleware/auth";
import rateLimitMiddleware, { checkRateLimit } from "../middleware/rateLimiter";
import { normalizePhone, isValidIndianPhone } from "../helpers/phone";
import { nowISO } from "../helpers/time";
import { matchAndNotifyRequest } from "../services/matchingEngine";
import { validate } from "../validation";
import { bloodRequestSchema } from "../validation/requests";
import { sendErrorResponse, UnauthorizedError, NotFoundError, ForbiddenError, ValidationError, AppError, ServiceUnavailableError } from "../helpers/errors";
import type { BloodRequest, Match, Requester, User } from "../src/types";


const router = Router();

// Express 4 does not forward rejected async handlers to its error middleware.
// Wrap routes once so a provider outage returns a response instead of taking down Node.
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

// ─── Helper: resolve requester identity from auth + profile/legacy tables ─────
async function resolveRequester(
  authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  body?: Record<string, unknown>
): Promise<Requester | null> {
  // 1. Try the new profiles table — the ONLY requester-capable gate is
  //    `can_request`. Donor and Requester are fixed, mutually exclusive roles:
  //    a pure donor profile (can_donate without can_request) is hard-rejected,
  //    never synthesized into a requester.
  try {
    const linked = await getLinkedProfile(authUser.id);
    if (linked?.profile) {
      if (linked.profile.can_request) {
        // Phone is overridden with the form-supplied phone when present so
        // notifications for THIS request go to the contact number the requester
        // typed in the form. Known accepted tradeoff: a signed-in request-capable
        // user can direct the WA ack to any phone they type (family member on
        // behalf) and is rate-limited per phone below.
        const formPhone = body?.requester_phone ? normalizePhone(String(body.requester_phone)) : null;
        const contactPhone = formPhone || linked.profile.phone;
        return {
          id: linked.profile.id,
          full_name: linked.profile.full_name,
          email: linked.profile.email || authUser.email || "",
          phone: contactPhone,
          whatsapp_number: contactPhone || linked.profile.whatsapp_phone,
          created_at: linked.profile.consent_accepted_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      if (linked.profile.can_donate) {
        throw new ForbiddenError("Donor accounts cannot create blood requests. Sign in with a Requester account to request blood.");
      }
    }
  } catch (e) {
    if (e instanceof ForbiddenError) throw e;
    console.warn("[Requester] Profile lookup failed:", e);
  }

  // 2. Fall back to a legacy requesters collection row (pre-migration accounts).
  const fromLegacy = await dbGetDoc<Requester>("requesters", authUser.id);
  if (fromLegacy) return fromLegacy;

  // 3. A legacy donor `users` row must never become a requester. Donor and
  //    Requester are mutually exclusive — this is the hard role boundary.
  const donorDoc = await dbGetDoc<User>("users", authUser.id);
  if (donorDoc) {
    throw new ForbiddenError("Donor accounts cannot create blood requests. Sign in with a Requester account to request blood.");
  }

  // 4. On-behalf path: a signed-in user with no profile/donor/requester row may
  //    still submit with a valid body phone (family member submitting on behalf).
  if (body && isValidIndianPhone(normalizePhone(String(body.requester_phone || "")))) {
    const now = nowISO();
    const email = body.requester_email as string | undefined;
    const req: Requester = {
      id: authUser.id,
      full_name: String(body.requester_name || (authUser.user_metadata?.full_name as string) || "Requester").trim(),
      email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
        ? String(email).trim().toLowerCase()
        : authUser.email || "",
      phone: normalizePhone(String(body.requester_phone)),
      whatsapp_number: normalizePhone(String(body.requester_phone)),
      created_at: now,
      updated_at: now,
    };
    await dbSaveDoc("requesters", req.id, req as unknown as Record<string, unknown>);
    return req;
  }

  return null;
}

// ─── Legacy requester creation (disabled) ─────────────────────────────────────
// Profiles are created by the API only after both Auth and WhatsApp OTP succeed.
router.post("/api/profiles/requester", rateLimitMiddleware(10, 60_000), wrap(async (_req, res) => {
  // DISABLED: Legacy OTP-gated requester creation. Use /api/auth/phone-signup.
  return res.status(410).json({ error: "Legacy requester signup is disabled. Use the new auth flow." });
}));

// ─── Create blood request ──────────────────────────────────────────────────────
router.post("/api/requests", rateLimitMiddleware(10, 60_000), validate(bloodRequestSchema), wrap(async (req, res) => {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });

    const requester = await resolveRequester(authUser, req.body || {});
    if (!requester) return res.status(403).json({ error: "Sign in and ensure your profile has a phone number to create a blood request." });

    // Per-phone rate limit — max 3 broadcast requests per phone number per hour.
    // Prevents the form-phone override (family-member use case) from being abused
    // to spam arbitrary numbers with WhatsApp acknowledgement messages.
    if (requester.phone) {
      const phoneKey = `rl:phone:${normalizePhone(requester.phone)}`;
      if (!(await checkRateLimit(phoneKey, 3, 60 * 60_000))) {
        return res.status(429).json({ error: "Too many requests from this phone number. Please wait before submitting again." });
      }
    }

    // Feature 1: Idempotency — prevent double-taps from creating duplicate requests
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    if (idempotencyKey) {
      const acquired = await cacheSetNX(`idem_${idempotencyKey}`, "1", 60);
      if (!acquired) {
        // ponytail: poll for in-flight result from concurrent request
        const resultKey = `idem_result_${idempotencyKey}`;
        for (let attempt = 0; attempt < 3; attempt++) {
          const cached = await cacheGet<string>(resultKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            return res.status(409).json({ error: "Duplicate request", ...parsed });
          }
          await new Promise(r => setTimeout(r, 150));
        }
        return res.status(409).json({ error: "Request still processing, retry in a few seconds" });
      }
    }

    const body = req.body || {};
    const units = Number(body.units_required);

    // Feature 5: Duplicate-request guard — best-effort, skip on failure
    try {
      const allReqs = await dbGetCollection<BloodRequest>("blood_requests");
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const dup = allReqs.find(r =>
        r.requester_phone === requester!.phone &&
        r.hospital_name?.toLowerCase().trim() === String(body.hospital_name).toLowerCase().trim() &&
        r.blood_type_needed === body.blood_type_needed &&
        r.created_at >= tenMinAgo
      );
      if (dup && !idempotencyKey) {
        return res.status(200).json({ requestId: dup.id, trackingCode: dup.tracking_code, status: dup.status, duplicate: true });
      }
    } catch (guardErr) {
      console.warn("[Requests] Duplicate guard skipped — table may not exist:", guardErr);
    }

    const isDraft = body.status === "draft";
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
      urgency_level: body.urgency_level || "urgent",
      requester_id: requester.id,
      requester_name: requester.full_name,
      requester_email: requester.email,
      requester_phone: requester.phone,
      additional_notes: body.additional_notes || "",
      status: isDraft ? "draft" : "broadcasting",
      showcase_opt_in: Boolean(body.showcase_opt_in),
      share_contact_immediately: Boolean(body.share_contact_immediately),
      expires_at: body.expires_at || new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      fulfilled_at: null,
      created_at: now,
    };
    await dbSaveDoc("blood_requests", id, request as unknown as Record<string, unknown>);

    // Cache the result for concurrent double-tap protection
    if (idempotencyKey) {
      await cacheSet(
        `idem_result_${idempotencyKey}`,
        JSON.stringify({ requestId: id, trackingCode: request.tracking_code }),
        60
      );
    }
    logRequestEvent(id, "created", requester.id).catch(() => {});

    // Immediate WhatsApp acknowledgement — fire-and-forget, never blocks the response.
    // Sent to the contact phone from the form (requester.phone, which may differ from the
    // account phone when a family member submits on behalf).
    if (!isDraft && requester.phone) {
      const { sendWhatsApp, buildRequesterAckMessage } = await import("../services/notificationService");
      sendWhatsApp(requester.phone, buildRequesterAckMessage(request)).catch(e =>
        console.error("[WAHA] Ack to requester failed:", e.message)
      );
    }

    // If saved as a draft, skip matching entirely — no notifications sent.
    if (isDraft) {
      console.log(`[Requests] Draft saved: ${request.tracking_code}`);
      return res.status(201).json({ requestId: id, trackingCode: request.tracking_code, status: "draft", matched: 0 });
    }

    // Matching is best-effort: if it crashes (e.g. schema mismatch), the request is already saved.
    let matched = 0;
    try {
      const result = await matchAndNotifyRequest(request);
      matched = result.matched;
    } catch (matchErr: any) {
      console.error("[Matching] Failed for request", id, "— request saved, matching skipped:", matchErr.message);
    }
    return res.status(201).json({ requestId: id, trackingCode: request.tracking_code, status: "broadcasting", matched });
  } catch (err: any) {
    if (err?.name === "FirebaseUnavailableError" || err?.code?.startsWith?.("42") || err?.code === "PGRST116") {
      return sendErrorResponse(res, err, "Database is temporarily unavailable. Please try again in a few seconds.", 503, "SERVICE_UNAVAILABLE");
    }
    return sendErrorResponse(res, err, "A failure occurred while saving your blood request. Please try again.");
  }
}));

// ── Promote a draft to a live broadcast (triggers matching engine) ─────────────
router.post("/api/requests/:id/broadcast", rateLimitMiddleware(10, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const request = await dbGetDoc<BloodRequest>("blood_requests", req.params.id);
  if (!request) return sendErrorResponse(res, new NotFoundError("Request not found."));
  if (request.requester_id !== authUser.id) return sendErrorResponse(res, new ForbiddenError("Not your request."));
  if (request.status !== "draft") return sendErrorResponse(res, new AppError("Only draft requests can be broadcast.", 409, "INVALID_STATUS"));

  // Transition to broadcasting before running the engine
  const now = nowISO();
  const updated = { ...request, status: "broadcasting" as const, updated_at: now };
  await dbSaveDoc("blood_requests", request.id, updated as unknown as Record<string, unknown>);

  let matched = 0;
  try {
    const result = await matchAndNotifyRequest(updated);
    matched = result.matched;
  } catch (matchErr: any) {
    console.error("[Matching] Failed for draft broadcast", request.id, ":", matchErr.message);
  }
  return res.json({ requestId: request.id, trackingCode: request.tracking_code, status: "broadcasting", matched });
}));

// ─── Public feed of opt-in live requests ──────────────────────────────────────
router.get("/api/live-requests", rateLimitMiddleware(60, 60_000), wrap(async (_req, res) => {
  // Store strategy: walk z:req:recent newest-first, hydrate, apply the old
  // where() predicates in-app (showcase_opt_in equality + status IN), stop at 12.
  const allowedStatuses = new Set(["open", "matching", "partially_matched"]);
  const data: Array<Record<string, unknown>> = [];
  const PAGE = 100;
  for (let offset = 0; data.length < 12 && offset < 5000; offset += PAGE) {
    const ids = await storeZrangeByScore("z:req:recent", 0, Number.MAX_SAFE_INTEGER, { rev: true, offset, count: PAGE });
    if (ids.length === 0) break;
    const docs = await storeMget<{ id: string } & Record<string, unknown>>("blood_requests", ids);
    for (const raw of docs) {
      if (!raw) continue;
      if (raw.showcase_opt_in !== true) continue;
      if (!allowedStatuses.has(String(raw.status))) continue;
      data.push({
        blood_type_needed: raw.blood_type_needed,
        units_required: raw.units_required,
        hospital_city: raw.hospital_city,
        urgency_level: raw.urgency_level,
        created_at: raw.created_at,
      });
      if (data.length >= 12) break;
    }
  }
  return res.json({ requests: data || [] });
}));

// ─── Requester dashboard ───────────────────────────────────────────────────────
router.get("/api/dashboard/requester", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));

  const requester = await resolveRequester(authUser);
  if (!requester) return sendErrorResponse(res, new NotFoundError("Requester profile not found."));

  const allRequests = await dbGetCollection<BloodRequest>("blood_requests");
  const requests = allRequests.filter(request =>
    request.requester_id === requester!.id ||
    request.requester_id === authUser.id ||
    (requester!.phone && normalizePhone(request.requester_phone || "") === normalizePhone(requester!.phone)) ||
    (requester!.whatsapp_number && normalizePhone(request.requester_phone || "") === normalizePhone(requester!.whatsapp_number))
  );
  const requestIds = new Set(requests.map(r => r.id));
  const allMatches = await dbGetCollection<Match>("matches");
  const matches = allMatches.filter(match => requestIds.has(match.request_id));
  const approvedDonorIds = new Set(
    matches.filter(match => match.donor_response === "approved").map(match => match.donor_id)
  );
  const allDonors = await dbGetCollection<User>("users");
  const donors = allDonors.filter(donor => approvedDonorIds.has(donor.id));
  return res.json({ requester, requests, matches, donors });
}));

// ─── Requester's request list ─────────────────────────────────────────────────
router.get("/api/requester/requests", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  let requesterId = authUser.id;
  let requesterPhone: string | null = null;
  let linked: { profile?: { id: string; full_name: string; email?: string; phone?: string | null; whatsapp_phone?: string | null; pincode?: string | null; area?: string | null; city?: string | null; notification_channel?: string | null } } | null = null;
  try {
    linked = await getLinkedProfile(authUser.id);
    if (linked?.profile?.id) requesterId = linked.profile.id;
    if (linked?.profile?.phone) requesterPhone = linked.profile.phone;
  } catch (e) {
    console.warn("[RequesterReqs] Profile lookup failed:", e);
  }

  const allRequests = await dbGetCollection<BloodRequest>("blood_requests");
  const requests = allRequests.filter(request =>
    request.requester_id === requesterId ||
    request.requester_id === authUser.id ||
    (requesterPhone && normalizePhone(request.requester_phone || "") === normalizePhone(requesterPhone))
  );
  const requestIds = new Set(requests.map(r => r.id));
  const allMatches = await dbGetCollection<Match>("matches");
  const matches = allMatches.filter(match => requestIds.has(match.request_id));
  const approvedDonorIds = new Set(
    matches.filter(match => match.donor_response === "approved").map(match => match.donor_id)
  );
  const allDonors = await dbGetCollection<User>("users");
  const donors = allDonors.filter(donor => approvedDonorIds.has(donor.id));
  const profile = linked?.profile
    ? {
        id: linked.profile.id,
        full_name: linked.profile.full_name,
        email: linked.profile.email || authUser.email || "",
        phone: linked.profile.phone || null,
        whatsapp_phone: linked.profile.whatsapp_phone || null,
        pincode: linked.profile.pincode || null,
        area: linked.profile.area || null,
        city: linked.profile.city || null,
        notification_channel: linked.profile.notification_channel || null,
      }
    : null;
  return res.json({ requests, matches, donors, profile });
}));

export default router;
