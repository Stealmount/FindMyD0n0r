// Single owner of fulfillment accounting: counts approved matches (secured),
// counts completed donations (units_completed), and derives the next lifecycle
// status from units_required + secured + completed + search budget (D3/D4).
// All approval sites (in-app approve, WAHA webhook YES, manual fulfill),
// completion sites (confirm-donation, provider), and the reopen path route
// through here so units_confirmed / units_completed / status / fulfilled_at
// can never diverge.

import {
  getCollection as dbGetCollection,
  getDoc as dbGetDoc,
  saveDoc as dbSaveDoc,
} from "../src/lib/serverDb";
import type { DonationLog, RequestStatus } from "../src/types";
import { MAX_DONOR_BUDGET } from "../src/types";
import { TERMINAL_REQUEST_STATUSES, readSearchBudget } from "./searchBudget";
import { nowISO } from "./time";

export interface LifecycleState {
  units_confirmed: number;
  units_completed: number;
  status: RequestStatus;
  fulfilled_at: string | null;
}

/**
 * Pure status-machine (D3).
 * - completed >= required          -> fulfilled (terminal)
 * - secured >= required            -> secured  (fully reserved, awaiting donation; NOT terminal)
 * - budget >= MAX_DONOR_BUDGET     -> search_exhausted (NOT terminal)
 * - 0 < secured < required         -> partially_matched
 * - secured == 0                   -> open
 */
export function nextLifecycle(
  units_required: number,
  securedCount: number,
  completedCount: number,
  budget: number
): Pick<LifecycleState, "units_confirmed" | "units_completed" | "status"> {
  const secured = Math.min(securedCount, units_required);
  const completed = Math.min(completedCount, units_required);
  let status: RequestStatus;
  if (completed >= units_required) {
    status = "fulfilled";
  } else if (secured >= units_required) {
    status = "secured";
  } else if (budget >= MAX_DONOR_BUDGET) {
    status = "search_exhausted";
  } else if (secured > 0) {
    status = "partially_matched";
  } else {
    status = "open";
  }
  return { units_confirmed: secured, units_completed: completed, status };
}

async function countRequestMatches(requestId: string): Promise<number> {
  const allMatches = await dbGetCollection<{ request_id: string; donor_response: string }>("matches");
  return allMatches.filter((m) => m.request_id === requestId && m.donor_response === "approved").length;
}

async function countRequestCompleted(requestId: string): Promise<number> {
  const allLogs = await dbGetCollection<DonationLog>("donation_log");
  // O2 default (i): only request-keyed donations count toward units_completed.
  return allLogs.filter((l) => l.request_id === requestId).length;
}

export async function recomputeUnitsConfirmed(
  requestId: string,
  units_required: number
): Promise<LifecycleState> {
  const [securedCount, completedCount, budget] = await Promise.all([
    countRequestMatches(requestId),
    countRequestCompleted(requestId),
    readSearchBudget(requestId),
  ]);
  const { units_confirmed, units_completed, status } = nextLifecycle(
    units_required,
    securedCount,
    completedCount,
    budget
  );
  return {
    units_confirmed,
    units_completed,
    status,
    fulfilled_at: status === "fulfilled" ? nowISO() : null,
  };
}

/**
 * Authoritative-coherence reconciliation for the post-atomic write window.
 *
 * The atomic Lua capacity claim is the single authority for ALLOCATION (it flips
 * the match to approved and claims a slot in the ledger inside one Redis step);
 * the unit-slot release and donation-completion provider are the authority for
 * capacity/fulfillment moves. The request's `units_confirmed` / `units_completed`
 * / `status` / `fulfilled_at` are a DERIVED projection of those authoritative
 * sources. If the process crashes between the atomic move and the request-doc
 * persist, that projection can lag.
 *
 * This helper deterministically re-derives the projection from the live sources
 * and persists it — but ONLY while the request is still active. A terminal
 * request is never downgraded or touched, and this path never writes to the
 * capslot ledger, so it can never double-allocate or release an approved slot.
 * It is idempotent: recomputation is a pure function of live state, and
 * unchanged state is not written. `secured` and `search_exhausted` are NOT
 * terminal — a request in those states is still reconciled (e.g. `secured`
 * advances to `fulfilled` once donations complete).
 */
export async function reconcileRequestLifecycle(
  requestId: string,
  units_required: number
): Promise<{
  changed: boolean;
  active: boolean;
  status: RequestStatus;
  units_confirmed: number;
  units_completed: number;
}> {
  const request = await dbGetDoc<{
    status: RequestStatus;
    units_confirmed?: number;
    units_completed?: number;
  }>("blood_requests", requestId);
  if (!request) {
    return { changed: false, active: false, status: "open", units_confirmed: 0, units_completed: 0 };
  }
  if (TERMINAL_REQUEST_STATUSES.includes(request.status)) {
    // A closed/fulfilled/expired request must never be re-opened by reconciliation.
    return {
      changed: false,
      active: false,
      status: request.status,
      units_confirmed: request.units_confirmed ?? 0,
      units_completed: request.units_completed ?? 0,
    };
  }
  const lifecycle = await recomputeUnitsConfirmed(requestId, units_required);
  const currentConfirmed = request.units_confirmed ?? 0;
  const currentCompleted = request.units_completed ?? 0;
  const changed =
    lifecycle.units_confirmed !== currentConfirmed ||
    lifecycle.units_completed !== currentCompleted ||
    lifecycle.status !== request.status;
  if (changed) {
    // Test-only fault seam (unchanged behavior).
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
      units_completed: lifecycle.units_completed,
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
    units_completed: lifecycle.units_completed,
  };
}
