// Eventual post-claim reconciliation — the sweep worker's maintenance entry.
//
// The atomic Lua capacity claim is authoritative for ALLOCATION while the
// request's units_confirmed/status/fulfilled_at are a DERIVED projection of the
// approved matches. If the process crashes, or the projection persist fails,
// between the claim and the request-doc write — and the original donor never
// retries and no duplicate WAHA callback arrives — the projection can stay
// stale indefinitely. This is the automated safety net: it re-runs the
// canonical reconcileRequestLifecycle() (the single owner of derived lifecycle
// math) over every active request so recovery never depends on the donor retry.
//
// It is idempotent, never allocates capacity, never touches the capslot ledger,
// never reopens terminal requests, and never releases approved slots. Structured
// logs only fire when a projection is actually reconciled or reconciliation
// fails — silent no-ops are not logged.
//
// The sweep worker (backend/worker/sweepWorker.ts) calls this every cycle under
// its existing worker lock; tests call it directly to prove convergence.

import { getCollection as dbGetCollection } from "../src/lib/serverDb";
import { log } from "./logger";
import { reconcileRequestLifecycle } from "./requestLifecycle";
import { ACTIVE_REQUEST_STATUSES } from "../services/matchingEngine";
import type { BloodRequest } from "../src/types";

async function activeRequests(): Promise<BloodRequest[]> {
  const all = await dbGetCollection<BloodRequest>("blood_requests");
  return (all || []).filter((r) => r && ACTIVE_REQUEST_STATUSES.includes(r.status));
}

/**
 * Reconcile the derived lifecycle projection of every active request.
 * Returns { reconciled, failed }. Never throws — individual failures are logged
 * (not swallowed) and do not stop the sweep.
 */
export async function reconcileActiveRequestLifecycles(): Promise<{
  reconciled: number;
  failed: number;
}> {
  const requests = await activeRequests();
  let reconciled = 0;
  let failed = 0;

  for (const req of requests) {
    try {
      const outcome = await reconcileRequestLifecycle(req.id, req.units_required);
      if (outcome.changed) {
        reconciled++;
        log.info("Reconciled request lifecycle projection", {
          requestId: req.id,
          trackingCode: req.tracking_code,
          status: outcome.status,
          units_confirmed: outcome.units_confirmed,
        });
      }
    } catch (e: any) {
      failed++;
      log.error("Reconciliation failed — surface, do not swallow", {
        requestId: req.id,
        err: e?.message,
      });
    }
  }

  if (reconciled > 0) {
    console.log(`[Worker] Reconciled ${reconciled} derived request lifecycle projection(s)`);
  }
  return { reconciled, failed };
}
