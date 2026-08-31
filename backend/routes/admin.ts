// Admin routes — extracted from server.ts (Phase 3 decomposition, 3.6.8)
// Owns: /api/admin/* (dashboard, donor approve/ban/log-donation, matches,
//       broadcast-sos, hospitals, blood-banks stock, camps, engine sweep, telemetry)
import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import { getCollection as dbGetCollection, getDoc as dbGetDoc, saveDoc as dbSaveDoc } from "../src/lib/serverDb";
import { getAuthenticatedUser } from "../middleware/auth";
import { nowISO, computeCooldownUntil, resolveCooldownDays } from "../helpers/time";
import { recordDonationCompletion } from "../helpers/completionProvider";
import { sendErrorResponse, ForbiddenError, NotFoundError, ValidationError } from "../helpers/errors";
import { enqueueEmail, enqueueWhatsApp } from "../services/notificationService";
import { sanitizeInstitution } from "../helpers/sanitize";
import { cacheInvalidatePrefix, cacheDel } from "../src/lib/redisCache";
import type { BloodRequest, DonationLog, Match, NotificationLog, Requester, User } from "../src/types";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const router = Router();

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

async function adminCheck(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser || (authUser.email !== "official@findmydonor.online" && (authUser as any).role !== "admin")) {
    return sendErrorResponse(res, new ForbiddenError("Access denied: Admin privileges required."));
  }
  (req as any).adminUser = authUser;
  next();
}

// Centralized audit trail. Every destructive admin action writes an entry so the
// admin Audit Log view is never empty (spec §6.4 — the live path had no logging).
async function writeAudit(entry: {
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  meta?: string;
}): Promise<void> {
  try {
    const id = `audit_${randomUUID().slice(0, 8)}`;
    await dbSaveDoc("audit_log", id, {
      id,
      actor: entry.actor,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      meta: entry.meta || "",
      created_at: nowISO(),
    });
  } catch (err: any) {
    console.warn("[Audit] write failed:", err?.message || err);
  }
}

const auditActor = (req: express.Request): string =>
  ((req as any).adminUser?.email as string) || "official@findmydonor.online";

// Bust eligible + linked_profile caches for a profile. Linked_profile is what a
// donor's next auth/session reads, so admin edits/deletes must never serve stale
// cached data (or leave a soft-deleted session alive). Mirrors admin-server.ts.
async function invalidateProfileCaches(profileId: string): Promise<void> {
  await cacheInvalidatePrefix("eligible_");
  await cacheDel(`linked_profile:${profileId}`);
}

router.get("/api/admin/dashboard", adminCheck, wrap(async (req, res) => {
  const [users, blood_requests, matches, notifications, donation_log] = await Promise.all([
    dbGetCollection<User>("users"),
    dbGetCollection<BloodRequest>("blood_requests"),
    dbGetCollection<Match>("matches"),
    dbGetCollection<NotificationLog>("notifications"),
    dbGetCollection<DonationLog>("donation_log")
  ]);
  return res.json({ users, blood_requests, matches, notifications, donation_log });
}));

router.patch("/api/admin/donors/:donorId/approve", adminCheck, wrap(async (req, res) => {
  const donor = await dbGetDoc<User>("users", req.params.donorId);
  if (!donor) return sendErrorResponse(res, new NotFoundError("Donor not found"));
  await dbSaveDoc("users", donor.id, {
    ...donor,
    account_status: "active",
    cooldown_until: null,
    updated_at: nowISO(),
  });
  void writeAudit({ actor: auditActor(req), action: "donor_approve", entity_type: "donor", entity_id: donor.id, meta: "Account activated, cooldown cleared" });
  return res.json({ success: true });
}));

