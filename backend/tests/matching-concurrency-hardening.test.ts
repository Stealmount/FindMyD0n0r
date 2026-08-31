/**
 * Final matching-concurrency hardening — regression suite.
 *
 * Targets the two remaining race windows directly against the real store
 * (shared fmdt: namespace), the same way capacity-race.test.ts and
 * close-hardening.test.ts do:
 *
 *   1. POST-ATOMIC-CLAIM WRITE WINDOW — the atomic Lua capacity claim
 *      (claimUnitSlot) is the single authority for allocation: it flips the
 *      match doc to approved and claims a slot in the ledger in one Redis
 *      step. The request's units_confirmed/status are a DERIVED projection
 *      persisted afterwards. If that post-claim persist fails (or the process
 *      crashes), the projection can lag the allocation. These tests prove the
 *      allocation is never orphaned/lost/double-exhausted and that the
 *      reconciliation path (reconcileRequestLifecycle) reconstructs coherent
 *      state on retry/recovery.
 *
 *   2. TERMINAL GATE VS NOTIFICATION DELIVERY RACE — a request that passes the
 *      pre-notify live gate can still be closed a moment later; the
 *      delivery-time guard inside notifyDonor re-reads the authoritative store
 *      immediately before dispatch and suppresses unsent invites, which are
 *      then rolled back. Stale notifications (already sent before a close)
 *      cannot create a valid approval/claim path.
 *
 * Run (store configured; flush between suites):
 *   node_modules/.bin/tsx --test --test-force-exit backend/tests/matching-concurrency-hardening.test.ts
 */
import 'dotenv/config';
import './setup-env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { saveDoc as dbSaveDoc, deleteDoc as dbDeleteDoc, getDoc as dbGetDoc, getCollection as dbGetCollection, isFirebaseConfigured } from '../src/lib/serverDb';
import { cacheGet } from '../src/lib/redisCache';
import { getUpstash, k } from '../src/lib/upstash';
import { approveMatchById } from '../routes/matching';
import { claimUnitSlot, computeApprovedSlots } from '../helpers/capacityClaim';
import { reconcileRequestLifecycle } from '../helpers/requestLifecycle';
import { matchAndNotifyRequest, TERMINAL_REQUEST_STATUSES } from '../services/matchingEngine';
import { nowISO } from '../helpers/time';
import type { BloodRequest } from '../src/types';

let seq = 0;
const tag = () => `mch${process.pid}_${Date.now()}_${++seq}`;

function testRequest(unitsRequired: number, status: string, unitsConfirmed: number): BloodRequest {
  const id = `req_${tag()}`;
  return {
    id,
    tracking_code: `BLD-MCH-${tag()}`,
    patient_name: 'MCH Patient',
    blood_type_needed: 'O+',
    units_required: unitsRequired,
    hospital_name: 'MCH Hospital',
    hospital_pincode: '110001',
    hospital_area: 'Delhi',
    hospital_city: 'New Delhi',
    urgency_level: 'urgent',
    requester_name: 'MCH Requester',
    requester_phone: '',
    requester_email: '',
    additional_notes: '',
    status: status as BloodRequest['status'],
    units_confirmed: unitsConfirmed,
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    fulfilled_at: null,
    search_batch: 0,
    created_at: nowISO(),
  };
}

async function seedUser(id: string) {
  await dbSaveDoc('users', id, {
    id,
    phone: `91999${String(Math.abs(id.length * 7) % 100000000).padStart(8, '0')}`,
    full_name: `Donor ${id}`,
    blood_type: 'O+',
    pincode: '110001',
    availability_status: 'available',
    account_status: 'active',
    created_at: nowISO(),
    updated_at: nowISO(),
  } as unknown as Record<string, unknown>);
}

/**
 * Seed a donor across every collection the matching engine reads (users,
 * profiles, donor_profiles) so the index-backed eligibility path can find them.
 * The pincode must share the hospital pincode's 3-digit prefix (index path).
 */
