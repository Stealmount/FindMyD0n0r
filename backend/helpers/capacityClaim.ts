// Atomic request-capacity claim — multi-unit correctness fix.
//
// A Redis Lua script runs in a single uninterruptible step to decide WHO may
// claim the next unit slot. It re-reads the live request and match documents
// inside Redis (not a JS snapshot) and enforces every guard atomically:
//
//   1. request exists and is not terminal / fulfilled
//   2. the match is still pending (pre-empts duplicate approvals)
//   3. remaining capacity > 0
//   4. exactly one unique lowest-free slot is claimed
//   5. approved contributions can never exceed units_required
//
// Because Lua executes without interleaving, two concurrent approvals for the
// final slot cannot both succeed — the loser observes the winner's SADD.
//
// The ledger is a per-request SET of claimed unit slots (append-only,
// authoritative for allocation). It is hydrated from approved matches before
// the claim; SADD is idempotent, so rows seeded directly into the store are
// always mirrored and the ledger self-heals after cache flushes.
//
// When Upstash is not configured (local dev / pure unit tests) there is no
// cross-process concurrency to protect, so we fall back to a best-effort JS
// lowest-free computation — but NEVER in production: a missing/misconfigured
// external store must fail loudly rather than silently dropping the atomic
// final-slot protection. The integration race tests that assert atomicity
// are gated on the real store being configured.

import { getUpstash, isUpstashConfigured, k } from "../src/lib/upstash";

export type ClaimOutcome =
  | { status: "ok"; slot: number; confirmed: number }
  | { status: "full" }
  | { status: "already_resolved" }
  | { status: "terminal" }
  | { status: "not_found" };

const slotsKey = (requestId: string) => k(`capslot:${requestId}`);
const matchDocKey = (matchId: string) => k(`matches:${matchId}`);
const requestDocKey = (requestId: string) => k(`blood_requests:${requestId}`);

const CLAIM_SCRIPT = `
local matchRaw = redis.call('GET', KEYS[1])
if not matchRaw then return {'error', 'match_not_found'} end
local m = cjson.decode(matchRaw)
if m.donor_response ~= 'pending' then return {'error', 'already_resolved'} end

local reqRaw = redis.call('GET', KEYS[2])
if not reqRaw then return {'error', 'request_not_found'} end
local req = cjson.decode(reqRaw)
if req.status == 'fulfilled' then return {'error', 'already_full'} end
local terminal = { ['cancelled']=1, ['fulfilled']=1, ['expired']=1, ['closed']=1 }
if terminal[req.status] then return {'error', 'terminal'} end

local used = redis.call('SMEMBERS', KEYS[3])
-- Prefer the LIVE units_required read from the request doc inside the atomic
-- unit: a stale JS-supplied ARGV[1] capacity snapshot can never widen or
-- narrow the guard. ARGV[1] is only a fallback for legacy rows that lack the field.
local required = tonumber(req.units_required) or tonumber(ARGV[1]) or 0
local slot = 1
while true do
  local taken = false
  for _, s in ipairs(used) do
    if tonumber(s) == slot then taken = true break end
  end
  if not taken then break end
  slot = slot + 1
end
if slot > required then return {'error', 'already_full'} end

m.donor_response = 'approved'
m.donor_response_at = ARGV[2]
m.contact_shared_at = ARGV[2]
m.unit_slot = slot
redis.call('SET', KEYS[1], cjson.encode(m))
redis.call('SADD', KEYS[3], slot)
return {'ok', slot, #used + 1}
`;

/**
 * The authoritative capacity claim. On success the match document itself has
 * been flipped to `approved` with its unit_slot inside the atomic unit.
 */