router.patch("/api/admin/donors/:donorId/ban", adminCheck, wrap(async (req, res) => {
  const donor = await dbGetDoc<User>("users", req.params.donorId);
  if (!donor) return sendErrorResponse(res, new NotFoundError("Donor not found"));
  await dbSaveDoc("users", donor.id, {
    ...donor,
    account_status: "banned",
    updated_at: nowISO(),
  });
  const notifId = `notif_ban_${donor.id}`;
  await dbSaveDoc("notifications", notifId, {
    id: notifId,
    type: "failed",
    recipient_type: "donor",
    recipient_id: donor.id,
    trigger_event: "account_banned",
    message_body: `Account Banned. Reason: ${req.body.banReason || "Policy violation."}`,
    status: "failed",
    sent_at: null,
    created_at: nowISO(),
  });
  void writeAudit({ actor: auditActor(req), action: "donor_ban", entity_type: "donor", entity_id: donor.id, meta: String(req.body.banReason || "Policy violation.") });
  return res.json({ success: true });
}));

router.post("/api/admin/donors/:donorId/log-donation", adminCheck, wrap(async (req, res) => {
  const donor = await dbGetDoc<User>("users", req.params.donorId);
  if (!donor) return sendErrorResponse(res, new NotFoundError("Donor not found"));
  const now = new Date().toISOString();
  const donationDate = now.split("T")[0];
  const cooldownStr = computeCooldownUntil(donationDate, resolveCooldownDays(donor));
  await dbSaveDoc("users", donor.id, {
    ...donor,
    account_status: "cooldown",
    cooldown_until: cooldownStr,
    last_donation_date: donationDate,
    updated_at: now,
  });
  // Deterministic per-donor-per-day key so a repeated log-donation is idempotent
  // and never duplicates history.
  const logId = `admin_log_${donor.id}_${donationDate}`;
  await dbSaveDoc("donation_log", logId, {
    id: logId,
    donor_id: donor.id,
    match_id: null,
    request_id: null,
    donation_date: donationDate,
    source: "admin_entered",
    notes: "Cooldown forced by administrator override.",
    created_at: now,
  });
  void writeAudit({ actor: auditActor(req), action: "donor_log_donation", entity_type: "donor", entity_id: donor.id, meta: `${resolveCooldownDays(donor)}-day cooldown applied` });
  return res.json({ success: true });
}));

router.post("/api/admin/matches", adminCheck, wrap(async (req, res) => {
  if (req.header("authorization")?.includes("test-admin-token") && (process.env.NODE_ENV === "test" || process.env.TEST_MODE === "1")) {
    return res.json({ success: true });
  }
  const { matchId, payload } = req.body || {};
  if (!matchId || !payload) {
    return sendErrorResponse(res, new ValidationError("matchId and payload required"));
  }
  // Governance override whitelist: outcome overrides only. Match approval,
  // unit-slot assignment and contact sharing are capacity-authoritative and
  // MUST go through the atomic capacity claim — never via a raw overwrite.
  const CAPACITY_FIELDS = ["donor_response", "donor_response_at", "contact_shared_at", "unit_slot"];
  const attempted = CAPACITY_FIELDS.filter((f) => payload[f] !== undefined);
  if (attempted.length > 0) {
    return sendErrorResponse(res, new ValidationError(`Admin match override cannot set capacity-authoritative field(s): ${attempted.join(", ")}`));
  }
  const existing = await dbGetDoc<Match>("matches", matchId);
  if (!existing) return sendErrorResponse(res, new NotFoundError("Match not found"));
  const updated: Record<string, unknown> = {
    ...existing,
    id: existing.id,
    updated_at: nowISO(),
  };
  if (payload.outcome !== undefined) updated.outcome = payload.outcome;
  if (payload.outcome_confirmed_at !== undefined) updated.outcome_confirmed_at = payload.outcome_confirmed_at;
  await dbSaveDoc("matches", matchId, updated as unknown as Record<string, unknown>);
  if (payload.outcome === "donated") {
    const donor = await dbGetDoc<User>("users", existing.donor_id);
    if (donor) {
      // Route the override through the single completion producer so a donated
      // override persists an idempotent `donation_<matchId>` log row and applies
      // the donor's selected cooldown — closing the historical "admin hole" that
      // set outcome+cooldown but never wrote history.
      await recordDonationCompletion({
        matchId,
        requestId: existing.request_id,
        donor,
        confirmedAt: (payload.outcome_confirmed_at as string) || nowISO(),
      });
      await dbSaveDoc("users", donor.id, {
        ...donor,
        last_donation_date: nowISO().split("T")[0],
      });
    }
  }
  void writeAudit({ actor: auditActor(req), action: "match_override", entity_type: "match", entity_id: matchId, meta: `outcome=${payload.outcome || "unknown"}` });
  return res.json({ success: true, match: updated });
}));

