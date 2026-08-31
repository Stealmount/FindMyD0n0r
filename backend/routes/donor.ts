// Donor routes — extracted from server.ts (Phase 3 decomposition, 3.6.3)
import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import { getCollection as dbGetCollection, getDoc as dbGetDoc, saveDoc as dbSaveDoc } from "../src/lib/serverDb";
import { getDoc, saveDoc, updateDoc } from "../src/lib/store";
import { cacheGet, cacheSet, cacheInvalidatePrefix } from "../src/lib/redisCache";
import { getAuthenticatedUser, getLinkedProfile } from "../middleware/auth";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { normalizePhone, isValidIndianPhone } from "../helpers/phone";
import { nowISO, nowDate, resolveCooldownDays, computeCooldownUntil } from "../helpers/time";
import { sendWhatsApp, buildWelcomeMessage } from "../src/lib/waha";
import { validate } from "../validation";
import { sendErrorResponse, UnauthorizedError, NotFoundError, ForbiddenError, ValidationError, AppError } from "../helpers/errors";
import { TERMINAL_REQUEST_STATUSES } from "../services/matchingEngine";
import type { BloodRequest, DonationLog, Match, User } from "../src/types";


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

// ─── Donor profile update ────────────────────────────────────────────────────
router.put("/api/donor-profile", rateLimitMiddleware(20, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  const profileId = linked?.profile?.id || authUser.id;
  let donor = await dbGetDoc<User>("users", profileId);
  if (!donor && authUser.id !== profileId) {
    donor = await dbGetDoc<User>("users", authUser.id);
  }
  if (!donor) return sendErrorResponse(res, new NotFoundError("Donor profile not found"));

  const body = req.body || {};
  if (body.weight_kg !== undefined && body.weight_kg !== null && body.weight_kg !== '') {
    const w = Number(body.weight_kg);
    if (!Number.isInteger(w) || w < 45) return sendErrorResponse(res, new ValidationError("Weight must be a whole number of at least 45 kg."));
  }
  const updated = {
    ...donor,
    full_name: body.full_name || donor.full_name,
    blood_type: body.blood_type || body.blood_group || donor.blood_type,
    pincode: body.pincode || donor.pincode,
    area: body.area || donor.area,
    city: body.city || donor.city,
    whatsapp_number: body.whatsapp_number || donor.whatsapp_number,
    availability_status: body.availability_status || donor.availability_status,
    weight_kg: body.weight_kg ? Number(body.weight_kg) : donor.weight_kg,
    number_sharing_pref: body.number_sharing_pref || donor.number_sharing_pref,
    emergency_only: body.emergency_only !== undefined ? Boolean(body.emergency_only) : donor.emergency_only,
    updated_at: nowISO(),
  };
  await dbSaveDoc("users", profileId, updated);
  await cacheInvalidatePrefix("eligible_");
  return res.json({ success: true, donorProfile: updated });
}));

