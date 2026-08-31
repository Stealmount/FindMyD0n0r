// Idempotent backfill for the lifecycle bug (donation-lifecycle.md Fix 2).
//
// Heals requests where a donation was recorded as `outcome:"donated"` but the
// request-keyed `donation_<matchId>` donation_log row was never written (the
// historical "admin hole"), leaving `units_completed` stale and the donor
// invisible in Donation History.
//
// For every match with outcome "donated" missing its log row it:
//   1. routes through the single completion producer (recordDonationCompletion)
//      — writes the idempotent `donation_<matchId>` log, applies the donor's
//      selected cooldown (60/90/120), marks the outcome.
//   2. re-derives the request's units_completed / status / fulfilled_at via
//      recomputeUnitsConfirmed and persists the corrected projection (monotonic:
//      completed never decreases). This is a one-time data-repair write — it does
//      NOT weaken the terminal guard in requestLifecycle.reconcileRequestLifecycle.
//
// Safe to re-run (recordDonationCompletion and the log key are idempotent).
//   DRY_RUN=1 npx tsx backend/scripts/backfill-completed-donations.ts   # preview
//   npx tsx backend/scripts/backfill-completed-donations.ts              # apply
//
// Do NOT deploy to VM or run against production without explicit approval.

await import('dotenv/config');

const DRY_RUN = process.env.DRY_RUN === '1';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.log('[backfill-completed-donations] no Upstash creds — nothing to do');
  process.exit(0);
}

const { getCollection, getDoc, saveDoc } = await import('../src/lib/serverDb');
const { recordDonationCompletion } = await import('../helpers/completionProvider');
const { recomputeUnitsConfirmed } = await import('../helpers/requestLifecycle');
const { cacheInvalidatePrefix } = await import('../src/lib/redisCache');

try {
  const [matches, logs] = await Promise.all([
    getCollection<any>('matches'),
    getCollection<any>('donation_log'),
  ]);

  const loggedMatchIds = new Set<string>((logs || []).map((l) => l.match_id).filter(Boolean));

  const repaired: any[] = [];
  const donors = new Map<string, any>();
  const requests = new Map<string, any>();

  for (const m of matches || []) {
    if (m?.outcome !== 'donated') continue;
    const logId = `donation_${m.id}`;
    if (loggedMatchIds.has(m.id) || loggedMatchIds.has(logId)) continue;

    let donor = donors.get(m.donor_id);
    if (!donor) { donor = await getDoc<any>('users', m.donor_id); donors.set(m.donor_id, donor); }
    if (!donor) { console.warn(`  skip ${m.id}: donor ${m.donor_id} not found`); continue; }

    const confirmedAt = m.outcome_confirmed_at || m.updated_at || new Date().toISOString();

    if (!DRY_RUN) {
      await recordDonationCompletion({
        matchId: m.id,
        requestId: m.request_id,
        donor,
        confirmedAt,
      });
    }
    repaired.push({ matchId: m.id, requestId: m.request_id, donorId: m.donor_id, confirmedAt });
  }

  // Repair units_completed for affected requests. This is strictly monotonic and
  // status-preserving: for an already-terminal request the reconcile guard
  // skipped persisting the new completed count after we wrote the donation_log.
  // We bump units_completed UPWARD and NEVER touch status (fulfilled/cancelled/
  // expired stay put — requestLifecycle's terminal guard is not weakened here;
  // a non-terminal request is already advanced to fulfilled by
  // recordDonationCompletion's own reconcile).
  const affectedRequestIds = new Set<string>(repaired.map((r) => r.requestId));
  const projectionWrites: any[] = [];
  for (const requestId of affectedRequestIds) {
    let req = requests.get(requestId);
    if (!req) { req = await getDoc<any>('blood_requests', requestId); requests.set(requestId, req); }
    if (!req) continue;
    const derived = await recomputeUnitsConfirmed(requestId, req.units_required || 1);
    const correctedCompleted = Math.max(derived.units_completed ?? 0, req.units_completed ?? 0);
    if (correctedCompleted <= (req.units_completed ?? 0)) continue;
    projectionWrites.push({
      requestId,
      from: { units_completed: req.units_completed ?? 0, status: req.status },
      to: { units_completed: correctedCompleted, status: req.status },
    });
    if (!DRY_RUN) {
      await saveDoc('blood_requests', requestId, {
        ...req,
        units_completed: correctedCompleted,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (!DRY_RUN) {
    await cacheInvalidatePrefix('req_status_');
    await cacheInvalidatePrefix('match_status_');
    await cacheInvalidatePrefix('pending_matches_');
    await cacheInvalidatePrefix('eligible_');
  }

  console.log(`[backfill-completed-donations] ${DRY_RUN ? 'DRY RUN — would repair' : 'repaired'} ${repaired.length} donated match(es); ` +
    `${projectionWrites.length} request projection(s) ${DRY_RUN ? 'would be' : ''}updated`);
  for (const r of repaired) console.log(`  ${DRY_RUN ? 'would write' : 'wrote'} donation_log for match ${r.matchId} (request ${r.requestId}, donor ${r.donorId})`);
  for (const p of projectionWrites) console.log(`  ${DRY_RUN ? 'would update' : 'updated'} request ${p.requestId}: units_completed ${p.from.units_completed}→${p.to.units_completed} (status kept ${p.to.status})`);
  console.log(`[backfill-completed-donations] ${DRY_RUN ? 'dry run complete' : 'done'}`);
} catch (err: any) {
  console.error('[backfill-completed-donations] failed:', err?.message || err);
  process.exit(1);
}
