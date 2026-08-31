// Notification routes — extracted from server.ts (Phase 3 decomposition, 3.6.7)
// Owns: legacy send-email utility, WAHA WhatsApp webhook, notifications CRUD
import express, { Router } from "express";
import { getCollection as dbGetCollection, getDoc as dbGetDoc, saveDoc as dbSaveDoc } from "../src/lib/serverDb";
import { getDoc as storeGet, deleteDoc as storeDelete, mgetDocs as storeMget } from "../src/lib/store";
import { getUpstash, k } from "../src/lib/upstash";
import { cacheInvalidatePrefix } from "../src/lib/redisCache";
import { getAuthenticatedUser } from "../middleware/auth";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { normalizePhone } from "../helpers/phone";
import { nowISO } from "../helpers/time";
import { escapeHtml } from "../helpers/html";
import {
  sendWhatsApp,
  sendDonorWhatsApp,
  buildDonorConfirmedDetailsMessage,
  buildRequesterConfirmMessage,
  buildDonorDeclineAckMessage,
} from "../src/lib/waha";
import { buildRequesterConfirmEmailHTML, buildDonorConfirmedDetailsEmailHTML } from "../src/lib/email";
import { sendEmailViaResend } from "../services/notificationService";
import { matchAndNotifyRequest, TERMINAL_REQUEST_STATUSES, releaseDonorLock, declineMatchIfPending } from "../services/matchingEngine";
import { reconcileRequestLifecycle } from "../helpers/requestLifecycle";
import { claimUnitSlot, computeApprovedSlots } from "../helpers/capacityClaim";
import { sendErrorResponse, UnauthorizedError, ValidationError, ForbiddenError, ServiceUnavailableError } from "../helpers/errors";
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

// ─── POST /api/send-email — legacy client notification utility ───────────────
router.post("/api/send-email", rateLimitMiddleware(10, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser?.email) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));

  const { to, subject, text } = req.body || {};
  if (typeof to !== "string" || typeof subject !== "string" || typeof text !== "string") {
    return sendErrorResponse(res, new ValidationError("Missing: to, subject, text"));
  }
  const recipient = to.toLowerCase().trim();
  let recipientAllowed = recipient === "official@findmydonor.online" || recipient === authUser.email.toLowerCase();
  if (!recipientAllowed) {
    const linkedId = await getUpstash().hget(k("h:email_to_uid"), recipient);
    if (linkedId) recipientAllowed = Boolean(await storeGet("profiles", String(linkedId)));
  }
  if (!recipientAllowed) {
    return sendErrorResponse(res, new ForbiddenError("Email recipient is not registered."));
  }
  if (subject.length > 200 || text.length > 10_000) {
    return sendErrorResponse(res, new ValidationError("Email content is too long."));
  }

  const ok = await sendEmailViaResend(recipient, subject, `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`, text);
  if (!ok) return sendErrorResponse(res, new ServiceUnavailableError("Failed to send email message."));
  return res.json({ success: true, emailSent: true });
}));