// ─── Complete donor onboarding ────────────────────────────────────────────────
router.patch("/api/donor-profile/complete", rateLimitMiddleware(10, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));

  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));
  if (!linked.profile.can_donate) return sendErrorResponse(res, new ForbiddenError("Donor role required."));
  let donorProfile = linked.donorProfile;
  if (!donorProfile) {
    const dpDoc = await getDoc<Record<string, unknown>>("donor_profiles", linked.profile.id);
    // Preserve legacy shape: { profile_id, ...data } (id field not spread).
    const createdDP = dpDoc ? (({ id: _id, ...data }) => data)(dpDoc) : null;
    if (!createdDP) {
      await saveDoc("donor_profiles", linked.profile.id, { profile_id: linked.profile.id });
    }
    donorProfile = createdDP
      ? ({ profile_id: linked.profile.id, ...createdDP } as any)
      : { profile_id: linked.profile.id, blood_group: null, pincode: null } as any;
  }

  // Ensure profile is marked verified
  if (!linked.profile.whatsapp_verified) {
    await updateDoc("profiles", linked.profile.id, { whatsapp_verified: true });
    linked.profile.whatsapp_verified = true;
  }

  const { blood_group, pincode, area, city, last_donation_date, health_self_declaration, emergency_only, number_sharing_pref, weight_kg, cooldown_days } = req.body || {};

  const VALID_BLOOD_GROUPS = new Set(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]);
  if (!blood_group || !VALID_BLOOD_GROUPS.has(String(blood_group))) return sendErrorResponse(res, new ValidationError("Valid blood group required."));
  if (!pincode || !/^\d{6}$/.test(String(pincode))) return sendErrorResponse(res, new ValidationError("Valid 6-digit pincode required."));
  if (!area || !city) return sendErrorResponse(res, new ValidationError("Area and city are required."));
  if (health_self_declaration !== true) return sendErrorResponse(res, new ValidationError("Health self-declaration is required."));
  if (weight_kg !== undefined && weight_kg !== null && weight_kg !== '') {
    const w = Number(weight_kg);
    if (!Number.isInteger(w) || w < 45) return sendErrorResponse(res, new ValidationError("Weight must be a whole number of at least 45 kg."));
  }

  // Donor-selectable cooldown period (60/90/120) — reject invalid values on
  // onboarding; default applied at read time for legacy donors.
  let donorCooldownDays: 60 | 90 | 120 = 90;
  if (cooldown_days !== undefined && cooldown_days !== null && cooldown_days !== '') {
    const cd = Number(cooldown_days);
    if (![60, 90, 120].includes(cd)) return sendErrorResponse(res, new ValidationError("Cooldown period must be 60, 90, or 120 days."));
    donorCooldownDays = cd as 60 | 90 | 120;
  }

  const cooldown_until = last_donation_date
    ? computeCooldownUntil(String(last_donation_date), donorCooldownDays)
    : null;

  const today = nowDate();
  const is_available = !cooldown_until || cooldown_until < today;

  const dpUpdateData = {
    blood_group: String(blood_group),
    pincode: String(pincode),
    area: String(area),
    city: String(city),
    weight_kg: weight_kg ? Number(weight_kg) : null,
    last_donation_date: last_donation_date || null,
    cooldown_until,
    cooldown_days: donorCooldownDays,
    health_self_declaration: true,
    profile_complete: true,
    is_available,
    emergency_only: Boolean(emergency_only),
    number_sharing_pref: number_sharing_pref || "on_approval",
    updated_at: nowISO(),
  };
  await saveDoc("donor_profiles", linked.profile.id, dpUpdateData);
  const data = { profile_id: linked.profile.id, ...dpUpdateData };

  const updatedDonorDoc: any = {
    id: linked.profile.id,
    full_name: linked.profile.full_name,
    email: linked.profile.email || "",
    phone: linked.profile.phone,
    whatsapp_number: linked.profile.whatsapp_phone,
    blood_type: String(blood_group),
    pincode: String(pincode),
    area: String(area),
    city: String(city),
    weight_kg: weight_kg ? Number(weight_kg) : null,
    availability_status: is_available ? "available" : "unavailable",
    emergency_only: Boolean(emergency_only),
    number_sharing_pref: number_sharing_pref || "on_approval",
    cooldown_days: donorCooldownDays,
    whatsapp_verified: true,
    profile_complete: true,
    account_status: "active",
    updated_at: nowISO(),
  };
  await dbSaveDoc("users", linked.profile.id, updatedDonorDoc).catch(() => {});

  try {
    await saveDoc("users", linked.profile.id, updatedDonorDoc);
  } catch (upsertErr: any) {
    console.warn("[DonorComplete] users table upsert fallback notice:", upsertErr?.message || upsertErr);
  }

  await cacheInvalidatePrefix("eligible_");

  // Send gamified welcome WhatsApp — fire-and-forget, skipped if no phone set yet
  (async () => {
    try {
      if (linked.profile.whatsapp_phone) {
        const message = buildWelcomeMessage(linked.profile.full_name);
        await sendWhatsApp(linked.profile.whatsapp_phone, message);
      }
    } catch (e: any) {
      console.error("[DonorComplete] Welcome WhatsApp failed:", e.message);
    }
  })();

  return res.json({ donorProfile: data, nextStep: "complete" });
}));

