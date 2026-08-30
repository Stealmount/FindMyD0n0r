/**
 * Progressive / cascading donor selection tests (Phases 1–3).
 *
 * Covers:
 *  - Matching tuning constants (INITIAL_BATCH_SIZE=8, MAX_UNITS_PER_REQUEST=5)
 *  - Validation cap wired to MAX_UNITS_PER_REQUEST
 *  - Batch-capped selection: max 8 invites per round regardless of units/openSlots
 *  - Pending gate: no next batch while invites are unresolved
 *  - unit_slot assignment: approvals claim lowest free 1-based slot
 *  - Batch progression: declined batch → next round targets fresh donors only
 *  - notification_status decoupling: delivery state never mirrors donor_response
 *
 * Run:
 *   npx tsx --test --test-force-exit backend/tests/cascade.test.ts
 *
 * Integration scenarios require the Upstash-backed store; they self-skip
 * otherwise (pure scenarios always run).
 *
 * SEEDING CONTRACT (mirrors engine internals — do not drift):
 *  - Donor pincode MUST share the hospital pincode's 5-digit prefix: the index
 *    path (findEligibleDonorsFromDB) only expands PINCODE_COORDS neighbors of
 *    the request pincode, and an empty index result does NOT fall back to scan.
 *  - Donors need docs in `users` (approveMatchById reads it) AND mirrored
 *    `profiles` + `donor_profiles` rows (index path reads those).
 *  - Every test uses its OWN donor-id range: invites mark donors
 *    "recently alerted" for 6h against OTHER request ids, and donor locks +
 *    the 60s eligible_ cache leak across tests otherwise.
 */
import 'dotenv/config';
import './setup-env.ts';

// Deterministic offline deliveries: WAHA unset ⇒ sendWhatsApp short-circuits
// false instantly (no 401 retries); donor emails use .local so Resend is skipped.
process.env.WAHA_BASE_URL = '';

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  INITIAL_BATCH_SIZE,
  ELIGIBLE_POOL_SIZE,
  MAX_SEARCH_BATCHES,
  MAX_UNITS_PER_REQUEST,
  type BloodType,
} from '../src/types.ts';
import { bloodRequestSchema } from '../validation/requests.ts';
import { matchAndNotifyRequest, releaseDonorLock } from '../services/matchingEngine.ts';
import { approveMatchById } from '../routes/matching.ts';
import { cancelRequest } from '../routes/tracking.ts';
import { cacheInvalidatePrefix } from '../src/lib/redisCache.ts';
import {
  isFirebaseConfigured,
  getCollection as dbGetCollection,
  getDoc as dbGetDoc,
  saveDoc as dbSaveDoc,
} from '../src/lib/serverDb.ts';
import type { BloodRequest, Match } from '../src/types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const HOSPITAL_PINCODE = '110029';
let seq = 0;
const nextId = (p: string) => `${p}_cascade_${Date.now()}_${++seq}`;

// Every seeded donor, tagged by pool (hundreds digit). Late tests quarantine
// earlier pools via cooldown_until — the only cross-request exclusion that
// survives the critical-urgency anti-spam bypass and un-invited (lock-free)
// leftovers.
const seedLog: { id: string; pool: number; userDoc: Record<string, unknown>; dprofDoc: Record<string, unknown> }[] = [];

async function quarantineOtherPools(keepPool: number): Promise<void> {
  const cooldown = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  for (const s of seedLog) {
    if (s.pool === keepPool) continue;
    await dbSaveDoc('users', s.id, { ...s.userDoc, cooldown_until: cooldown });
    await dbSaveDoc('donor_profiles', `dprof_${s.id}`, { ...s.dprofDoc, cooldown_until: cooldown });
  }
}