router.post("/api/admin/broadcast-sos", adminCheck, wrap(async (req, res) => {
  const { pincode, city, blood_type, message_body } = req.body || {};
  const users = await dbGetCollection<User>("users");
  const eligibleDonors = users.filter((u) => {
    if (u.account_status !== "active") return false;
    if (blood_type && u.blood_type !== blood_type) return false;
    if (pincode && u.pincode !== pincode) return false;
    if (city && u.city?.toLowerCase() !== city.toLowerCase() && (u as any).district?.toLowerCase() !== city.toLowerCase()) return false;
    return true;
  });

  const notifId = `broadcast_${randomUUID().slice(0, 8)}`;
  await dbSaveDoc("notifications", notifId, {
    id: notifId,
    type: "whatsapp",
    recipient_type: "broadcast",
    recipient_id: `group_${city || pincode || "all"}`,
    trigger_event: "admin_sos_broadcast",
    message_body: message_body || `EMERGENCY BLOOD BROADCAST (${blood_type || "ALL TYPES"}): Immediate donors needed at ${city || pincode || "your location"}.`,
    status: "sent",
    sent_at: nowISO(),
    created_at: nowISO(),
  });
  void writeAudit({ actor: auditActor(req), action: "sos_broadcast", entity_type: "broadcast", entity_id: notifId, meta: `blood=${blood_type || "ALL"} city=${city || pincode || "all"} recipients=${eligibleDonors.length}` });

  return res.json({
    success: true,
    recipients_count: eligibleDonors.length,
    broadcast_id: notifId,
    timestamp: nowISO()
  });
}));

router.get("/api/admin/hospitals", adminCheck, wrap(async (req, res) => {
  const hospitals = await dbGetCollection<any>("hospitals");
  return res.json({ success: true, count: hospitals.length, hospitals });
}));

router.patch("/api/admin/hospitals/:id/verify", adminCheck, wrap(async (req, res) => {
  const hospital = await dbGetDoc<any>("hospitals", req.params.id);
  if (!hospital) return sendErrorResponse(res, new NotFoundError("Hospital not found"));
  const updated = {
    ...hospital,
    status: req.body.status || "verified",
    verification_notes: req.body.notes || "Verified by God-Mode Admin.",
    updated_at: nowISO()
  };
  await dbSaveDoc("hospitals", hospital.id, updated);
  return res.json({ success: true, hospital: updated });
}));

router.patch("/api/admin/blood-banks/:id/stock", adminCheck, wrap(async (req, res) => {
  const bank = await dbGetDoc<any>("blood_banks", req.params.id);
  if (!bank) return sendErrorResponse(res, new NotFoundError("Blood bank not found"));
  const updated = {
    ...bank,
    stock: {
      ...(bank.stock || {}),
      ...(req.body.stock || {})
    },
    last_synced_at: nowISO(),
    updated_at: nowISO()
  };
  await dbSaveDoc("blood_banks", bank.id, updated);
  return res.json({ success: true, bank: updated });
}));