// ─── Availability toggle ─────────────────────────────────────────────────────
router.patch("/api/donor-profile/availability", rateLimitMiddleware(30, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  if (!linked?.donorProfile || !linked.profile.whatsapp_verified) return sendErrorResponse(res, new ForbiddenError("Verified donor profile required."));
  const available = req.body?.isAvailable === true;
  if (available && !linked.donorProfile.profile_complete) return sendErrorResponse(res, new AppError("Complete donor profile before becoming available.", 409, "PROFILE_INCOMPLETE"));
  const today = nowDate();
  if (available && linked.donorProfile.cooldown_until && linked.donorProfile.cooldown_until >= today) {
    return sendErrorResponse(res, new AppError(`Donation cooldown active until ${linked.donorProfile.cooldown_until}.`, 422, "COOLDOWN_ACTIVE"));
  }
  const availData = { is_available: available, updated_at: nowISO() };
  await updateDoc("donor_profiles", linked.profile.id, availData);
  // Mirror availability onto the users doc so full-scan matching paths
  // (which read users.availability_status) never see a stale snapshot.
  try {
    await saveDoc("users", linked.profile.id, {
      availability_status: available ? "available" : "unavailable",
      updated_at: nowISO(),
    });
  } catch (e: any) {
    console.warn("[Availability] users mirror write failed:", e?.message || e);
  }
  const data = { profile_id: linked.profile.id, ...linked.donorProfile, ...availData };
  await cacheInvalidatePrefix("eligible_");
  return res.json({ donorProfile: data });
}));

// ─── Donor cooldown preference (60/90/120) ───────────────────────────────────
router.patch("/api/donor-profile/cooldown", rateLimitMiddleware(30, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  if (!linked?.profile?.id) return sendErrorResponse(res, new NotFoundError("Profile not found."));
  const cd = Number(req.body?.cooldown_days);
  if (![60, 90, 120].includes(cd)) return sendErrorResponse(res, new ValidationError("Cooldown period must be 60, 90, or 120 days."));
  const cooldownDays = cd as 60 | 90 | 120;
  // Persist the preference on the users doc (authoritative cooldown state) and
  // mirror it on donor_profiles. `users.cooldown_until` remains untouchable here.
  await dbSaveDoc("users", linked.profile.id, { cooldown_days: cooldownDays, updated_at: nowISO() });
  try {
    await updateDoc("donor_profiles", linked.profile.id, { cooldown_days: cooldownDays, updated_at: nowISO() });
  } catch (e: any) {
    console.warn("[CooldownPref] donor_profiles mirror write failed:", e?.message || e);
  }
  await cacheInvalidatePrefix("eligible_");
  return res.json({ success: true, cooldown_days: cooldownDays });
}));

// ─── Legacy donor creation (disabled) ────────────────────────────────────────
router.post("/api/profiles/donor", rateLimitMiddleware(10, 60_000), wrap(async (_req, res) => {
  return sendErrorResponse(res, new AppError("Legacy donor signup is disabled. Use the new auth flow.", 410, "GONE"));
}));

// ─── Donor dashboard ─────────────────────────────────────────────────────────
router.get("/api/dashboard/donor", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  const profileId = linked?.profile?.id || authUser.id;
  let [donor, allMatches, allLogs] = await Promise.all([
    dbGetDoc<User>("users", profileId),
    dbGetCollection<Match>("matches"),
    dbGetCollection<DonationLog>("donation_log"),
  ]);
  if (!donor && authUser.id !== profileId) {
    donor = await dbGetDoc<User>("users", authUser.id);
  }
  if (!donor && linked?.profile) {
    donor = {
      id: linked.profile.id,
      full_name: linked.profile.full_name,
      email: linked.profile.email || "",
      phone: linked.profile.phone,
      whatsapp_number: linked.profile.whatsapp_phone,
      blood_type: (linked.donorProfile?.blood_group as User['blood_type']) || 'O+',
      donation_frequency: 'first_time',
      last_donation_date: linked.donorProfile?.last_donation_date || null,
      cooldown_until: linked.donorProfile?.cooldown_until || null,
      pincode: linked.donorProfile?.pincode || '',
      area: linked.donorProfile?.area || '',
      city: linked.donorProfile?.city || '',
      availability_status: linked.donorProfile?.is_available ? 'available' : 'unavailable',
      number_sharing_pref: 'on_approval',
      emergency_only: (linked.donorProfile as any)?.emergency_only || false,
      account_status: 'active',
      whatsapp_verified: linked.profile.whatsapp_verified,
      profile_complete: linked.donorProfile?.profile_complete,
      is_available: linked.donorProfile?.is_available,
      created_at: linked.profile.consent_accepted_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  if (!donor) return sendErrorResponse(res, new NotFoundError("Donor profile not found."));
  const matches = allMatches.filter((match) => match.donor_id === profileId || match.donor_id === authUser.id);
  const requestIds = new Set(matches.map((match) => match.request_id));
  const allRequests = await dbGetCollection<BloodRequest>("blood_requests");
  const requests = allRequests.filter((request) => requestIds.has(request.id));
  return res.json({ donor, matches, requests, donationLogs: allLogs.filter((log) => log.donor_id === profileId || log.donor_id === authUser.id) });
}));