async function seedEligibleDonor(id: string) {
  await dbSaveDoc('users', id, {
    id,
    phone: `91999${String(Math.abs(id.length * 7) % 100000000).padStart(8, '0')}`,
    full_name: `Donor ${id}`,
    blood_type: 'O+',
    pincode: '110001',
    whatsapp_number: `91999${String(Math.abs(id.length * 7) % 100000000).padStart(8, '0')}`,
    availability_status: 'available',
    account_status: 'active',
    created_at: nowISO(),
    updated_at: nowISO(),
  } as unknown as Record<string, unknown>);
  await dbSaveDoc('profiles', id, {
    id,
    full_name: `Donor ${id}`,
    email: `${id}@example.local`,
    phone: `91999${String(Math.abs(id.length * 7) % 100000000).padStart(8, '0')}`,
    trust_report_count: 0,
    created_at: nowISO(),
    updated_at: nowISO(),
  } as unknown as Record<string, unknown>);
  await dbSaveDoc('donor_profiles', `dprof_${id}`, {
    id: `dprof_${id}`,
    profile_id: id,
    blood_group: 'O+',
    pincode: '110001',
    is_available: true,
    emergency_only: false,
    cooldown_until: null,
  } as unknown as Record<string, unknown>);
}

async function seedMatch(id: string, requestId: string, donorId: string, response: 'approved' | 'pending', slot?: number) {
  const now = nowISO();
  await dbSaveDoc('matches', id, {
    id,
    request_id: requestId,
    donor_id: donorId,
    donor_response: response,
    donor_response_at: response === 'approved' ? now : null,
    contact_shared_at: response === 'approved' ? now : null,
    unit_slot: slot ?? null,
    notification_channel: 'whatsapp',
    public_token: randomBytesHex(),
    created_at: now,
  } as unknown as Record<string, unknown>);
}

function randomBytesHex(): string {
  return randomUUID().replace(/-/g, '');
}

async function reqMatches(requestId: string): Promise<any[]> {
  return (await dbGetCollection<any>('matches')).filter((m) => m.request_id === requestId);
}

async function ledgerSlots(requestId: string): Promise<number[]> {
  const raw = (await getUpstash().smembers(k(`capslot:${requestId}`))) as string[];
  return raw.map(Number).sort((a, b) => a - b);
}

async function unlockDonors(donorIds: string[]) {
  for (const id of donorIds) {
    await getUpstash().del(k(`donor_lock_${id}`)).catch(() => {});
  }
}

async function cleanup(ids: { requestId?: string; matchIds: string[]; donorIds: string[] }) {
  for (const id of ids.matchIds) await dbDeleteDoc('matches', id).catch(() => {});
  for (const id of ids.donorIds) await dbDeleteDoc('users', id).catch(() => {});
  await unlockDonors(ids.donorIds);
  if (ids.requestId) {
    await dbDeleteDoc('blood_requests', ids.requestId).catch(() => {});
    await getUpstash().del(k(`capslot:${ids.requestId}`)).catch(() => {});
  }
}

test('CLAIM SUCCESS + DB FAILURE → retry converges to one coherent approved result', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured');
  const req = testRequest(2, 'partially_matched', 1);
  await dbSaveDoc('blood_requests', req.id, req as unknown as Record<string, unknown>);
  const dA = `dA_${tag()}`, dB = `dB_${tag()}`;
  await seedUser(dA);
  await seedUser(dB);
  const matchA = `mA_${tag()}`;
  const matchB = `mB_${tag()}`;
  await seedMatch(matchA, req.id, dA, 'approved', 1);
  await seedMatch(matchB, req.id, dB, 'pending');
  let dC = '', matchC = '';

  try {
    // Simulate the atomic claim SUCCEEDING but the next (request-doc) persist
    // FAILING: approveMatchById wins the claim (B → approved, slot 2, ledger
    // [1,2]) and then the derived-projection write throws.
    process.env.TEST_FAULT_RECONCILE = req.id;
    let threw = false;
    try {
      await approveMatchById(matchB);
    } catch {
      threw = true;
    }
    assert.equal(threw, true, 'the winner surfaces the post-claim persistence failure (no silent swallow)');
    delete process.env.TEST_FAULT_RECONCILE;

    // Projection is stale: request still reads 1/2 partially_matched, but the
    // authoritative allocation (match B approved + ledger slot 2) is intact.
    let request = await dbGetDoc<{ units_confirmed?: number; status?: string; fulfilled_at?: string | null }>('blood_requests', req.id);
    assert.equal(request?.units_confirmed, 1, 'request projection is stale after a post-claim write failure');
    assert.equal(request?.status, 'partially_matched');
    assert.deepEqual(await ledgerSlots(req.id), [1, 2], 'capacity is NOT lost/orphaned — slots 1 and 2 are claimed');

    // No false capacity exhaustion: capacity is genuinely full — a third claim is refused.
    dC = `dC_${tag()}`;
    await seedUser(dC);
    matchC = `mC_${tag()}`;
    await seedMatch(matchC, req.id, dC, 'pending');
    const third = await claimUnitSlot({ matchId: matchC, requestId: req.id, unitsRequired: 2, approvedSlots: [], timestamp: nowISO() });
    assert.equal(third.status, 'full', 'the claimed slot is not reused — no over-allocation');

    // RETRY (idempotent): same approval retried after the partial failure
    // detects the match is already approved, reconciles the projection, and
    // returns a coherent 409 — never a second claim.
    const retry = await approveMatchById(matchB);
    assert.equal(retry.ok, false, 'idempotent retry reports Already resolved');
    assert.equal(retry.status, 409);

    request = await dbGetDoc<{ units_confirmed?: number; status?: string; fulfilled_at?: string | null }>('blood_requests', req.id);
    assert.equal(request?.units_confirmed, 2, 'projection converged to the authoritative allocation on retry');
    assert.equal(request?.status, 'secured', '2/2 allocation is secured, NOT fulfilled (needs donations)');
    assert.equal(request?.fulfilled_at ?? null, null, 'secured is not terminal');

    const all = await reqMatches(req.id);
    const approved = all.filter((m) => m.donor_response === 'approved');
    assert.equal(approved.length, 2, 'exactly two coherent approved contributions');
    assert.deepEqual([...approved].map((m) => m.unit_slot).sort((a, b) => a - b), [1, 2], 'no duplicate unit slot');
    assert.deepEqual(await ledgerSlots(req.id), [1, 2]);
  } finally {
    delete process.env.TEST_FAULT_RECONCILE;
    await cleanup({ requestId: req.id, matchIds: [matchA, matchB, matchC], donorIds: [dB, dA, dC] });
  }
});