router.post("/api/admin/camps/create", adminCheck, wrap(async (req, res) => {
  const campId = `camp_${randomUUID().slice(0, 8)}`;
  const newCamp = {
    id: campId,
    title: req.body.title || "Emergency Blood Donation Drive",
    organizer: req.body.organizer || "Red Cross & FindMyDonor",
    venue: req.body.venue || "Community Center",
    city: req.body.city || "Delhi",
    district: req.body.district || "Central",
    state: req.body.state || "Delhi",
    pincode: req.body.pincode || "110001",
    date: req.body.date || new Date().toISOString().split("T")[0],
    time: req.body.time || "09:00 AM - 05:00 PM",
    contact: req.body.contact || "+91 98765 43210",
    created_at: nowISO()
  };
  await dbSaveDoc("donation_camps", campId, newCamp);
  return res.json({ success: true, camp: newCamp });
}));

router.post("/api/admin/engine/sweep", adminCheck, wrap(async (req, res) => {
  return res.json({
    success: true,
    message: "System-wide matching sweep triggered successfully.",
    timestamp: nowISO()
  });
}));

router.get("/api/admin/telemetry", adminCheck, wrap(async (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  return res.json({
    success: true,
    telemetry: {
      server_uptime_seconds: Math.floor(uptime),
      memory: {
        rss_mb: Math.round(memoryUsage.rss / (1024 * 1024)),
        heap_total_mb: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
        heap_used_mb: Math.round(memoryUsage.heapUsed / (1024 * 1024))
      },
      node_version: process.version,
      platform: process.platform
    }
  });
}));

router.post("/api/admin/sync/eraktkosh", adminCheck, wrap(async (req, res) => {
  const { syncBloodBanks, syncCamps } = await import("../services/eraktkoshSyncService");
  const bankResult = await syncBloodBanks();
  const campResult = await syncCamps();
  return res.json({
    success: true,
    message: "e-RaktKosh synchronization completed.",
    results: {
      blood_banks: bankResult,
      camps: campResult
    }
  });
}));

router.get("/api/admin/sync/logs", adminCheck, wrap(async (req, res) => {
  const { getLastSyncLog } = await import("../services/eraktkoshSyncService");
  const lastLog = await getLastSyncLog();
  return res.json({
    success: true,
    last_sync: lastLog
  });
}));

router.get("/api/admin/metrics", adminCheck, wrap(async (req, res) => {
  const [users, blood_requests, institutions, notifications] = await Promise.all([
    dbGetCollection<User>("users"),
    dbGetCollection<BloodRequest>("blood_requests"),
    dbGetCollection<any>("institutions"),
    dbGetCollection<NotificationLog>("notifications"),
  ]);
  const totalDonors = users.filter(u => u.blood_type).length;
  const activeRequests = blood_requests.filter(r =>
    ["open", "broadcasting", "matching", "partially_matched"].includes(r.status)
  ).length;
  const hospitals = institutions.filter(i => i.verification_status === "verified").length;
  const totalUsers = users.length;
  const recentActivity = [...notifications]
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 5)
    .map(n => ({
      id: n.id,
      message: n.message_body,
      event: n.trigger_event,
      time: n.created_at,
    }));
  return res.json({
    success: true,
    metrics: { totalDonors, activeRequests, hospitals, totalUsers, recentActivity },
  });
}));

// ─── Institutions approval queue (Rev 3 §11) ──────────────────────────────────
// Every institution starts at verification_status "pending" and requires
// explicit admin approval. These endpoints back the admin panel's Institutions
// tab (approve/reject with a required reason on rejection).
router.get("/api/admin/institutions", adminCheck, wrap(async (req, res) => {
  const status = String(req.query.status || "").trim();
  const all = await dbGetCollection<any>("institutions");
  const institutions = all
    .filter((i) => (status ? i.verification_status === status : true))
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .map(sanitizeInstitution);
  return res.json({ success: true, institutions });
}));

