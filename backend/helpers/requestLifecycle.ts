// Single owner of partial-fulfilment accounting: counts approved matches,
// caps at units_required, and derives the next lifecycle state. All approval
// sites (in-app approve, WAHA webhook YES, manual fulfill) and the reopen
// path route through here so units_confirmed / status / fulfilled_at can
// never diverge (Phase 2 plan §13).

import { getCollection as dbGetCollection, getDoc as dbGetDoc, saveDoc as dbSaveDoc } from "../src/lib/serverDb";
import type { RequestStatus } from "../src/types";
import { TERMINAL_REQUEST_STATUSES } from "../services/matchingEngine";
import { nowISO } from "./time";

export interface LifecycleState {
  units_confirmed: number;
  status: RequestStatus;
  fulfilled_at: string | null;
}

export function nextLifecycle(
  units_required: number,
  approvedCount: number
): Pick<LifecycleState, "units_confirmed" | "status"> {
  const unitsConfirmed = Math.min(approvedCount, units_required);
  const status: RequestStatus =
    unitsConfirmed >= units_required
      ? "fulfilled"
      : approvedCount > 0
        ? "partially_matched"
        : "open";
  return { units_confirmed: unitsConfirmed, status };
}

export async function recomputeUnitsConfirmed(
  requestId: string,
  units_required: number
): Promise<LifecycleState> {
  const allMatches = await dbGetCollection<{ request_id: string; donor_response: string }>("matches");
  const approvedCount = allMatches.filter(
    (m) => m.request_id === requestId && m.donor_response === "approved"
  ).length;
  const { units_confirmed, status } = nextLifecycle(units_required, approvedCount);
  return {
    units_confirmed,
    status,
    fulfilled_at: status === "fulfilled" ? nowISO() : null,
  };
}

/**
 * Authoritative-coherence reconciliation for the post-atomic-claim write window
 * (approval hardening).
 *
 * The atomic Lua capacity claim is the single authority for ALLOCATION: it flips
 * the match document to approved and claims a slot in the ledger inside one
 * Redis step. The request's `units_confirmed` / `status` / `fulfilled_at` are a
 * DERIVED projection of those approved matches. If the process crashes, or a
 * write fails, between the claim and the request-doc persist, that projection
 * can lag the allocation (e.g. the last slot was approved but the request still
 * reads `partially_matched` / 4-of-5).
 *
 * This helper deterministically re-derives the projection from the live
 * approved matches and persists it — but ONLY while the request is still active.
 * A terminal request is never downgraded or touched, and this path never writes
 * to the capslot ledger nor re-claims capacity, so it can never double-allocate
 * or release an approved slot. It is idempotent: recomputation is a pure
 * function of live match state, and unchanged state is not written.
 *
 * Returns whether a write was performed and whether the request is active.
 * Persist failures are NOT swallowed here — the caller decides whether to
 * surface them (winner path) or to log-and-continue (idempotent retry path).
 */
export async function reconcileRequestLifecycle(
  requestId: string,
  units_required: number
): Promise<{ changed: boolean; active: boolean; status: RequestStatus; units_confirmed: number }> {
  const request = await dbGetDoc<{ status: RequestStatus; units_confirmed?: number }>(
    "blood_requests",
    requestId
  );
  if (!request) return { changed: false, active: false, status: "open", units_confirmed: 0 };
  if (TERMINAL_REQUEST_STATUSES.includes(request.status)) {
    // A closed/fufilled/expired request must never be re-opened by reconciliation.
    return {
      changed: false,
      active: false,
      status: request.status,
      units_confirmed: request.units_confirmed ?? 0,
    };
  }
  const lifecycle = await recomputeUnitsConfirmed(requestId, units_required);
  const current = request.units_confirmed ?? 0;
  const changed = lifecycle.units_confirmed !== current || lifecycle.status !== request.status;
  if (changed) {
    // Test-only fault seam: NODE_ENV=test / TEST_MODE=1 with
    // TEST_FAULT_RECONCILE=requestId (or '*') makes the derived projection
    // persist throw — deterministically simulating a post-claim DB write
    // failure so regression tests can prove the recovery/retry converges.
    if (
      (process.env.NODE_ENV === "test" || process.env.TEST_MODE === "1") &&
      process.env.TEST_FAULT_RECONCILE
    ) {
      const targets = process.env.TEST_FAULT_RECONCILE;
      if (targets === "*" || targets.split(",").includes(requestId)) {
        throw new Error(`[test] injected reconcile persist fault (${requestId})`);
      }
    }
    await dbSaveDoc("blood_requests", requestId, {
      ...request,
      units_confirmed: lifecycle.units_confirmed,
      status: lifecycle.status,
      ...(lifecycle.status === "fulfilled" ? { fulfilled_at: lifecycle.fulfilled_at } : {}),
      updated_at: nowISO(),
    } as unknown as Record<string, unknown>);
  }
  return {
    changed,
    active: true,
    status: lifecycle.status,
    units_confirmed: lifecycle.units_confirmed,
  };
}