export async function claimUnitSlot(opts: {
  matchId: string;
  requestId: string;
  unitsRequired: number;
  approvedSlots: number[];
  timestamp: string;
}): Promise<ClaimOutcome> {
  const { matchId, requestId, unitsRequired, approvedSlots, timestamp } = opts;
  const ledgerKey = slotsKey(requestId);

  if (!isUpstashConfigured() && process.env.NODE_ENV !== "production") {
    // Best-effort local mode: no Redis means no cross-process racing.
    // Production deliberately skips this branch — getUpstash() below will throw
    // so a misconfigured deployment fails fast instead of approving atomically-unsafe.
    const taken = new Set(approvedSlots);
    let slot = 1;
    while (taken.has(slot)) slot++;
    if (slot > unitsRequired) return { status: "full" };
    return { status: "ok", slot, confirmed: taken.size + 1 };
  }

  const redis = getUpstash();

  // Hydrate the ledger with every approved slot the caller observed. Atomicity
  // of the final decision comes from the Lua script re-reading the live set.
  const members = approvedSlots.filter((s) => Number.isInteger(s) && s >= 1).map(String);
  if (members.length > 0) {
    const tuple = members as [string, ...string[]];
    await redis.sadd(ledgerKey, ...tuple);
  }

  const res = (await redis.eval(CLAIM_SCRIPT, [
    matchDocKey(matchId),
    requestDocKey(requestId),
    ledgerKey,
  ], [String(unitsRequired), timestamp])) as [string, number, number] | null;

  if (!res || res.length < 2) return { status: "full" };
  const code = res[0];
  if (code === "error") {
    // Lua reports { 'error', '<reason>' } — map the reason to the outcome.
    switch (String(res[1])) {
      case "already_full":
        return { status: "full" };
      case "already_resolved":
        return { status: "already_resolved" };
      case "terminal":
        return { status: "terminal" };
      default:
        return { status: "not_found" };
    }
  }
  switch (code) {
    case "ok":
      return { status: "ok", slot: Number(res[1]), confirmed: Number(res[2]) };
    case "already_full":
    case "full":
      return { status: "full" };
    case "already_resolved":
      return { status: "already_resolved" };
    case "terminal":
      return { status: "terminal" };
    default:
      return { status: "not_found" };
  }
}

export type MatchWithSlots = { request_id: string; donor_response: string; unit_slot?: number | null };

/**
 * Derives the full set of occupied unit slots for a request from a matches
 * snapshot. Approved rows missing a slot (legacy/manual seeds) occupy the
 * lowest free slot so the ledger never under-counts capacity.
 */
export function computeApprovedSlots(matches: MatchWithSlots[], requestId: string): number[] {
  const approved = matches.filter((m) => m.request_id === requestId && m.donor_response === "approved");
  const taken = new Set<number>();
  for (const m of approved) {
    if (m.unit_slot != null && Number.isInteger(Number(m.unit_slot))) taken.add(Number(m.unit_slot));
  }
  const slotless = approved.length - taken.size;
  if (slotless > 0) {
    let next = 1;
    for (let i = 0; i < slotless; i++) {
      while (taken.has(next)) next++;
      taken.add(next);
    }
  }
  return Array.from(taken).sort((a, b) => a - b);
}

// ─────────────────────────────────────────────────────────────────────────────
// Capacity release (the ONLY ledger writer that frees a slot)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Release an approved donor's claimed unit slot so the lowest-free-slot loop can
 * re-issue it. Called when an approved donor is authoritatively marked
 * `not_donated` (donation-not-completed). SREM is the only SREM against the
 * capslot ledger; the claim (SADD) is the only other writer, so the ledger stays
 * coherent and the request's open slots correctly re-open.
 */
const RELEASE_SCRIPT = `
local n = redis.call('SREM', KEYS[1], ARGV[1])
return n
`;

export async function releaseApprovedSlot(
  requestId: string,
  unitSlot: number | null | undefined
): Promise<void> {
  if (unitSlot == null || !Number.isInteger(Number(unitSlot))) return;
  if (!isUpstashConfigured()) return; // no real ledger in local best-effort mode
  const slot = String(unitSlot);
  const ledgerKey = slotsKey(requestId);

  try {
    await getUpstash().eval(RELEASE_SCRIPT, [ledgerKey], [slot]);
  } catch (e: any) {
    console.warn(`[Capacity] releaseApprovedSlot failed for request ${requestId} slot ${slot}:`, e?.message);
  }
}