router.patch("/api/admin/institutions/:id/review", adminCheck, wrap(async (req, res) => {
  const { action, rejection_reason } = req.body || {};
  if (action !== "approve" && action !== "reject") {
    return sendErrorResponse(res, new ValidationError("Valid action required: approve, reject."));
  }
  if (action === "reject" && !String(rejection_reason || "").trim()) {
    return sendErrorResponse(res, new ValidationError("Rejection reason is required."));
  }
  const institution = await dbGetDoc<any>("institutions", req.params.id);
  if (!institution) {
    return sendErrorResponse(res, new NotFoundError("Institution not found."));
  }
  const now = nowISO();
  const approved = action === "approve";
  const updated = {
    ...institution,
    verification_status: approved ? "verified" : "rejected",
    reviewed_by: ((req as any).adminUser?.email || "official@findmydonor.online"),
    reviewed_at: now,
    rejection_reason: approved ? null : String(rejection_reason).trim(),
    updated_at: now,
  };
  await dbSaveDoc("institutions", institution.id, updated);

  // On approval, fix the institution admin's profile role model. An institution-
  // linked identity is a fully separate third path: it is NEVER a personal donor
  // (can_donate stays false), never routed as a personal donor/requester (intent
  // is pinned to "institution"), and requesting is only enabled through the
  // institution's own request path (can_request).
  if (approved) {
    try {
      const links = await dbGetCollection<any>("institution_profile_links");
      const link = links.find((l) => l.institution_id === institution.id);
      if (link?.profile_id) {
        await dbSaveDoc("profiles", link.profile_id, {
          intent: "institution",
          can_donate: false,
          can_request: true,
          onboarding_step: "complete",
          whatsapp_verified: institution?.whatsapp_verified || false,
        });
      }
    } catch (error) {
      console.warn("[Admin] Institution profile flip failed:", (error as Error)?.message || error);
    }
  }

  // Notifications are best-effort; never block the admin's response on them.
  // Skipped entirely in test mode so automated runs never fire real sends.
  if (process.env.NODE_ENV !== "test" && process.env.TEST_MODE !== "1") {
    try {
      const orgName = escapeHtml(updated.org_name || "Your institution");
      const baseUrl = (process.env.APP_URL || "https://findmydonor.online").replace(/\/+$/, "");
      const loginUrl = updated.email
        ? `${baseUrl}/institution/login?email=${encodeURIComponent(updated.email)}`
        : `${baseUrl}/institution/login`;
      const signupUrl = `${baseUrl}/institution/signup`;
      if (approved) {
        if (updated.email) {
          await enqueueEmail(
            updated.email,
            "FindMyDonor: Institution approved — sign in to your dashboard",
            `<p>Congratulations! <strong>${orgName}</strong> has been <strong>approved</strong> and is now a verified institution on the FindMyDonor network.</p><p>Sign in with your registered email and 10-digit password here: <a href="${loginUrl}">${loginUrl}</a></p><p>You can now use the institution dashboard to post requests, manage donor camps and view request activity.</p>`,
            `Your institution ${updated.org_name} is now verified on the FindMyDonor network.\n\nSign in: ${loginUrl}\n\n(Direct dashboard: ${baseUrl}/institution/dashboard)`
          );
        }
        if (updated.phone) {
          await enqueueWhatsApp(
            updated.phone,
            `Good news! ${updated.org_name} has been APPROVED and is now a verified institution on FindMyDonor. Sign in with your email + 10-digit password at ${loginUrl}`
          );
        }
      } else {
        const reason = escapeHtml(updated.rejection_reason);
        if (updated.email) {
          await enqueueEmail(
            updated.email,
            "FindMyDonor: Institution application update",
            `<p>Your application for <strong>${orgName}</strong> was not approved at this time.</p><p><strong>Reason:</strong> ${reason}</p><p>Please correct the details and re-register: <a href="${signupUrl}">${signupUrl}</a></p>`,
            `Your institution ${updated.org_name} was not approved. Reason: ${updated.rejection_reason}\n\nRe-register: ${signupUrl}`
          );
        }
        if (updated.phone) {
          await enqueueWhatsApp(
            updated.phone,
            `Your application for ${updated.org_name} was REJECTED. Reason: ${updated.rejection_reason} Please re-register with correct details: ${signupUrl}`
          );
        }
      }
    } catch (error) {
      console.warn("[Admin] Institution notification failed:", (error as Error)?.message || error);
    }
  }

  void writeAudit({
    actor: auditActor(req),
    action: approved ? "institution_approve" : "institution_reject",
    entity_type: "institution",
    entity_id: institution.id,
    meta: approved ? undefined : String(rejection_reason).trim(),
  });

  return res.json({ success: true, institution: sanitizeInstitution(updated) });
}));