// ─── POST /api/waha/webhook — donor YES/NO WhatsApp replies ──────────────────
router.post("/api/waha/webhook", wrap(async (req, res) => {
  res.status(200).send("OK"); // Ack immediately

  try {
    const event = req.body;
    if (!event || event.event !== "message") return;

    const from: string = event.payload?.from || "";
    const rawBody: string = (event.payload?.body || "").trim();
    const selectedId: string = (event.payload?.selectedButtonId || event.payload?.id || rawBody).trim();
    const upperBody: string = rawBody.toUpperCase();
    const phone = from.replace("@c.us", "").replace(/\D/g, "");

    const isYes = selectedId.includes("ACCEPT_") || upperBody === "YES" || upperBody.includes("CAN DONATE") || upperBody.includes("ACCEPT") || upperBody.includes("YES");
    const isNo  = selectedId.includes("DECLINE_") || upperBody === "NO" || upperBody.includes("NOT AVAILABLE") || upperBody.includes("DECLINE") || upperBody.includes("NO");

    if (!isYes && !isNo) return;

    const body = isYes ? "YES" : "NO";
    console.log(`[WAHA Webhook] Reply/Button from ${phone}: ${body} (raw: "${rawBody}", buttonId: "${selectedId}")`);

    let specificMatchId: string | null = null;
    if (selectedId.includes("ACCEPT_")) {
      specificMatchId = selectedId.split("ACCEPT_")[1]?.trim() || null;
    } else if (selectedId.includes("DECLINE_")) {
      specificMatchId = selectedId.split("DECLINE_")[1]?.trim() || null;
    }

    // Find donor by phone
    const allDonors = await dbGetCollection<User>("users");
    const donor = allDonors.find(
      (d) =>
        normalizePhone(d.whatsapp_number || "") === phone ||
        normalizePhone(d.phone) === phone
    );
    if (!donor) return;

    // Find their pending match (prefer specific match ID from button payload)
    const allMatches = await dbGetCollection<Match>("matches");
    // C-2: a specific button payload (ACCEPT_/DECLINE_<matchId>) may only address
    // the RESPONDING donor's OWN pending match — never another donor's row.
    const pendingMatch = specificMatchId
      ? (allMatches.find((m) => m.id === specificMatchId && m.donor_id === donor.id && m.donor_response === "pending") ||
         allMatches.find((m) => m.donor_id === donor.id && m.donor_response === "pending"))
      : allMatches.find((m) => m.donor_id === donor.id && m.donor_response === "pending");

    if (!pendingMatch) return;

    const request = await dbGetDoc<BloodRequest>(
      "blood_requests",
      pendingMatch.request_id
    );
    if (!request) return;

    if (body === "YES") {
      // Guard: only terminal requests reject new approvals — partial fulfilment
      // must keep accepting donors until units_confirmed reaches units_required.
      if (TERMINAL_REQUEST_STATUSES.includes(request.status)) {
        await dbSaveDoc("matches", pendingMatch.id, {
          ...pendingMatch,
          donor_response: "declined",
          donor_response_at: nowISO(),
          outcome: "request_closed"
        });
        await sendDonorWhatsApp(
          donor,
          "Thank you for responding! This emergency blood request has already been closed or fulfilled."
        );
        return;
      }

      // Guard: Check if approved matches already fulfill units_required
      // (read-based fast path — the final authority is the atomic claim below).
      const approvedMatches = allMatches.filter(
        (m) => m.request_id === pendingMatch.request_id && m.donor_response === "approved"
      );
      const unitsRequired = request.units_required || 1;
      if (approvedMatches.length >= unitsRequired) {
        await dbSaveDoc("matches", pendingMatch.id, {
          ...pendingMatch,
          donor_response: "declined",
          donor_response_at: nowISO(),
          outcome: "fulfilled_by_other"
        });
        await sendDonorWhatsApp(
          donor,
          "Thank you for responding! The required units for this emergency request have just been fulfilled by another donor nearby. We deeply appreciate your readiness to save lives!"
        );
        return;
      }

      // THE capacity claim: same atomic Redis Lua gate as the in-app approve
      // path. Only the winner may flip to approved and claim a unit slot.
      const claim = await claimUnitSlot({
        matchId: pendingMatch.id,
        requestId: pendingMatch.request_id,
        unitsRequired,
        approvedSlots: computeApprovedSlots(allMatches, pendingMatch.request_id),
        timestamp: nowISO(),
      });

      if (claim.status === "already_resolved") {
        // The atomic claim was already won (by this same YES or a concurrent
        // in-app/claim approval) — the match is `approved` with its slot. Never
        // downgrade an approved match to declined here. Reconcile the request's
        // derived counters for post-claim-window coherence, then give the donor
        // the fulfilled/closed courtesy instead of a duplicate success path.
        try {
          await reconcileRequestLifecycle(request.id, request.units_required || 1);
        } catch (e: any) {
          console.warn(`[Notifications] Reconcile on already-resolved YES failed for ${request.id}:`, e?.message);
        }
        await sendDonorWhatsApp(
          donor,
          "Thank you for responding! The required units for this emergency request have just been fulfilled by another donor nearby. We deeply appreciate your readiness to save lives!"
        );
        return;
      }

      if (claim.status === "terminal") {
        // Request closed/fulfilled/expired before the claim — mark the response
        // as an inert declined outcome (NEVER a live approval), courtesy-notify
        // the donor, and return. The match must not gain a valid approval path.
        await dbSaveDoc("matches", pendingMatch.id, {
          ...pendingMatch,
          donor_response: "declined",
          donor_response_at: nowISO(),
          outcome: "request_closed",
        });
        await sendDonorWhatsApp(
          donor,
          "Thank you for responding! This emergency blood request has already been closed or fulfilled."
        );
        return;
      }

      if (claim.status === "full") {
        await dbSaveDoc("matches", pendingMatch.id, {
          ...pendingMatch,
          donor_response: "declined",
          donor_response_at: nowISO(),
          outcome: "fulfilled_by_other",
        });
        await sendDonorWhatsApp(
          donor,
          "Thank you for responding! The required units for this emergency request have just been fulfilled by another donor nearby. We deeply appreciate your readiness to save lives!"
        );
        return;
      }

      if (claim.status === "not_found") {
        // Request or match missing from the authoritative store — no approval
        // can be created. Nothing to notify a donor about.
        return;
      }

      if (claim.status !== "ok") {
        return;
      }

      // The match was flipped to approved (with unit_slot) inside the atomic
      // claim — no further match write needed here.

      // Phase 2 + post-claim-window hardening: reconcile the request's derived
      // lifecycle counters from live approved matches (single source of derived
      // state, recovered on retry if the persist fails).
      try {
        await reconcileRequestLifecycle(request.id, request.units_required || 1);
      } catch (e: any) {
        console.warn(`[Notifications] Reconcile after claim failed for ${request.id}:`, e?.message);
      }

      // Notify donor confirmation with full requester details
      await sendDonorWhatsApp(
        donor,
        buildDonorConfirmedDetailsMessage(request, donor)
      );

      // Send confirmation email to donor with coordinator details
      if (donor.email) {
        try {
          const ep = buildDonorConfirmedDetailsEmailHTML(request, donor.full_name);
          await sendEmailViaResend(donor.email, ep.subject, ep.html, ep.text);
        } catch (e: any) {
          console.warn(`[Notifications] Donor confirmed details email failed for ${request.tracking_code}:`, e?.message);
        }
      }

      // Notify requester
      if (request.requester_phone) {
        const confirmMsg = buildRequesterConfirmMessage(request, donor.full_name);
        await sendWhatsApp(request.requester_phone, confirmMsg);
      }

      // Send confirmation email to requester
      if (request.requester_email) {
        const emailPayload = buildRequesterConfirmEmailHTML({
          requesterName: request.requester_name,
          donorName:     donor.full_name,
          bloodType:     request.blood_type_needed,
          trackingCode:  request.tracking_code,
          hospitalName:  request.hospital_name,
        });
        await sendEmailViaResend(
          request.requester_email,
          emailPayload.subject,
          emailPayload.html,
          emailPayload.text
        );
      }

      await cacheInvalidatePrefix("pending_matches_");
      await cacheInvalidatePrefix("req_status_");
      await cacheInvalidatePrefix("match_status_");

    } else {
      // Decline match — C-2: atomic + ownership-bound. Only THIS donor's own
      // pending match (pendingMatch already bounds donor_id) may be declined, and
      // only if it is still pending — never overwrite a concurrent approve/expire.
      const declined = await declineMatchIfPending(pendingMatch.id, nowISO());
      if (!declined) return; // already resolved concurrently — nothing to decline

      await sendDonorWhatsApp(
        donor,
        buildDonorDeclineAckMessage()
      );

      // Auto-find next donor — release this donor's reservation lock first so
      // the declined donor is free again; then route through the single owner
      // (matchAndNotifyRequest), which alone enforces the budget, pending-invite,
      // capacity, dedup and eligibility gates (no double-booking, no donor #16).
      await releaseDonorLock(donor.id, pendingMatch.request_id);
      await matchAndNotifyRequest(request);

      await cacheInvalidatePrefix("pending_matches_");
      await cacheInvalidatePrefix("req_status_");
    }
  } catch (err: any) {
    console.error("[WAHA Webhook] Error:", err?.message);
  }
}));