test('CLAIM + PROCESS/RESTART RECOVERY → reconcile reconstructs state, no duplicate slot, no false exhaustion', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured');
  const req = testRequest(1, 'open', 0);
  await dbSaveDoc('blood_requests', req.id, req as unknown as Record<string, unknown>);
  const dM = `dM_${tag()}`, dP = `dP_${tag()}`;
  await seedUser(dM);
  await seedUser(dP);
  const matchM = `mM_${tag()}`, matchP = `mP_${tag()}`;
  await seedMatch(matchM, req.id, dM, 'pending');
  await seedMatch(matchP, req.id, dP, 'pending');

  try {
    // The atomic claim succeeds (match M → approved, slot 1, ledger [1]).
    const claim = await claimUnitSlot({ matchId: matchM, requestId: req.id, unitsRequired: 1, approvedSlots: [], timestamp: nowISO() });
    assert.equal(claim.status, 'ok');

    // Simulate the crash: the request projection was never persisted
    // (units_confirmed still 0, status still open).
    let request = await dbGetDoc<{ units_confirmed?: number; status?: string; fulfilled_at?: string | null }>('blood_requests', req.id);
    assert.equal(request?.units_confirmed, 0);
    assert.equal(request?.status, 'open');
    assert.deepEqual(await ledgerSlots(req.id), [1], 'claim is durable in the ledger after the restart');

    // Duplicate re-claim of the same match is impossible (idempotent).
    const dup = await claimUnitSlot({ matchId: matchM, requestId: req.id, unitsRequired: 1, approvedSlots: await ledgerSlots(req.id), timestamp: nowISO() });
    assert.equal(dup.status, 'already_resolved', 'a restarted retry cannot double-claim the same match');

    // Recovery path runs: reconstruct the projection from live approved
    // matches. Must NOT create a second slot and must NOT orphan capacity.
    const rec = await reconcileRequestLifecycle(req.id, 1);
    assert.equal(rec.changed, true, 'recovery closed the projection gap');
    request = await dbGetDoc<{ units_confirmed?: number; status?: string; fulfilled_at?: string | null }>('blood_requests', req.id);
    assert.equal(request?.units_confirmed, 1);
    assert.equal(request?.status, 'secured', '1/1 allocation is secured, NOT fulfilled (needs donations)');
    assert.equal(request?.fulfilled_at ?? null, null, 'secured is not terminal');

    // Second recovery run is a no-op (idempotent).
    const rec2 = await reconcileRequestLifecycle(req.id, 1);
    assert.equal(rec2.changed, false);

    const approved = (await reqMatches(req.id)).filter((m) => m.donor_response === 'approved');
    assert.equal(approved.length, 1, 'no duplicate unit slot created by recovery');
    assert.equal(approved[0].unit_slot, 1);
    assert.deepEqual(await ledgerSlots(req.id), [1], 'recovery never adds to / rewrites the authoritative ledger');

    // The still-pending match P must not be claimed beyond capacity.
    const over = await claimUnitSlot({ matchId: matchP, requestId: req.id, unitsRequired: 1, approvedSlots: await ledgerSlots(req.id), timestamp: nowISO() });
    assert.equal(over.status === 'full' || over.status === 'already_resolved', true, 'no false capacity exhaustion after recovery');
  } finally {
    await cleanup({ requestId: req.id, matchIds: [matchM, matchP], donorIds: [dM, dP] });
  }
});

