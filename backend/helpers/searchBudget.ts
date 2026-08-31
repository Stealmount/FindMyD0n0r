// Shared status sets + donor search-budget helpers.
//
// Extracted out of matchingEngine.ts to BREAK the import cycle:
//   matchingEngine.ts  -> requestLifecycle.ts  (reconcileRequestLifecycle)
//   requestLifecycle.ts -> matchingEngine.ts   (TERMINAL_REQUEST_STATUSES, readSearchBudget)   [CYCLE]
// Now requestLifecycle imports these from HERE, and matchingEngine re-exports
// them so every existing `from "../services/matchingEngine"` import keeps working.

import { getUpstash, isUpstashConfigured, k } from "../src/lib/upstash";
import { MAX_DONOR_BUDGET } from "../src/types";
import { log } from "./logger";

// ─── Authoritative status sets ──────────────────────────────────────────────
// ponytail: single source of truth — worker was filtering only ["open","matching"],
// missing "broadcasting" and "partially_matched" entirely (P0 bug)
export const ACTIVE_REQUEST_STATUSES: readonly string[] = ["broadcasting", "matching", "open", "partially_matched", "secured", "search_exhausted"];

// Phase 3: consent on one terminal set. `closed` is included temporarily so
// legacy rows written before the sweepWorker 'closed'→'expired' switch stay
// terminal — remove after backfill-closed-to-expired has run in production.
export const TERMINAL_REQUEST_STATUSES: readonly string[] = ["cancelled", "fulfilled", "expired", "closed"];

// ─── Donor search budget (the 15-donor cap) ─────────────────────────────────
// search_tried:<req>  = SET of unique donor_ids that committed an invitation.
// search_budget:<req> = integer fast-path counter, capped at MAX_DONOR_BUDGET.
// Both are mutated in ONE atomic Lua op (SADD + INCR together) so they can never
// diverge; the owner gate reads the SET size (source of truth). Together they
// make "donor #16" impossible across every caller.
const SPEND_SCRIPT = `
local size = redis.call('SCARD', KEYS[1])
if size >= tonumber(ARGV[2]) then return 0 end
local added = redis.call('SADD', KEYS[1], ARGV[1])
if added == 1 then
  redis.call('INCR', KEYS[2])
end
return added
`;
// Non-Upstash fallback store (local/dev without Redis): keyed in-process only.
const memSearchTried = new Map<string, Set<string>>();

export function searchTriedKey(requestId: string): string {
  return k(`search_tried:${requestId}`);
}
export function searchBudgetKey(requestId: string): string {
  return k(`search_budget:${requestId}`);
}

/** Unique donors already committed an invitation for this request (0..15). */
export async function readSearchBudget(requestId: string): Promise<number> {
  if (isUpstashConfigured()) {
    try {
      const n = await getUpstash().scard(searchTriedKey(requestId));
      return Number(n ?? 0);
    } catch (e: any) {
      log.warn("Search-budget read failed; falling back to memory store", { requestId, err: e?.message });
    }
  }
  return memSearchTried.get(requestId)?.size ?? 0;
}

/**
 * Atomically spend the donor against the budget. Returns true if this was a NEW
 * donor (budget advanced), false if the donor was already spent (no double count).
 */
export async function spendDonorBudget(requestId: string, donorId: string): Promise<boolean> {
  if (isUpstashConfigured()) {
    try {
      const res = (await getUpstash().eval(
        SPEND_SCRIPT,
        [searchTriedKey(requestId), searchBudgetKey(requestId)],
        [donorId, String(MAX_DONOR_BUDGET)]
      )) as unknown;
      return Number(res) === 1;
    } catch (e: any) {
      log.warn("Search-budget spend failed; falling back to memory store", { requestId, donorId, err: e?.message });
    }
  }
  const set = memSearchTried.get(requestId) ?? new Set<string>();
  if (set.size >= MAX_DONOR_BUDGET) return false; // capped — no donor #16 (mirrors Lua)
  if (set.has(donorId)) return false;
  set.add(donorId);
  memSearchTried.set(requestId, set);
  return true;
}

/** Wipe the budget so a reopened request can search a fresh set of donors. */
export async function resetSearchBudget(requestId: string): Promise<void> {
  if (isUpstashConfigured()) {
    try {
      await getUpstash().del(searchTriedKey(requestId), searchBudgetKey(requestId));
    } catch (e: any) {
      log.warn("Search-budget reset failed; falling back to memory store", { requestId, err: e?.message });
    }
  }
  memSearchTried.delete(requestId);
}