// ─── POST /api/notifications — legacy upsert ─────────────────────────────────
router.post("/api/notifications", wrap(async (req, res) => {
  if (req.body?.id) await dbSaveDoc("notifications", req.body.id, { ...req.body, created_at: nowISO() });
  return res.json({ success: true });
}));

// ─── DELETE /api/notifications/:notifId ──────────────────────────────────────
// ponytail: was completely unauthenticated — anyone could wipe all notifications.
// Now requires signed-in user; "all" is scoped to that user.
router.delete("/api/notifications/:notifId", wrap(async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return sendErrorResponse(res, new UnauthorizedError("Sign in to manage notifications."));
  const userId = user.id;
  try {
    if (req.params.notifId === "all") {
      // BUGFIX: writers tag notifications with recipient_id (matchingEngine,
      // admin-server, routes/admin) — the old read side filtered on user_id and
      // never matched. Now uses the maintained recipient index.
      const ids = await getUpstash().smembers(k(`s:notif:recipient:${userId}`));
      const idList = (ids as string[]) || [];
      if (idList.length > 0) {
        const docs = await storeMget<Record<string, unknown>>("notifications", idList);
        for (let i = 0; i < idList.length; i++) {
          if (docs[i] && String(docs[i].recipient_id) === userId) await storeDelete("notifications", idList[i]);
        }
      }
    } else {
      const doc = await storeGet<Record<string, unknown>>("notifications", req.params.notifId);
      if (doc && String(doc.recipient_id) === userId) {
        await storeDelete("notifications", req.params.notifId);
      }
    }
  } catch { /* ignore fallback */ }
  return res.json({ success: true });
}));

export default router;