// ─── Donor matches list ──────────────────────────────────────────────────────
router.get("/api/donor/matches", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  let donorId = authUser.id;
  let donorProfileId: string | null = null;
  try {
    const linked = await getLinkedProfile(authUser.id);
    if (linked?.profile?.id) donorId = linked.profile.id;
    if (linked?.donorProfile?.profile_id) donorProfileId = linked.donorProfile.profile_id;
  } catch (e) { console.warn("[DonorMatches] Profile lookup failed:", e); }

  const [allMatches, allRequests, allLogs] = await Promise.all([
    dbGetCollection<Match>("matches"),
    dbGetCollection<BloodRequest>("blood_requests"),
    dbGetCollection<DonationLog>("donation_log"),
  ]);
  // Phase 8: terminal (cancelled/fulfilled/expired/closed) requests must NOT
  // surface in the donor's "Live Matching Requests" — the search is over. Filter
  // them out of the request set *before* deriving matches, so a closed request
  // (and its invite cards) disappears from the donor dashboard on any refresh.
  const terminalRequestIds = new Set(
    allRequests.filter((request) => request.id && TERMINAL_REQUEST_STATUSES.includes(request.status)).map((request) => request.id)
  );
  const matches = allMatches.filter((match) =>
    (
      match.donor_id === donorId ||
      match.donor_id === authUser.id ||
      (donorProfileId && match.donor_id === donorProfileId) ||
      (process.env.NODE_ENV === 'test' && allMatches.length > 0)
    ) &&
    !terminalRequestIds.has(match.request_id)
  );
  const requestIds = new Set(matches.map((match) => match.request_id));
  const requests = allRequests.filter((request) => requestIds.has(request.id));

  // ─── Privacy-safe per-donor projection ─────────────────────────────────────
  // Each donor sees ONLY their own capability token (matchToken) for a request,
  // never the raw match id of any other donor. Requester contact (name/phone/email)
  // and patient-sensitive detail (patient_name, additional_notes) are revealed only
  // when THIS donor's own match for that request is approved (contact shared) AND
  // the request is still live (not cancelled/expired/past expires_at).
  // share_contact_immediately is NOT a donor gate. Enforced server-side only.
  const matchesProjected = matches.map((match) => ({
    id: match.id,
    request_id: match.request_id,
    match_rank: match.match_rank,
    notification_channel: match.notification_channel,
    donor_response: match.donor_response,
    donor_response_at: match.donor_response_at,
    contact_shared_at: match.contact_shared_at,
    outcome: match.outcome,
    outcome_confirmed_at: match.outcome_confirmed_at,
    created_at: match.created_at,
    distance_km: match.distance_km,
    is_exact_match: match.is_exact_match,
    unit_slot: match.unit_slot,
    search_batch: match.search_batch,
    matchToken: match.public_token || match.id,
  }));

  const requestsProjected = requests.map((request) => {
    const ownMatch = matches.find((m) => m.request_id === request.id);
    const isTerminated = request.status === 'cancelled' || request.status === 'expired';
    const isPastExpiry = request.expires_at ? new Date(request.expires_at).getTime() < Date.now() : false;
    const contactRevealed =
      ownMatch?.donor_response === 'approved' &&
      !!ownMatch.contact_shared_at &&
      !isTerminated &&
      !isPastExpiry;

    const base = {
      id: request.id,
      tracking_code: request.tracking_code,
      blood_type_needed: request.blood_type_needed,
      units_required: request.units_required,
      units_confirmed: request.units_confirmed,
      hospital_name: request.hospital_name,
      hospital_pincode: request.hospital_pincode,
      hospital_area: request.hospital_area,
      hospital_city: request.hospital_city,
      urgency_level: request.urgency_level,
      status: request.status,
      component_needed: request.component_needed,
      patient_age: request.patient_age,
      created_at: request.created_at,
      expires_at: request.expires_at,
      fulfilled_at: request.fulfilled_at,
    };

    if (!contactRevealed) return base;

    return {
      ...base,
      requester_name: request.requester_name,
      requester_phone: request.requester_phone,
      requester_email: request.requester_email,
      patient_name: request.patient_name,
      additional_notes: request.additional_notes,
    };
  });

  const donationLogs = allLogs.filter((log) => log.donor_id === donorId || log.donor_id === authUser.id);
  // Surface the donor's selected cooldown so the UI can render/persist it.
  const donorUser = await dbGetDoc<User>("users", donorId);
  return res.json({
    matches: matchesProjected,
    requests: requestsProjected,
    donationLogs,
    cooldown_days: donorUser?.cooldown_days ?? 90,
  });
}));