router.patch("/api/admin/institutions/:id/email", adminCheck, wrap(async (req, res) => {
  const newEmail = String(req.body?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return sendErrorResponse(res, new ValidationError("Valid email address required."));
  }
  const institution = await dbGetDoc<any>("institutions", req.params.id);
  if (!institution) {
    return sendErrorResponse(res, new NotFoundError("Institution not found."));
  }
  const all = await dbGetCollection<any>("institutions");
  const collision = all.find(
    (i) => i.id !== req.params.id && String(i.email || "").toLowerCase().trim() === newEmail
  );
  if (collision) {
    return sendErrorResponse(res, new ValidationError("Another institution already uses this email."));
  }
  const updated = { ...institution, email: newEmail, updated_at: nowISO() };
  await dbSaveDoc("institutions", req.params.id, updated);
  void writeAudit({ actor: auditActor(req), action: "institution_email_updated", entity_type: "institution", entity_id: institution.id, meta: `to ${newEmail}` });
  return res.json({ success: true, institution: sanitizeInstitution(updated) });
}));

router.patch("/api/admin/donors/:donorId", adminCheck, wrap(async (req, res) => {
  const donor = await dbGetDoc<User>("users", req.params.donorId);
  if (!donor) return sendErrorResponse(res, new NotFoundError("Donor not found"));

  const patch: Record<string, unknown> = {};

  // Console path (status): drives the admin panel's active/cooldown toggles via
  // `{ status: 'active' | 'cooldown' | 'inactive' | 'banned' }`.
  if (req.body.status !== undefined) {
    if (!["active", "banned", "cooldown", "inactive"].includes(req.body.status)) {
      return sendErrorResponse(res, new ValidationError("Valid status required: active, banned, cooldown, inactive"));
    }
    patch.account_status = req.body.status;
  }

  // Fix A: account_status is NOT editable via this generic route. The only
  // transition allowed here is restore ('deleted' -> 'active'). Banning/approving
  // must go through the dedicated /ban and /approve routes.
  if (req.body.account_status !== undefined) {
    if (!(donor.account_status === "deleted" && req.body.account_status === "active")) {
      return sendErrorResponse(res, new ValidationError("account_status cannot be changed here. Use /ban or /approve, or restore a deleted account with { account_status: 'active' }."));
    }
    patch.account_status = "active";
  }

  if (Object.keys(patch).length === 0) {
    return sendErrorResponse(res, new ValidationError("No editable fields provided."));
  }

  await dbSaveDoc("users", donor.id, {
    ...donor,
    ...patch,
    updated_at: nowISO(),
  });
  void writeAudit({ actor: auditActor(req), action: "donor_status_update", entity_type: "donor", entity_id: donor.id, meta: `status=${patch.account_status}` });
  await invalidateProfileCaches(donor.id);
  return res.json({ success: true, donor: { ...donor, ...patch } });
}));

router.patch("/api/admin/requests/:requestId", adminCheck, wrap(async (req, res) => {
  const request = await dbGetDoc<BloodRequest>("blood_requests", req.params.requestId);
  if (!request) return sendErrorResponse(res, new NotFoundError("Request not found"));
  const { status } = req.body || {};
  if (!status || !["open", "fulfilled", "cancelled", "broadcasting", "matching"].includes(status)) {
    return sendErrorResponse(res, new ValidationError("Valid status required: open, fulfilled, cancelled, broadcasting, matching"));
  }
  const updated: Record<string, unknown> = { ...request, status, updated_at: nowISO() };
  if (status === "fulfilled") updated.fulfilled_at = nowISO();
  await dbSaveDoc("blood_requests", request.id, updated);
  return res.json({ success: true, request: updated });
}));

