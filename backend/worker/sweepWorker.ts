/**
 * Background Match Worker — sweep loop logic (extracted from server.ts, Phase 3.7).
 *
 * Runs every 2 minutes (scheduled from server.ts) to:
 *   1. Close expired requests
 *   2. Auto-expire stale pending matches (>30 min with no donor reply)
 *   3. Re-run matching for all open/matching requests (catches new donors)
 *
 * The worker is still started from server.ts via setTimeout/setInterval —
 * this file only owns the sweep logic (no separate process; that is Phase 6).
 */

import { randomUUID } from "node:crypto";
import { cacheSetNX, cacheDel } from "../src/lib/redisCache";
import { getCollection as dbGetCollection, saveDoc as dbSaveDoc } from "../src/lib/serverDb";
import { nowISO } from "../helpers/time";
import { log } from "../helpers/logger";
import { enqueueWhatsApp } from "../services/notificationService";
import { reconcileActiveRequestLifecycles } from "../helpers/sweepReconcile";
import type { BloodRequest, Match } from "../src/types";
import {
  ACTIVE_REQUEST_STATUSES,
  matchAndNotifyRequest,
  releaseDonorLock,
  expireMatchIfPending,
  transitionRequestStatusIfActive,
} from "../services/matchingEngine";
import { INVITATION_TIMEOUT_MINUTES } from "../src/types";

// Append-only audit trail — writes to request_events collection
async function logRequestEvent(requestId: string, event: string, actor: string = "system") {
  try {
    const id = randomUUID();
    const record = { id, request_id: requestId, event, actor, at: nowISO() };
    await dbSaveDoc("request_events", id, record as unknown as Record<string, unknown>);
  } catch (e: any) {
    log.error("Audit event write failed", { requestId, err: e?.message });
  }
}

const WORKER_LOCK_KEY = "bg_worker_running";
const WORKER_LOCK_TTL_S = 120; // 2 minutes — prevents overlapping runs
const STALE_MATCH_MINUTES = 30; // backstop: auto-expire pending matches older than 30 min (see Step 2)