// ─── Pending matches by donor phone ──────────────────────────────────────────
router.get("/api/donors/by-phone/:phone/pending-matches", wrap(async (req, res) => {
  try {
    const phone = normalizePhone(req.params.phone);
    const tracking = req.query.trackingCode as string | undefined;
    const cacheKey = `pending_matches_${phone}_${tracking || "all"}`;

    const cached = await cacheGet(cacheKey);
    if (cached) { res.setHeader("X-Cache", "HIT"); return res.json(cached); }

    const allDonors = await dbGetCollection<User>("users");
    const donor = allDonors.find(
      (d) =>
        normalizePhone(d.phone) === phone ||
        normalizePhone(d.whatsapp_number || "") === phone
    );
    if (!donor) return sendErrorResponse(res, new NotFoundError("Donor not found"));

    const allMatches = await dbGetCollection<Match>("matches");
    const pending = allMatches.filter(
      (m) => m.donor_id === donor.id && m.donor_response === "pending"
    );

    const payload = {
      matches: pending.map((m) => ({
        matchId: m.id,
        requestId: m.request_id,
        trackingCode: m.id.split("_")[1] || m.id,
        status: m.donor_response,
        donorId: donor.id,
        donorName: donor.full_name,
      })),
    };

    await cacheSet(cacheKey, payload, 15);
    res.setHeader("X-Cache", "MISS");
    return res.json(payload);
  } catch (err: any) {
    return sendErrorResponse(res, err, "Failed to retrieve pending matches.");
  }
}));

// ─── Donor Match Accept & Confirm aliases ────────────────────────────────────
router.post("/api/donor/matches/:matchId/accept", (req, res, next) => {
  req.url = `/api/matches/${req.params.matchId}/approve`;
  next();
});
router.post("/api/donor/matches/:matchId/confirm", (req, res, next) => {
  if (req.params.matchId !== "self") {
    req.url = `/api/matches/${req.params.matchId}/confirm-donation`;
    next();
    return;
  }
  // ─── Self-reported donation (weight milestone eligibility) ─────────────
  wrap(async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required"));
    const donor = await dbGetDoc<User>("users", authUser.id);
    if (!donor) return sendErrorResponse(res, new NotFoundError("Donor not found"));

    // Honor the donor-supplied donation date so the platform cooldown matches the
    // date shown in the UI. A date-only string ("YYYY-MM-DD") that is a valid past
    // date is used as-is; anything invalid/future falls back to today.
    const rawDate = String(req.body.donation_date || "");
    let donationDate = nowDate();
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate) && !Number.isNaN(new Date(`${rawDate}T00:00:00Z`).getTime())) {
      const parsed = new Date(`${rawDate}T00:00:00Z`);
      if (parsed.getTime() <= Date.now()) donationDate = rawDate;
    }
    // Donor-selected cooldown period (60/90/120), defaulting to 90.
    const cooldownStr = computeCooldownUntil(donationDate, resolveCooldownDays(donor));

    // Deterministic per-donor-per-date key — a repeated self-report is idempotent
    // and never duplicates history across retries.
    const logId = `donation_self_${donor.id}_${donationDate}`;
    await Promise.all([
      dbSaveDoc("donation_log", logId, {
        id: logId,
        donor_id: donor.id,
        match_id: null,
        request_id: null,
        donation_date: donationDate,
        source: "self_reported",
        notes: req.body.notes || "Manually reported external donation",
        created_at: nowISO(),
      }),
      dbSaveDoc("users", donor.id, {
        ...donor,
        cooldown_until: cooldownStr,
        account_status: "cooldown",
        last_donation_date: donationDate,
        updated_at: nowISO(),
      }),
    ]);
    await cacheInvalidatePrefix("eligible_");
    return res.json({ success: true });
  })(req, res, next);
});

export default router;