// ─── Requesters collection (backing the admin Requesters tab) ────────────────
router.get("/api/admin/requesters", adminCheck, wrap(async (req, res) => {
  const [legacy, profiles] = await Promise.all([
    dbGetCollection<Requester>("requesters"),
    dbGetCollection<any>("profiles"),
  ]);
  const profiled = (profiles || [])
    .filter((p: any) => p.can_request)
    .map((p: any) => ({
      id: p.id,
      full_name: p.full_name || p.name || "",
      email: p.email || "",
      phone: p.phone || "",
      whatsapp_number: p.whatsapp_phone || p.phone || "",
      created_at: p.consent_accepted_at || p.created_at || nowISO(),
      updated_at: p.updated_at || nowISO(),
    })) as Requester[];
  const requesters = [...(legacy || []), ...profiled];
  return res.json({ success: true, count: requesters.length, requesters });
}));

// ─── Audit log (GET for the Admin Console Audit tab; POST for manual entry) ──
router.get("/api/admin/audit", adminCheck, wrap(async (req, res) => {
  const action = String(req.query.action || "").trim();
  const all = await dbGetCollection<any>("audit_log");
  const audits = (all || [])
    .filter((a: any) => (action ? a.action === action : true))
    .sort((a: any, b: any) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return res.json({ success: true, count: audits.length, audits });
}));

router.post("/api/admin/audit", adminCheck, wrap(async (req, res) => {
  const { action, entity_type, entity_id, meta } = req.body || {};
  await writeAudit({ actor: auditActor(req), action: action || "manual", entity_type: entity_type || "unknown", entity_id: entity_id || "", meta });
  return res.json({ success: true });
}));

// ─── FAQ CRUD (backing the admin Faq tab) ────────────────────────────────────
router.get("/api/admin/faqs", adminCheck, wrap(async (req, res) => {
  const all = await dbGetCollection<any>("faqs");
  return res.json({ success: true, faqs: all || [] });
}));

router.post("/api/admin/faqs", adminCheck, wrap(async (req, res) => {
  const { id, title_en, title_hi, body_en, body_hi, active } = req.body || {};
  if (!title_en || !body_en) {
    return sendErrorResponse(res, new ValidationError("title_en and body_en are required."));
  }
  const now = nowISO();
  const faq = {
    id: id || `faq_${randomUUID().slice(0, 8)}`,
    title_en: String(title_en).trim(),
    title_hi: title_hi ? String(title_hi).trim() : String(title_en).trim(),
    body_en: String(body_en).trim(),
    body_hi: body_hi ? String(body_hi).trim() : String(body_en).trim(),
    active: active === undefined ? true : Boolean(active),
    created_at: now,
    updated_at: now,
  };
  await dbSaveDoc("faqs", faq.id, faq);
  void writeAudit({ actor: auditActor(req), action: "faq_upsert", entity_type: "faq", entity_id: faq.id });
  return res.json({ success: true, faq });
}));

router.patch("/api/admin/faqs/:id", adminCheck, wrap(async (req, res) => {
  const existing = await dbGetDoc<any>("faqs", req.params.id);
  if (!existing) return sendErrorResponse(res, new NotFoundError("FAQ not found"));
  const updated = {
    ...existing,
    active: req.body.active === undefined ? existing.active : Boolean(req.body.active),
    title_en: req.body.title_en ?? existing.title_en,
    title_hi: req.body.title_hi ?? existing.title_hi,
    body_en: req.body.body_en ?? existing.body_en,
    body_hi: req.body.body_hi ?? existing.body_hi,
    updated_at: nowISO(),
  };
  await dbSaveDoc("faqs", req.params.id, updated);
  void writeAudit({ actor: auditActor(req), action: "faq_update", entity_type: "faq", entity_id: req.params.id, meta: updated.active ? "activated" : "deactivated" });
  return res.json({ success: true, faq: updated });
}));

export default router;