test('DUPLICATE + CONCURRENT approval retries after partial failure converge idempotently', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured');
  const req = testRequest(2, 'partially_matched', 1);
  await dbSaveDoc('blood_requests', req.id, req as unknown as Record<string, unknown>);
  const dA = `dA_${tag()}`, dB = `dB_${tag()}`;
  await seedUser(dA);
  await seedUser(dB);
  const matchA = `mA_${tag()}`, matchB = `mB_${tag()}`;
  await seedMatch(matchA, req.id, dA, 'approved', 1);
  await seedMatch(matchB, req.id, dB, 'pending');

  try {
    // B wins the atomic claim but the projection was never persisted (simulated
    // partial failure) — B is approved, request reads 1/2 partially_matched.
    // approvedSlots are derived from the live approved matches (which includes
    // matchA's slot), so the atomic claim assigns B the correct next slot.
    const approvedSlotsForClaim = computeApprovedSlots(await dbGetCollection<any>('matches') as any, req.id);
    const claim = await claimUnitSlot({ matchId: matchB, requestId: req.id, unitsRequired: 2, approvedSlots: approvedSlotsForClaim, timestamp: nowISO() });
    assert.equal(claim.status, 'ok');
    assert.equal((claim as { slot: number }).slot, 2, 'B claims slot 2 (lowest free after matchA)');
    let request = await dbGetDoc<{ units_confirmed?: number; status?: string }>('blood_requests', req.id);
    assert.equal(request?.status, 'partially_matched');

    // Two concurrent retries of the SAME already-approved match both return 409
    // and converge to exactly one coherent result (fulfilled, one extra slot).
    const [r1, r2] = await Promise.all([approveMatchById(matchB), approveMatchById(matchB)]);
    assert.equal(r1.ok, false);
    assert.equal(r2.ok, false);
    assert.equal(r1.status, 409);
    assert.equal(r2.status, 409);

    request = await dbGetDoc<{ units_confirmed?: number; status?: string }>('blood_requests', req.id);
    assert.equal(request?.units_confirmed, 2, 'converged on retry');
    assert.equal(request?.status, 'secured', '2/2 allocation is secured, NOT fulfilled (needs donations)');
    const approved = (await reqMatches(req.id)).filter((m) => m.donor_response === 'approved');
    assert.equal(approved.length, 2, 'exactly two approved contributions, not three');
    assert.deepEqual([...approved].map((m) => m.unit_slot).sort((a, b) => a - b), [1, 2]);
    assert.deepEqual(await ledgerSlots(req.id), [1, 2], 'ledger converged, no phantom support');
  } finally {
    await cleanup({ requestId: req.id, matchIds: [matchA, matchB], donorIds: [dA, dB] });
  }
});