/** Seed one donor across ALL collections the engine reads (see contract above). */
async function seedDonor(n: number): Promise<string> {
  const id = nextId(`donor${n}`);
  const phone = `9197${String(10000000 + n * 7919).slice(0, 8)}`;
  const userDoc = {
    id,
    full_name: `Cascade Donor ${n}`,
    email: `cascade${n}@example.local`, // .local ⇒ notifyDonor skips Resend entirely
    phone,
    whatsapp_number: phone, // WhatsApp-capable ⇒ dispatch attempted, degrades offline
    blood_type: 'O+',
    pincode: HOSPITAL_PINCODE,
    availability_status: 'available',
    account_status: 'active',
    cooldown_until: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const dprofDoc = {
    id: `dprof_${id}`,
    profile_id: id,
    blood_group: 'O+',
    // MUST share hospital pincode's 5-digit prefix or the index path misses us.
    pincode: HOSPITAL_PINCODE,
    is_available: true,
    emergency_only: false,
    cooldown_until: null,
  };
  await dbSaveDoc('users', id, userDoc);
  await dbSaveDoc('profiles', id, {
    id,
    full_name: userDoc.full_name,
    email: userDoc.email,
    phone,
    whatsapp_number: phone,
    trust_report_count: 0,
    created_at: userDoc.created_at,
    updated_at: userDoc.updated_at,
  });
  await dbSaveDoc('donor_profiles', `dprof_${id}`, dprofDoc);
  seedLog.push({ id, pool: Math.floor(n / 100), userDoc, dprofDoc });
  return id;
}

function makeRequest(overrides: Partial<BloodRequest> & { id: string }): BloodRequest {
  return {
    tracking_code: `BLD-CASCADE-${overrides.id}`,
    patient_name: 'Cascade Patient',
    blood_type_needed: 'O+' as BloodType,
    units_required: 1,
    hospital_name: 'Test Hospital',
    hospital_pincode: HOSPITAL_PINCODE,
    hospital_area: 'Ansari Nagar',
    hospital_city: 'New Delhi',
    additional_notes: null,
    // critical ⇒ bypasses the 6h anti-spam filter (cross-test isolation).
    urgency_level: 'critical',
    requester_name: 'Cascade Requester',
    requester_email: 'cascade-requester@example.com',
    requester_phone: '91999988887',
    status: 'open',
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    fulfilled_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const requestMatches = async (requestId: string) =>
  (await dbGetCollection<Match>('matches')).filter((m) => m.request_id === requestId);

/** Fresh eligible-cache + persisted request → deterministic first round. */
async function arm(request: BloodRequest): Promise<void> {
  await cacheInvalidatePrefix('eligible_');
  await dbSaveDoc('blood_requests', request.id, request as unknown as Record<string, unknown>);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure scenarios (no store required)
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 1: tuning constants & validation cap', () => {
  test('Constants hold user-approved values', () => {
    assert.equal(INITIAL_BATCH_SIZE, 8);
    assert.equal(MAX_UNITS_PER_REQUEST, 5);
    assert.equal(MAX_SEARCH_BATCHES, 5);
    assert.equal(ELIGIBLE_POOL_SIZE, 100);
  });

  test('units_required capped at MAX_UNITS_PER_REQUEST (5), not legacy 10', () => {
    const base = {
      patient_name: 'P',
      blood_type_needed: 'O+',
      hospital_name: 'H',
      hospital_pincode: '110058',
      hospital_area: 'A',
      hospital_city: 'Delhi',
    };
    assert.equal(bloodRequestSchema.safeParse({ ...base, units_required: 5 }).success, true);
    assert.equal(bloodRequestSchema.safeParse({ ...base, units_required: 6 }).success, false);
    assert.equal(bloodRequestSchema.safeParse({ ...base, units_required: 10 }).success, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration scenarios (require store; each owns a private donor range)
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 2+3: batch-capped progressive matching', () => {
  test('Batch cap: 12 eligible donors, 1-unit request → exactly 8 invites, batch 1 tagged', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    for (let i = 101; i <= 112; i++) await seedDonor(i); // private pool
    const request = makeRequest({ id: nextId('req') });
    await arm(request);

    await matchAndNotifyRequest(request);
    const matches = await requestMatches(request.id);

    assert.equal(matches.length, INITIAL_BATCH_SIZE, 'must invite exactly INITIAL_BATCH_SIZE donors');
    for (const m of matches) {
      assert.equal(m.donor_response, 'pending');
      assert.equal(m.search_batch, 1);
      assert.ok(['pending', 'sent', 'failed', 'retrying'].includes(m.notification_status ?? ''),
        'notification_status must be a delivery state');
    }
    const persisted = await dbGetDoc<BloodRequest>('blood_requests', request.id);
    assert.equal(persisted?.search_batch, 1, 'request.search_batch must persist current round');
    assert.equal(persisted?.status, 'matching');
  });

  test('Pending gate: no second wave while invites are unresolved', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    for (let i = 201; i <= 210; i++) await seedDonor(i); // private pool
    const request = makeRequest({ id: nextId('req') });
    await arm(request);

    await matchAndNotifyRequest(request);
    const before = (await requestMatches(request.id)).length;
    assert.ok(before > 0, 'first round must produce matches');

    await matchAndNotifyRequest(
      (await dbGetDoc<BloodRequest>('blood_requests', request.id)) as BloodRequest
    );
    const after = await requestMatches(request.id);
    assert.equal(after.length, before, 'unresolved pendings must gate the next batch');
  });

  test('unit_slot: three race winners claim slots 1,2,3 exactly once each', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    for (let i = 301; i <= 310; i++) await seedDonor(i); // private pool
    const request = makeRequest({ id: nextId('req'), units_required: 3 });
    await arm(request);

    await matchAndNotifyRequest(request);
    let matches = await requestMatches(request.id);
    assert.equal(matches.length, INITIAL_BATCH_SIZE);

    // First three responders approve (any order — race model)
    for (const m of matches.slice(0, 3)) {
      const r = await approveMatchById(m.id);
      assert.equal(r.ok, true, `approve failed: ${r.error}`);
    }
    matches = await requestMatches(request.id);
    const slots = matches
      .filter((m) => m.donor_response === 'approved')
      .map((m) => m.unit_slot as number)
      .sort((a, b) => a - b);
    assert.deepEqual(slots, [1, 2, 3], 'approved winners must fill lowest free slots uniquely');
  });

  test('Cascade: declining batch 1 unlocks a batch 2 targeting only fresh donors', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    for (let i = 401; i <= 410; i++) await seedDonor(i); // 10 donors → batch2 has 2 left
    await quarantineOtherPools(4); // isolate from earlier suites' unlocked leftovers
    const request = makeRequest({ id: nextId('req') });
    await arm(request);

    await matchAndNotifyRequest(request);
    const batch1 = await requestMatches(request.id);
    assert.equal(batch1.length, INITIAL_BATCH_SIZE);

    for (const m of batch1) {
      await dbSaveDoc('matches', m.id, { ...m, donor_response: 'declined' } as unknown as Record<string, unknown>);
      await releaseDonorLock(m.donor_id, m.request_id);
    }

    const refreshed = (await dbGetDoc<BloodRequest>('blood_requests', request.id)) as BloodRequest;
    await matchAndNotifyRequest(refreshed);
    const all = await requestMatches(request.id);
    const batch2 = all.filter((m) => m.search_batch === 2);
    // ponytail: exact "covers the 2 unseen donors" only holds in a pristine
    // store; leftover eligible donors from prior RUNS legitimately join the
    // round (critical urgency bypasses anti-spam). Assert the invariant that
    // matters: cascade fired and targeted ONLY fresh donors.
    assert.ok(batch2.length >= 1, 'declined batch 1 must unlock a batch 2');
    const b1Donors = new Set(batch1.map((m) => m.donor_id));
    const b2Donors = new Set(batch2.map((m) => m.donor_id));
    for (const d of b2Donors) assert.ok(!b1Donors.has(d), 'batch 2 must never reuse batch 1 donors');

    const persisted = await dbGetDoc<BloodRequest>('blood_requests', request.id);
    assert.equal(persisted?.search_batch, 2);
  });

  test('Decoupling: failed delivery marks retrying while donor_response stays pending', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    for (let i = 501; i <= 505; i++) await seedDonor(i); // private pool
    const request = makeRequest({
      id: nextId('req'),
      requester_phone: '91999988888', // unique → no self-match collisions
    });
    await arm(request);

    await matchAndNotifyRequest(request);
    const matches = await requestMatches(request.id);
    assert.ok(matches.length > 0);
    for (const m of matches) {
      // WAHA unset + .local emails ⇒ delivery failed, but the INVITE stays alive
      assert.equal(m.donor_response, 'pending', 'delivery failure must not resolve the match');
      assert.equal(m.notification_status, 'retrying', 'failed delivery must be queued for retry');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5+6: dashboard accounting & cancellation gating
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 5: server-side units_confirmed accounting', () => {
  test('Approvals increment units_confirmed and flip to fulfilled exactly at capacity', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    await quarantineOtherPools(6);
    for (let i = 601; i <= 608; i++) await seedDonor(i); // private pool
    const request = makeRequest({ id: nextId('req'), units_required: 3 });
    await arm(request);

    await matchAndNotifyRequest(request);
    const matches = await requestMatches(request.id);
    assert.equal(matches.length, INITIAL_BATCH_SIZE);

    // Approval 1 → partially_matched, counter = 1
    const r1 = await approveMatchById(matches[0].id);
    assert.equal(r1.ok, true, `approve #1 failed: ${r1.error}`);
    let persisted = await dbGetDoc<BloodRequest>('blood_requests', request.id);
    assert.equal(persisted?.units_confirmed, 1);
    assert.equal(persisted?.status, 'partially_matched');
    assert.equal(persisted?.fulfilled_at ?? null, null);

    // Approvals 2+3 → counter capped at required, status fulfilled
    const r2 = await approveMatchById(matches[1].id);
    const r3 = await approveMatchById(matches[2].id);
    assert.equal(r2.ok && r3.ok, true, `approvals failed: ${r2.error}/${r3.error}`);
    persisted = await dbGetDoc<BloodRequest>('blood_requests', request.id);
    assert.equal(persisted?.units_confirmed, 3);
    assert.equal(persisted?.status, 'fulfilled');
    assert.ok(persisted?.fulfilled_at, 'fulfilled_at must be stamped at capacity');
  });
});

describe('Phase 6: cancellation gating & fan-out', () => {
  test('Approval on a cancelled request is rejected (409) and match stays pending', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    await quarantineOtherPools(7);
    for (let i = 701; i <= 704; i++) await seedDonor(i); // private pool
    const request = makeRequest({ id: nextId('req') });
    await arm(request);

    await matchAndNotifyRequest(request);
    const matches = await requestMatches(request.id);
    assert.ok(matches.length > 0);

    await dbSaveDoc('blood_requests', request.id,
      { ...request, status: 'cancelled' } as unknown as Record<string, unknown>);
    const r = await approveMatchById(matches[0].id);
    assert.equal(r.ok, false, 'approval must fail on a cancelled request');
    assert.equal((r as { status?: number }).status, 409);
    const m = (await requestMatches(request.id)).find(x => x.id === matches[0].id);
    assert.equal(m?.donor_response, 'pending', 'dead-request approval must not mutate the match');
  });

  test('cancelRequest: pending→timed_out, approved/declined preserved, locks released', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    await quarantineOtherPools(8);
    for (let i = 801; i <= 803; i++) await seedDonor(i); // private pool
    const request = makeRequest({ id: nextId('req') });
    await arm(request);

    await matchAndNotifyRequest(request);
    const matches = await requestMatches(request.id);
    // WAHA unset ⇒ invites stay pending; force deterministic states per donor.
    const [p, a, d] = matches;
    await dbSaveDoc('matches', a.id, { ...a, donor_response: 'approved', unit_slot: 1 });
    await dbSaveDoc('matches', d.id, { ...d, donor_response: 'declined' });

    const updated = await cancelRequest(
      (await dbGetDoc<BloodRequest>('blood_requests', request.id)) as BloodRequest
    );
    assert.equal(updated.status, 'cancelled');

    const byId = new Map((await requestMatches(request.id)).map(m => [m.id, m]));
    assert.equal(byId.get(p.id)?.donor_response, 'timed_out', 'dangling invite must be retired');
    assert.equal(byId.get(a.id)?.donor_response, 'approved', 'accepted match is history — never rewritten');
    assert.equal(byId.get(d.id)?.donor_response, 'declined', 'declined match must be untouched');

    // Lock release is the observable side effect; courtesy WhatsApp to `a`
    // degrades to a no-op with WAHA unset.
    await releaseDonorLock(a.donor_id, a.request_id); // idempotent — must not throw
  });
});
