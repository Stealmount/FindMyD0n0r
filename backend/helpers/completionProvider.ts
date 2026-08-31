// Single provider for donation completion / non-completion. Converges every
// completion source (platform confirm-donation; future admin routing) on the
// SAME invariant maintenance: match outcome + donation_log + donor cooldown,
// then `units_completed` / status derivation via the reconcile umbrella (D6).
//
// units_completed is DERIVED from donation_log rows keyed by request_id (O2
// default i), so retries are exactly-once: the `donation_<matchId>` key is
// idempotent and reconcile counts unique request-keyed rows.

import {
  getDoc as dbGetDoc,
  saveDoc as dbSaveDoc,
} from "../src/lib/serverDb";
import type { BloodRequest, DonationLog, Match, User } from "../src/types";
import { MAX_DONOR_BUDGET } from "../src/types";
import { nowISO, resolveCooldownDays, computeCooldownUntil } from "./time";
import { reconcileRequestLifecycle } from "./requestLifecycle";
import { releaseApprovedSlot } from "./capacityClaim";
import { matchAndNotifyRequest } from "../services/matchingEngine";
import { readSearchBudget } from "../services/matchingEngine";
import { cacheInvalidatePrefix } from "../src/lib/redisCache";

export async function recordDonationCompletion(opts: {
  matchId: string;
  requestId: string;
  donor: User;
  confirmedAt: string;
}): Promise<{ already: boolean }> {
  const { matchId, requestId, donor, confirmedAt } = opts;
  const [match, log] = await Promise.all([
    dbGetDoc<Match>("matches", matchId),
    dbGetDoc<DonationLog>("donation_log", `donation_${matchId}`),
  ]);
  if (!match) return { already: false };

  const donationDate = confirmedAt.split("T")[0];
  const cooldownEnd = computeCooldownUntil(donationDate, resolveCooldownDays(donor));

  // C-7: the deterministic `donation_<matchId>` log row is the authority for
  // "already completed" — NOT `match.outcome`. A partial write that set the match
  // outcome but lost the log can no longer short-circuit into a permanent
  // undercount; a retry re-enters this branch and heals the missing companions.
  if (log) {
    await Promise.all([
      dbSaveDoc("matches", matchId, {
        ...match,
        outcome: "donated",
        outcome_confirmed_at: confirmedAt,
      }),
      dbSaveDoc("users", donor.id, {
        ...donor,
        cooldown_until: cooldownEnd,
        account_status: "cooldown",
        updated_at: nowISO(),
      }),
    ]);
    await cacheInvalidatePrefix("match_status_");
    await cacheInvalidatePrefix("pending_matches_");
    await cacheInvalidatePrefix("req_status_");
    await cacheInvalidatePrefix("eligible_");
    return { already: true };
  }

  // First completion: write the donation_log row FIRST (exists-once, idempotent
  // key — it is what reconcile counts), then the match outcome + donor cooldown.
  // If the process crashes after the log write, a retry heals the companions via
  // the branch above; accounting is never lost because the log is authoritative.
  await dbSaveDoc("donation_log", `donation_${matchId}`, {
    id: `donation_${matchId}`,
    donor_id: donor.id,
    match_id: matchId,
    request_id: requestId,
    donation_date: donationDate,
    source: "platform_match",
    notes: "Confirmed via platform",
    created_at: nowISO(),
  });

  await Promise.all([
    dbSaveDoc("matches", matchId, {
      ...match,
      outcome: "donated",
      outcome_confirmed_at: confirmedAt,
    }),
    dbSaveDoc("users", donor.id, {
      ...donor,
      cooldown_until: cooldownEnd,
      account_status: "cooldown",
      updated_at: nowISO(),
    }),
  ]);

  // Derive units_completed / status → fulfilled when completed >= required.
  const request = await dbGetDoc<BloodRequest>("blood_requests", requestId);
  if (request) {
    await reconcileRequestLifecycle(requestId, request.units_required || 1);
  }

  await cacheInvalidatePrefix("match_status_");
  await cacheInvalidatePrefix("pending_matches_");
  await cacheInvalidatePrefix("req_status_");
  await cacheInvalidatePrefix("eligible_");
  return { already: false };
}

export async function recordDonationNotCompleted(opts: {
  matchId: string;
  requestId: string;
}): Promise<void> {
  const { matchId, requestId } = opts;
  const match = await dbGetDoc<Match>("matches", matchId);
  if (!match) return;
  if (match.outcome === "not_donated") return; // idempotent

  await dbSaveDoc("matches", matchId, {
    ...match,
    outcome: "not_donated",
    // Dissolve the reservation: an approved slot that fails to donate no
    // longer counts toward secured, so capacity + derived status re-open. Only
    // an APPROVED row is dissolved — a pending/timed_out match is left as-is.
    donor_response: match.donor_response === "approved" ? "declined" : match.donor_response,
    outcome_confirmed_at: nowISO(),
  });

  // Release the claimed slot so capacity re-opens (D7).
  await releaseApprovedSlot(requestId, match.unit_slot);

  await cacheInvalidatePrefix("match_status_");
  await cacheInvalidatePrefix("pending_matches_");

  // Reconcile may drop the request from `secured` back to searchable, then
  // advance the owner for the next donor — gated by budget + capacity + pending.
  const request = await dbGetDoc<BloodRequest>("blood_requests", requestId);
  if (!request) return;
  // Use the freshly-derived state from reconcile (never the pre-reconcile
  // snapshot's stale units_confirmed — the approved→declined dissolve above may
  // have just dropped secured).
  const road = await reconcileRequestLifecycle(requestId, request.units_required || 1);
  if (road.status === "fulfilled" || road.status === "secured") return;

  const budget = await readSearchBudget(requestId);
  if (road.units_confirmed < (request.units_required || 1) && budget < MAX_DONOR_BUDGET) {
    await matchAndNotifyRequest(request).catch((e: any) =>
      console.error(`[Provider] Owner advance after not_donated failed for ${requestId}:`, e?.message)
    );
  }
  await cacheInvalidatePrefix("req_status_");
}