test('TERMINAL DURING NOTIFICATION WINDOW → unsent invites suppressed and rolled back', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured');
  const req = testRequest(2, 'broadcasting', 0);
  await dbSaveDoc('blood_requests', req.id, req as unknown as Record<string, unknown>);
  const donors = [`d1_${tag()}`, `d2_${tag()}`, `d3_${tag()}`];
  for (const d of donors) await seedEligibleDonor(d);
  const matchIds: string[] = [];

  try {
    // Arm the seam: close the request at the worst possible moment — after the
    // pre-notify live gate, immediately before the notification fan-out.
    process.env.TEST_NOTIFY_CLOSE = req.id;
    const result = await matchAndNotifyRequest((await dbGetDoc<BloodRequest>('blood_requests', req.id)) as BloodRequest);
    delete process.env.TEST_NOTIFY_CLOSE;

    assert.ok(result.deliveries.length > 0 || result.matched > 0, 'matches were created before the delivery guard ran');
    const matches = await reqMatches(req.id);
    assert.equal(matches.length, 0, 'suppressed invites are rolled back — no actionable row survives');

    const live = await dbGetDoc<{ status?: string }>('blood_requests', req.id);
    assert.equal(TERMINAL_REQUEST_STATUSES.includes(live?.status as string), true, 'request is terminal');

    for (const d of donors) {
      const lockVal = await cacheGet(`donor_lock_${d}`);
      assert.ok(!lockVal, `donor lock ${d} released after suppressed invite (lock was ${lockVal})`);
    }
    matchIds.push(...matches.map((m: any) => m.id));

    // No new donor match can be created for the now-terminal request.
    process.env.TEST_NOTIFY_CLOSE = '';
    const cascade = await matchAndNotifyRequest((await dbGetDoc<BloodRequest>('blood_requests', req.id)) as BloodRequest);
    assert.equal(cascade.matched, 0, 'no new match for a terminal request');

    // Approval path is also dead for the terminal request.
    const dOther = `dOther_${tag()}`;
    await seedUser(dOther);
    const mOther = `mOther_${tag()}`;
    matchIds.push(mOther);
    await seedMatch(mOther, req.id, dOther, 'pending');
    const appr = await approveMatchById(mOther);
    assert.equal(appr.ok, false, 'stale approval rejected for terminal request');
    assert.ok(appr.status === 409, 'rejected with 409');
    const mOtherLive = (await reqMatches(req.id)).find((m: any) => m.id === mOther);
    assert.equal(mOtherLive?.donor_response, 'pending', 'no new approved slot; donor is not approved');
    assert.deepEqual(await ledgerSlots(req.id), [], 'no unit slot claimed by the stale action');
  } finally {
    delete process.env.TEST_NOTIFY_CLOSE;
    await cleanup({ requestId: req.id, matchIds, donorIds: donors });
  }
});

test('ALREADY-SENT STALE NOTIFICATION → approve from a closed request is safely rejected', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured');
  const req = testRequest(2, 'fulfilled', 2);
  await dbSaveDoc('blood_requests', req.id, req as unknown as Record<string, unknown>);
  const dA = `dA_${tag()}`, dB = `dB_${tag()}`;
  await seedUser(dA);
  await seedUser(dB);
  const matchA = `mA_${tag()}`, matchB = `mB_${tag()}`;
  // A was notified + approved before the close (the stale notification).
  await seedMatch(matchA, req.id, dA, 'approved', 1);
  // B received an invite that was never answered before the close.
  await seedMatch(matchB, req.id, dB, 'pending');

  try {
    // Approving from the already-approved stale notification: idempotent 409,
    // no new claim, no new slot, no double-allocation.
    const rA = await approveMatchById(matchA);
    assert.equal(rA.ok, false);
    assert.equal(rA.status, 409, 'already-approved stale notification is a 409');

    // Approving from a still-pending invite on a closed request: rejected with
    // no claim and no slot — the terminal gate (fast path + atomic claim).
    const beforeSlots = await ledgerSlots(req.id);
    const rB = await approveMatchById(matchB);
    assert.equal(rB.ok, false);
    assert.ok(rB.status === 409, 'pending invite on a terminal request is rejected');
    const mBLive = (await reqMatches(req.id)).find((m: any) => m.id === matchB);
    assert.equal(mBLive?.donor_response, 'pending', 'stale invite does NOT become an approval');
    assert.ok(mBLive?.unit_slot == null, 'no unit slot claimed for the stale invite');
    assert.deepEqual(await ledgerSlots(req.id), beforeSlots, 'no capacity change');

    // The request stays terminal (approval path never re-opens it).
    const live = await dbGetDoc<{ status?: string; units_confirmed?: number }>('blood_requests', req.id);
    assert.equal(live?.status, 'fulfilled');
    assert.equal(live?.units_confirmed, 2);

    // Claim-level guarantee: the atomic claim independently refuses a terminal
    // request even if a caller held a stale live snapshot.
    const claim = await claimUnitSlot({ matchId: matchB, requestId: req.id, unitsRequired: 2, approvedSlots: [], timestamp: nowISO() });
    assert.ok(claim.status === 'terminal' || claim.status === 'full', `atomic claim refuses a terminal request atomically (got ${claim.status})`);
  } finally {
    await cleanup({ requestId: req.id, matchIds: [matchA, matchB], donorIds: [dA, dB] });
  }
});
