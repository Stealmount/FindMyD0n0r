/**
 * Phase 8 close-lifecycle hardening — regression suite.
 *
 * Covers, over the real store (shared fmdt: namespace) + a spawned HTTP server:
 *
 *   1. STALE WORKER SNAPSHOT RACE — a caller holding an in-memory request object
 *      (status still active) while the requester closed that request in the
 *      authoritative store must NO-OP: zero new match rows, zero donor locks,
 *      zero notifications, and the stored document must keep its terminal state
 *      (the stale snapshot must never clobber it back to active). This exercises
 *      the REAL stale path — the passed object differs from the live doc.
 *   2. GUARDED LOCK + ATOMIC TRANSITION — acquireDonorLock refuses terminal
 *      requests (atomically, inside Redis) and transitionRequestStatusIfActive
 *      refuses to overwrite a terminal doc, preserving every other field.
 *   3. IDEMPOTENT CANCEL — the second (authorized) cancel returns success with
 *      the current terminal state, not an error, and produces NO duplicate
 *      audit events or second cleanup fan-out.
 *   4. IDEMPOTENT FULFIL — repeated fulfill on a fulfilled request converges;
 *      fulfill on an already-terminal (expired) request replays instead of 409;
 *      no duplicate 'fulfilled' events.
 *   5. CONCURRENT CLOSE — two simultaneous closes converge on ONE transition +
 *      one fan-out; both callers get a coherent 200.
 *   6. APPROVED vs PENDING ALLOCATION SAFETY — on an under-filled close the
 *      approved allocation (unit_slot + capslot ledger) is retained and never
 *      released/reused; only the pending invite is retired and only ITS lock is
 *      released; no new matches.
 *   7. CLEANUP FAILURE OBSERVABILITY — an injected pending-invite retire failure
 *      is RECORDED (structured log + close_cleanup_partial_failure audit event
 *      carrying identifiers), leaves a traceable residue (match still pending,
 *      lock still held), does nothing to the terminal state, and a plain retry
 *      converges.
 *
 * Run (store configured; flush between suites):
 *   node_modules/.bin/tsx --test --test-force-exit backend/tests/close-hardening.test.ts
 */
import 'dotenv/config';
import './setup-env';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import { saveDoc as dbSaveDoc, getDoc as dbGetDoc, getCollection as dbGetCollection, isFirebaseConfigured } from '../src/lib/serverDb';
import { cacheGet, cacheSetNX } from '../src/lib/redisCache';
import {
  matchAndNotifyRequest,
  acquireDonorLock,
  releaseDonorLock,
  transitionRequestStatusIfActive,
} from '../services/matchingEngine';
import { cancelRequest } from '../routes/tracking';
import { claimUnitSlot } from '../helpers/capacityClaim';
import { getUpstash, k } from '../src/lib/upstash';
import { nowISO } from '../helpers/time';
import type { BloodRequest } from '../src/types';

const PORT = process.env.TEST_PORT || '5013';
const BASE = `http://127.0.0.1:${PORT}`;
const AUTH = { 'Authorization': 'Bearer test-valid-token', 'Content-Type': 'application/json' };

let seq = 0;
const tag = () => `ch${process.pid}_${Date.now()}_${++seq}`;

async function seedRequest(req: Partial<BloodRequest>): Promise<BloodRequest> {
  const base: BloodRequest = {
    id: `req_${tag()}`,
    tracking_code: `BLD-CH-${tag()}`,
    patient_name: 'Harden Patient',
    blood_type_needed: 'O+',
    units_required: 1,
    hospital_name: 'Harden Hospital',
    hospital_pincode: '110001',
    hospital_area: 'Delhi',
    hospital_city: 'New Delhi',
    urgency_level: 'urgent',
    requester_name: 'Harden Requester',
    requester_phone: '',
    requester_email: '',
    additional_notes: '',
    status: 'broadcasting',
    units_confirmed: 0,
    // Future expiry: the spawned server runs the 2-minute background sweep, and
    // a nowISO() expiry can legitimately fall just behind the tick, expiring a
    // request mid-test. Keep seeded requests live for the full suite.
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    fulfilled_at: null,
    search_batch: 0,
    created_at: nowISO(),
    ...req,
  };
  await dbSaveDoc('blood_requests', base.id, base as unknown as Record<string, unknown>);
  return base;
}

async function seedMatch(req: BloodRequest, donorId: string, response: 'approved' | 'pending', slot?: number) {
  const id = `m_${tag()}`;
  const now = nowISO();
  await dbSaveDoc('matches', id, {
    id,
    request_id: req.id,
    donor_id: donorId,
    donor_response: response,
    donor_response_at: response === 'approved' ? now : null,
    contact_shared_at: response === 'approved' ? now : null,
    unit_slot: slot ?? null,
    notification_channel: 'whatsapp',
    created_at: now,
  } as unknown as Record<string, unknown>);
  return id;
}