export async function runBackgroundMatchWorker() {
  // Acquire a Redis lock to prevent overlapping runs (e.g. PM2 cluster)
  const acquired = await cacheSetNX(WORKER_LOCK_KEY, "1", WORKER_LOCK_TTL_S);
  if (!acquired) {
    log.info("Worker skipped — previous run still active", { lockKey: WORKER_LOCK_KEY });
    return;
  }

  try {
    const now = new Date();
    const allRequests = await dbGetCollection<BloodRequest>("blood_requests");
    const activeRequests = allRequests.filter(r => ACTIVE_REQUEST_STATUSES.includes(r.status));

    let closedCount = 0;
    let matchedTotal = 0;
    let staleExpired = 0;

    // ——— Step 1: Close expired requests ———
    // Status is written as "expired" (unified terminal value; legacy rows still
    // carrying "closed" are backfilled by scripts/backfill-closed-to-expired.ts,
    // and both values are covered by TERMINAL_REQUEST_STATUSES).
    for (const req of activeRequests) {
      if (req.expires_at && new Date(req.expires_at) < now) {
        // Phase 8 hardening: a full-doc overwrite of this (potentially stale)
        // snapshot could clobber a request the requester closed mid-sweep back
        // into an active state. The atomic transition refuses already-terminal
        // documents; on refusal, skip the cleanup broadcast — the closer already
        // retired this request's pendings and freed its locks.
        const bumped = await transitionRequestStatusIfActive(req.id, "expired", {});
        if (!bumped) {
          log.info("Worker skip expire — request no longer active in store (closed concurrently)", {
            requestId: req.id,
            trackingCode: req.tracking_code,
          });
          continue;
        }

        // Release all donor locks for this request's pending matches
        const allMatches = await dbGetCollection<Match>("matches");
        const pendingForReq = allMatches.filter(
          m => m.request_id === req.id && m.donor_response === "pending"
        );
        for (const m of pendingForReq) {
          await releaseDonorLock(m.donor_id, m.request_id);
          await dbSaveDoc("matches", m.id, {
            ...m,
            donor_response: "expired",
            donor_response_at: nowISO(),
          } as unknown as Record<string, unknown>);
        }

        closedCount++;
        console.log(`[Worker] Expired ${req.tracking_code} (units ${req.units_confirmed ?? 0}/${req.units_required}, search_batch ${req.search_batch ?? 0}, status→expired)`);
        logRequestEvent(req.id, "auto_closed_expired", "worker").catch(() => {});
        continue; // skip matching for expired requests
      }
    }

    // ——— Step 1b: Eventual post-claim reconciliation ———
    // The atomic Lua capacity claim is authoritative for ALLOCATION, while the
    // request's units_confirmed/status/fulfilled_at are a DERIVED projection.
    // If the process crashes or the projection persist fails between the claim
    // and the request-doc write — and the original donor never retries — the
    // projection could stay stale indefinitely. This reuses the canonical
    // reconcileRequestLifecycle() (via helpers/sweepReconcile) to converge any
    // diverged active projection back to the authoritative approved matches.
    // It is idempotent, never allocates capacity, never touches the capslot
    // ledger, never reopens terminal requests, and never releases approved
    // slots. Recovery therefore never depends on the donor retry.
    try {
      const rec = await reconcileActiveRequestLifecycles();
      if (rec.failed > 0) {
        log.warn("Reconciliation encountered failures this cycle", { failed: rec.failed });
      }
    } catch (e: any) {
      log.error("Reconciliation sweep failed", { err: e?.message });
    }

    // ——— Step 2: Auto-expire stale pending matches after the 5-min donor response
    // window, then advance the single owner (sequential 5 → 5 → 5 model). STALE_MATCH_MINUTES
    // (30) remains the documented backstop for a delayed/overlapping worker — the same
    // loop catches any pending invite older than 5 min, so a longer wait is redundant.
    const allMatches = await dbGetCollection<Match>("matches");
    const staleThreshold = new Date(now.getTime() - INVITATION_TIMEOUT_MINUTES * 60 * 1000);

    for (const match of allMatches) {
      if (
        match.donor_response === "pending" &&
        match.created_at &&
        new Date(match.created_at) < staleThreshold
      ) {
        // C-1: expire only if the LIVE match is still pending. A donor who
        // approved concurrently (atomic claim) must never have their approval
        // overwritten back to expired by this stale worker snapshot.
        const transitioned = await expireMatchIfPending(match.id, nowISO());
        if (!transitioned) continue;

        await releaseDonorLock(match.donor_id, match.request_id);
        staleExpired++;

        // Auto-cascade: try to find the next donor for this request
        const request = allRequests.find(r => r.id === match.request_id);
        if (request && ACTIVE_REQUEST_STATUSES.includes(request.status)) {
          try {
            await matchAndNotifyRequest(request);
          } catch (e: any) {
            console.error(`[Worker] Cascade failed for request ${match.request_id}:`, e.message);
          }
        }
      }
    }

    // ——— Step 2b: SLA notification — if request >15 min old and no donor approved, WhatsApp requester
    const slaCutoff = new Date(now.getTime() - 15 * 60 * 1000);
    for (const req of allRequests) {
      if (!ACTIVE_REQUEST_STATUSES.includes(req.status)) continue;
      if (new Date(req.created_at) > slaCutoff) continue; // too new

      // Check if any match for this request has donor_response === "approved"
      const requestMatches = allMatches.filter(m => m.request_id === req.id);
      const hasApproved = requestMatches.some(m => m.donor_response === "approved");
      if (hasApproved) continue;

      // Guard: only send once per request (6h TTL)
      const slaKey = `sla_notified_${req.id}`;
      const alreadyNotified = await cacheSetNX(slaKey, "1", 6 * 60 * 60);
      if (!alreadyNotified) continue;

      const totalNotified = requestMatches.length;
      const phone = req.requester_phone;
      if (phone) {
        const confirmed = req.units_confirmed ?? requestMatches.filter(m => m.donor_response === "approved").length;
        const text = `Still searching for ${req.blood_type_needed} (${confirmed}/${req.units_required} units confirmed, ${totalNotified} donors notified).`;
        // Non-critical notification → async via the messaging queue (Phase 3.8).
        await enqueueWhatsApp(phone, text).catch(e => console.error("[Worker] SLA WhatsApp enqueue failed:", e.message));
        logRequestEvent(req.id, "sla_notified", "worker").catch(() => {});
      }
    }

    // ——— Step 3: Re-run matching for all still-active requests ———
    const stillActive = allRequests.filter(
      r => ACTIVE_REQUEST_STATUSES.includes(r.status) &&
           (!r.expires_at || new Date(r.expires_at) >= now)
    );

    for (const req of stillActive) {
      try {
        const result = await matchAndNotifyRequest(req);
        matchedTotal += result.matched;
      } catch (e: any) {
        console.error(`[Worker] Match failed for ${req.tracking_code}:`, e.message);
      }
    }

    // ——— Step 4: Trigger e-RaktKosh Blood Bank & Camps Sync ———
    try {
      const { syncBloodBanks, syncCamps } = await import("../services/eraktkoshSyncService");
      await syncBloodBanks().catch(e => console.warn("[Worker] Blood bank sync warning:", e.message));
      await syncCamps().catch(e => console.warn("[Worker] Camp sync warning:", e.message));
    } catch (e: any) {
      console.warn("[Worker] e-RaktKosh sync module notice:", e.message);
    }

    console.log(
      `[Worker] Sweep complete — ` +
      `checked ${stillActive.length} request(s), ` +
      `${matchedTotal} new match(es), ` +
      `${closedCount} expired request(s) closed, ` +
      `${staleExpired} stale match(es) auto-expired`
    );
  } catch (err: any) {
    log.error("Worker fatal error", { err: err.message });
  } finally {
    // Always release the lock so next run can proceed
    await cacheDel(WORKER_LOCK_KEY);
  }
}