async function gateDonorLock(donorId: string, requestId: string) {
  await cacheSetNX(`donor_lock_${donorId}`, requestId, 300);
}

const live = (requestId: string) => dbGetDoc<BloodRequest>('blood_requests', requestId);
const reqMatches = async (requestId: string): Promise<any[]> =>
  (await dbGetCollection<any>('matches')).filter((m) => m.request_id === requestId);

interface HttpResult { status: number; body: any }
async function patch(path: string): Promise<HttpResult> {
  const res = await fetch(`${BASE}${path}`, { method: 'PATCH', headers: AUTH });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function eventsOf(requestId: string, event: string): Promise<any[]> {
  return (await dbGetCollection<any>('request_events'))
    .filter((e) => e.request_id === requestId && e.event === event);
}

describe('Phase 8 close-lifecycle hardening', () => {
  let child: ChildProcess | null = null;

  before(async () => {
    if (!isFirebaseConfigured()) return;
    child = spawn(process.execPath, ['--import', 'tsx', 'backend/server.ts'], {
      stdio: 'pipe',
      env: { ...process.env, PORT, NODE_ENV: 'test', WAHA_BASE_URL: '' },
    });
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 250));
      const res = await fetch(`${BASE}/api/health`).catch(() => null);
      if (res && res.ok) break;
    }
  });

  after(() => {
    if (child && child.pid) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/t', '/f']);
      } else {
        child.kill();
      }
    }
  });

  // ── 1. STALE WORKER SNAPSHOT RACE ──────────────────────────────────────────
  test('stale active snapshot cannot match, lock, or notify once the request is closed', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const req = await seedRequest({ requester_id: 'test-user-id', status: 'broadcasting' });
    // The worker's in-memory snapshot — read BEFORE the close, still active.
    const stale = { ...req };

    await cancelRequest((await live(req.id)) as BloodRequest); // requester closes

    const result = await matchAndNotifyRequest(stale); // STALE snapshot, not a reload
    assert.equal(result.matched, 0, 'stale snapshot must never create matches');

    const cascade = await matchAndNotifyRequest(stale);
    assert.equal(cascade.matched, 0, 'stale snapshot must never advance a match');

    const matches = await reqMatches(req.id);
    assert.equal(matches.length, 0, 'no match rows may exist for a closed request');

    const persisted = await live(req.id);
    assert.equal(persisted?.status, 'cancelled', 'stale snapshot must not clobber terminal state');
  });

  // ── 2. GUARDED LOCK + ATOMIC TRANSITION ────────────────────────────────────
  test('acquireDonorLock and transitionRequestStatusIfActive refuse a terminal request atomically', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');

    const closed = await seedRequest({ requester_id: 'test-user-id', status: 'cancelled', units_confirmed: 2 });
    const donor = `d_term_${tag()}`;
    const locked = await acquireDonorLock(donor, closed.id);
    assert.equal(locked, false, 'a terminal request must never lock a donor');
    assert.equal(await cacheGet(`donor_lock_${donor}`), null, 'no lock may exist');

    const beforeDoc = await live(closed.id);
    const transitioned = await transitionRequestStatusIfActive(closed.id, 'open', { search_batch: 9 });
    assert.equal(transitioned, false, 'terminal doc must refuse a status transition');
    const afterDoc = await live(closed.id);
    assert.equal(afterDoc?.status, 'cancelled', 'terminal status preserved');
    assert.equal(afterDoc?.search_batch ?? null, beforeDoc?.search_batch ?? null, 'other fields preserved');
    assert.equal(afterDoc?.units_confirmed, 2, 'counters preserved');

    // Positive controls on a live request.
    const open = await seedRequest({ requester_id: 'test-user-id', status: 'open', units_confirmed: 1 });
    const posDonor = `d_pos_${tag()}`;
    assert.equal(await acquireDonorLock(posDonor, open.id), true, 'active request can lock');
    assert.equal(await cacheGet(`donor_lock_${posDonor}`), open.id, 'lock value recorded for the request');
    assert.equal(await transitionRequestStatusIfActive(open.id, 'matching', { search_batch: 3 }), true, 'active request can advance');
    const advanced = await live(open.id);
    assert.equal(advanced?.status, 'matching');
    assert.equal(advanced?.search_batch, 3);
    assert.equal(advanced?.units_confirmed, 1, 'live fields preserved through the atomic bump');
    await releaseDonorLock(posDonor, open.id);
  });

  // ── 3. IDEMPOTENT CANCEL ───────────────────────────────────────────────────
  test('cancel is idempotent: authorized retry replays terminal state with no duplicate events or fan-out', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const req = await seedRequest({ requester_id: 'test-user-id', status: 'broadcasting' });
    const l1 = `d1_${tag()}`, l2 = `d2_${tag()}`;
    await seedMatch(req, l1, 'pending');
    await seedMatch(req, l2, 'pending');
    await gateDonorLock(l1, req.id);

    const first = await patch(`/api/requests/${req.tracking_code}/cancel`);
    assert.equal(first.status, 200);
    assert.equal(first.body.request.status, 'cancelled');
    assert.equal(first.body.idempotent, false);

    const second = await patch(`/api/requests/${req.tracking_code}/cancel`);
    assert.equal(second.status, 200, 'retry must NOT become an error');
    assert.equal(second.body.request.status, 'cancelled');
    assert.equal(second.body.idempotent, true, 'retry is reported as an idempotent replay');

    assert.equal((await eventsOf(req.id, 'cancelled')).length, 1, 'one transition = one audit event');
    assert.equal((await eventsOf(req.id, 'close_cleanup_partial_failure')).length, 0);
    assert.equal((await reqMatches(req.id)).every((m) => m.donor_response === 'timed_out'), true);
    assert.ok(!(await cacheGet(`donor_lock_${l1}`)), 'locks freed exactly once');
  });

  // ── 4. IDEMPOTENT FULFIL ───────────────────────────────────────────────────
  test('fulfil on an already-terminal (expired) request replays success instead of 409', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const req = await seedRequest({ requester_id: 'test-user-id', status: 'expired' });
    const res = await patch(`/api/requests/${req.tracking_code}/fulfill`);
    assert.equal(res.status, 200, 'authorized repeat fulfil must not 409');
    assert.equal(res.body.request.status, 'expired', 'current terminal state returned');
    assert.equal(res.body.idempotent, true);
  });

  test('fulfil is idempotent: repeat fulfil on a fulfilled request converges with one event', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const req = await seedRequest({ requester_id: 'test-user-id', status: 'partially_matched', units_confirmed: 1 });
    const approvedId = `da_${tag()}`;
    const approvedMatchId = await seedMatch(req, approvedId, 'approved', 1);
    // Fix 1: fulfilled requires a COMPLETED donation, not approval alone. Seed the
    // request-keyed donation_log row so the request is truthfully 'fulfilled'.
    await dbSaveDoc('donation_log', `donation_${approvedMatchId}`, {
      id: `donation_${approvedMatchId}`,
      donor_id: approvedId,
      match_id: approvedMatchId,
      request_id: req.id,
      donation_date: nowISO().split('T')[0],
      source: 'platform_match',
      created_at: nowISO(),
    });

    const first = await patch(`/api/requests/${req.tracking_code}/fulfill`);
    assert.equal(first.status, 200);
    assert.equal(first.body.request.status, 'fulfilled');
    assert.equal(first.body.idempotent, false);

    const second = await patch(`/api/requests/${req.tracking_code}/fulfill`);
    assert.equal(second.status, 200);
    assert.equal(second.body.request.status, 'fulfilled');
    assert.equal(second.body.idempotent, true);

    assert.equal((await eventsOf(req.id, 'fulfilled')).length, 1, 'one fulfil = one audit event');
  });

  // ── 5. CONCURRENT CLOSE ────────────────────────────────────────────────────
  test('two concurrent cancels converge on one transition and one fan-out', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const req = await seedRequest({ requester_id: 'test-user-id', status: 'broadcasting' });
    const l1 = `d1_${tag()}`;
    await seedMatch(req, l1, 'pending');
    await gateDonorLock(l1, req.id);

    const [a, b] = await Promise.all([
      patch(`/api/requests/${req.tracking_code}/cancel`),
      patch(`/api/requests/${req.tracking_code}/cancel`),
    ]);

    assert.equal(a.status, 200, 'concurrent winner succeeds');
    assert.equal(b.status, 200, 'concurrent loser does not error');
    assert.equal(a.body.request.status, 'cancelled');
    assert.equal(b.body.request.status, 'cancelled');
    assert.equal([a.body.idempotent, b.body.idempotent].filter(Boolean).length, 1,
      'exactly one caller performed the transition; the other replayed');

    assert.equal((await eventsOf(req.id, 'cancelled')).length, 1, 'concurrent closes = one audit event');
    assert.equal((await reqMatches(req.id)).every((m) => m.donor_response === 'timed_out'), true);
    assert.ok(!(await cacheGet(`donor_lock_${l1}`)), 'lock released once, not double-deleted');
  });

  // ── 6. APPROVED vs PENDING ALLOCATION SAFETY ───────────────────────────────
  test('under-filled close retains the approved allocation + capslot ledger; only the pending invite/lock is retired', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const req = await seedRequest({ requester_id: 'test-user-id', units_required: 2, status: 'partially_matched' });
    const da = `da_${tag()}`, db = `db_${tag()}`;
    const matchA = await seedMatch(req, da, 'pending');
    const matchB = await seedMatch(req, db, 'pending');
    await gateDonorLock(da, req.id);
    await gateDonorLock(db, req.id);

    // Real capacity claim for A (slot 1 lands in the capslot ledger).
    const claim = await claimUnitSlot({ matchId: matchA, requestId: req.id, unitsRequired: 2, approvedSlots: [], timestamp: nowISO() });
    assert.equal(claim.status, 'ok');
    assert.equal((claim as { slot: number }).slot, 1);

    const ledgerKey = k(`capslot:${req.id}`);
    const ledgerBefore: string[] = (await getUpstash().smembers(ledgerKey)).sort();

    const closed = await patch(`/api/requests/${req.tracking_code}/cancel`);
    assert.equal(closed.status, 200);
    assert.equal(closed.body.request.status, 'cancelled');

    const byId = new Map((await reqMatches(req.id)).map((m: any) => [m.id, m]));
    assert.equal(byId.get(matchA)?.donor_response, 'approved', 'approved allocation is history — never rewritten');
    assert.equal(byId.get(matchA)?.unit_slot, 1, 'unit slot retained');
    assert.equal(byId.get(matchB)?.donor_response, 'timed_out', 'pending invite retired');

    assert.deepEqual((await getUpstash().smembers(ledgerKey)).sort(), ledgerBefore,
      'cancellation never releases/reuses an approved slot');
    assert.ok(await cacheGet(`donor_lock_${da}`), 'approved donor lock untouched by the close');
    assert.ok(!(await cacheGet(`donor_lock_${db}`)), 'pending donor lock released');

    const persisted = await live(req.id);
    const reRun = await matchAndNotifyRequest(persisted as BloodRequest);
    assert.equal(reRun.matched, 0, 'no new matches after the close');
    assert.equal((await matchAndNotifyRequest(persisted as BloodRequest)).matched, 0, 'no advance after the close');
  });

  // ── 7. CLEANUP FAILURE OBSERVABILITY + RECOVERY ────────────────────────────
  test('a failed retire is recorded with identifiers, leaves a traceable residue, and a retry converges', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const req = await seedRequest({ requester_id: 'test-user-id', status: 'broadcasting' });
    const dFault = `df1_${tag()}`, dClean = `df2_${tag()}`;
    const m1 = await seedMatch(req, dFault, 'pending');
    const m2 = await seedMatch(req, dClean, 'pending');
    await gateDonorLock(dFault, req.id);
    await gateDonorLock(dClean, req.id);

    // Inject a failure for ONE pending invite (test-build-only fault seam).
    process.env.TEST_FAULT_RETIRE = m1;
    let updated: BloodRequest;
    try {
      updated = await cancelRequest((await live(req.id)) as BloodRequest);
    } finally {
      delete process.env.TEST_FAULT_RETIRE;
    }
    assert.equal(updated.status, 'cancelled', 'failed cleanup never blocks/fails the close itself');

    const byId = new Map((await reqMatches(req.id)).map((m: any) => [m.id, m]));
    assert.equal(byId.get(m1)?.donor_response, 'pending', 'failed retire leaves an identifiable residue (match still pending)');
    assert.ok(await cacheGet(`donor_lock_${dFault}`), 'failed retire leaves its lock held — traceable');
    assert.equal(byId.get(m2)?.donor_response, 'timed_out', 'sibling cleanup proceeded');
    assert.ok(!(await cacheGet(`donor_lock_${dClean}`)), 'sibling lock released');

    const failures = await eventsOf(req.id, 'close_cleanup_partial_failure');
    assert.equal(failures.length, 1, 'failure is audited, never silent');
    assert.equal(failures[0].detail?.pendingFailed, 1, 'audit carries the failing count');
    assert.equal(failures[0].detail?.pendingAttempted, 2, 'audit carries identifiers/attempts');

    // Plain retry converges: the residue is cleaned and no second failure is recorded.
    await cancelRequest((await live(req.id)) as BloodRequest);
    const afterRetry = new Map((await reqMatches(req.id)).map((m: any) => [m.id, m]));
    assert.equal(afterRetry.get(m1)?.donor_response, 'timed_out', 'retry retires the previously-failed invite');
    assert.ok(!(await cacheGet(`donor_lock_${dFault}`)), 'retry releases the previously-held lock');
    assert.equal((await eventsOf(req.id, 'close_cleanup_partial_failure')).length, 1, 'recovery introduces no new failure');
    assert.equal((await live(req.id))?.status, 'cancelled', 'terminal state untouched by retries');
  });
});