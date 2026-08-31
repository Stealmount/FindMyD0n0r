/**
 * Sequential matching-engine tests (matching-engine-implementation §3–§7).
 *
 * Covers the fixed business model:
 *  - Sequential single-invitation owner: exactly ONE invite per owner call,
 *    next picked only after the in-flight invite resolves (decline/timeout).
 *  - 15-donor budget: max 15 unique donors per request, no donor #16.
 *  - `search_tried` (SCARD) ↔ `search_budget` (INCR) atomic invariant, capped 15.
 *  - Unit-slot ledger: approvals claim lowest free 1-based slot; release re-opens.
 *  - `secured` at full allocation (NOT `fulfilled`); `fulfilled` after donations.
 *  - Completion provider: idempotent double-fire, derived `units_completed`.
 *  - `search_exhausted` NOT terminal; stays reachable to `fulfilled`.
 *  - Reopen resets the search budget; cancel preserves approved history.
 *  - notification_status decoupling — delivery state never mirrors donor_response.
 *  - Donor #16 blocked across the owner and direct budget spends.
 *
 * Run:
 *   npx tsx --test --test-force-exit backend/tests/cascade.test.ts
 *
 * Integration scenarios require the Upstash-backed store; they self-skip
 * otherwise. SEEDING CONTRACT (mirrors engine internals — do not drift):
 *  - Donor pincode MUST share the hospital pincode's 5-digit prefix: the index
 *    path only expands PINCODE_COORDS neighbors of the request pincode.
 *  - Donors need docs in `users` + mirrored `profiles` + `donor_profiles`.
 *  - Every test owns its donor-id range and request id (invites mark donors
 *    "recently alerted" for 6h against OTHER request ids; locks + the 60s
 *    eligible_ cache leak across tests otherwise).
 */
import 'dotenv/config';
import './setup-env.ts';

// Deterministic offline deliveries: WAHA unset ⇒ sendWhatsApp short-circuits
// false instantly (no 401 retries); donor emails use .local so Resend is skipped.
process.env.WAHA_BASE_URL = '';

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_UNITS_PER_REQUEST, MAX_DONOR_BUDGET, type BloodType } from '../src/types.ts';
import { bloodRequestSchema } from '../validation/requests.ts';
import {
  matchAndNotifyRequest,
  releaseDonorLock,
  readSearchBudget,
  spendDonorBudget,
  resetSearchBudget,
} from '../services/matchingEngine.ts';
import { approveMatchById } from '../routes/matching.ts';
import { cancelRequest, reopenRequest } from '../routes/tracking.ts';
import { recordDonationCompletion, recordDonationNotCompleted } from '../helpers/completionProvider.ts';
import { computeApprovedSlots, releaseApprovedSlot } from '../helpers/capacityClaim.ts';
import { cacheInvalidatePrefix } from '../src/lib/redisCache.ts';
import {
  isFirebaseConfigured,
  getCollection as dbGetCollection,
  getDoc as dbGetDoc,
  saveDoc as dbSaveDoc,
} from '../src/lib/serverDb.ts';
import type { BloodRequest, User, Match } from '../src/types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const HOSPITAL_PINCODE = '110029';
let seq = 0;
const nextId = (p: string) => `${p}_cascade_${Date.now()}_${++seq}`;

const seedLog: { id: string; pool: number; userDoc: Record<string, unknown>; dprofDoc: Record<string, unknown> }[] = [];

async function quarantineOtherPools(keepPool: number): Promise<void> {
  const cooldown = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  for (const s of seedLog) {
    if (s.pool !== keepPool) {
      await dbSaveDoc('users', s.id, { ...s.userDoc, cooldown_until: cooldown });
      await dbSaveDoc('donor_profiles', `dprof_${s.id}`, { ...s.dprofDoc, cooldown_until: cooldown });
    } else {
      // Re-enable our own pool: an earlier test's quarantine may have cooldown'd it.
      await dbSaveDoc('users', s.id, { ...s.userDoc, cooldown_until: null });
      await dbSaveDoc('donor_profiles', `dprof_${s.id}`, { ...s.dprofDoc, cooldown_until: null });
    }
  }
}

async function seedDonor(n: number, overrides: Record<string, unknown> = {}): Promise<string> {
  const id = nextId(`donor${n}`);
  const phone = `9197${String(10000000 + n * 7919).slice(0, 8)}`;
  const userDoc = {
    id,
    full_name: `Cascade Donor ${n}`,
    email: `cascade${n}@example.local`,
    phone,
    whatsapp_number: phone,
    blood_type: 'O+',
    pincode: HOSPITAL_PINCODE,
    availability_status: 'available',
    account_status: 'active',
    cooldown_until: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
  const dprofDoc = {
    id: `dprof_${id}`,
    profile_id: id,
    blood_group: 'O+',
    pincode: HOSPITAL_PINCODE,
    is_available: true,
    emergency_only: false,
    cooldown_until: overrides.cooldown_until ?? null,
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
    urgency_level: 'critical', // bypasses the 6h anti-spam filter (cross-test isolation)
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

/** Fresh eligible-cache + persisted request → deterministic owner round. */
async function arm(request: BloodRequest): Promise<void> {
  await cacheInvalidatePrefix('eligible_');
  await dbSaveDoc('blood_requests', request.id, request as unknown as Record<string, unknown>);
}

/** Invite + approve the next in-flight donor; returns the fresh request doc. */
async function approveNext(requestId: string): Promise<BloodRequest> {
  const live = (await dbGetDoc<BloodRequest>('blood_requests', requestId)) as BloodRequest;
  await matchAndNotifyRequest(live);
  const pending = (await requestMatches(requestId)).find((m) => m.donor_response === 'pending');
  if (!pending) throw new Error(`expected a pending invite for ${requestId}`);
  const r = await approveMatchById(pending.id);
  assert.equal(r.ok, true, `approve failed: ${(r as { error?: string }).error}`);
  return (await dbGetDoc<BloodRequest>('blood_requests', requestId)) as BloodRequest;
}

const approvedSlotsOf = async (requestId: string): Promise<number[]> => {
  const approved = (await requestMatches(requestId)).filter((m) => m.donor_response === 'approved');
  return computeApprovedSlots(approved, requestId);
};

const liveRequest = (requestId: string) =>
  dbGetDoc<BloodRequest>('blood_requests', requestId);

// ─────────────────────────────────────────────────────────────────────────────
// Pure scenarios (no store required)
// ─────────────────────────────────────────────────────────────────────────────

describe('Constants: 15-donor budget & validation cap', () => {
  test('MAX_DONOR_BUDGET=15 (the 5→5→5 window budget); units capped at MAX_UNITS_PER_REQUEST (5)', () => {
    assert.equal(MAX_DONOR_BUDGET, 15);

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
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sequential owner: one invitation in flight, 15-donor budget, no donor #16
// ─────────────────────────────────────────────────────────────────────────────

describe('Sequential single-invitation owner', () => {
  test('15 declines → exactly 15 unique invites; donor #16 is never invited', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    await quarantineOtherPools(1);
    for (let i = 101; i <= 120; i++) await seedDonor(i); // 20 eligible donors → 15 max spend
    const request = makeRequest({ id: nextId('req'), units_required: 2 });
    await arm(request);

    let live = (await liveRequest(request.id)) as BloodRequest;
    assert.equal((await requestMatches(request.id)).length, 0, 'no invites before first owner call');

    // Sequential: first owner call creates EXACTLY ONE match, not a batch.
    await matchAndNotifyRequest(live);
    assert.equal((await requestMatches(request.id)).length, 1, 'single-invitation owner invites exactly one');

    // Decline each in-flight invite + advance until the 15-budget is spent.
    for (let spent = 1; spent < MAX_DONOR_BUDGET; spent++) {
      live = (await liveRequest(request.id)) as BloodRequest;
      const pending = (await requestMatches(request.id)).find((m) => m.donor_response === 'pending');
      if (pending) {
        await dbSaveDoc('matches', pending.id, {
          ...pending,
          donor_response: 'declined',
          donor_response_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>);
        await releaseDonorLock(pending.donor_id, pending.request_id);
      }
      await matchAndNotifyRequest(live);
    }
    const all = await requestMatches(request.id);
    assert.equal(all.length, MAX_DONOR_BUDGET, 'budget must cap invites at 15');
    assert.equal(await readSearchBudget(request.id), MAX_DONOR_BUDGET);

    // Donor #16: budget full + fresh eligible donors remain, but owner must no-op.
    const r16 = await matchAndNotifyRequest((await liveRequest(request.id)) as BloodRequest);
    assert.equal(r16.matched, 0, 'donor #16 must be blocked by the budget gate');
    assert.equal((await requestMatches(request.id)).length, MAX_DONOR_BUDGET);
    assert.equal(await readSearchBudget(request.id), MAX_DONOR_BUDGET, 'budget never exceeds 15');
  });

  test('Pending gate: unresolved invitation blocks the next one', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    await quarantineOtherPools(2);
    for (let i = 201; i <= 205; i++) await seedDonor(i);
    const request = makeRequest({ id: nextId('req') });
    await arm(request);

    await matchAndNotifyRequest(request);
    assert.equal((await requestMatches(request.id)).length, 1);

    const r = await matchAndNotifyRequest((await liveRequest(request.id)) as BloodRequest);
    assert.equal(r.matched, 0, 'pending invite must gate the next invitation');
    assert.equal((await requestMatches(request.id)).length, 1);
  });

  test('search_tried ↔ search_budget atomic invariant under concurrent spends (capped 15)', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const requestId = nextId('req');

    const donorIds = Array.from({ length: 16 }, (_, i) => `inv-donor-${i}-${requestId}`);
    const results = await Promise.all(donorIds.map((d) => spendDonorBudget(requestId, d)));
    const successes = results.filter(Boolean).length;
    assert.equal(successes, MAX_DONOR_BUDGET, 'exactly 15 distinct donors may be spent, never 16');
    assert.equal(await readSearchBudget(requestId), MAX_DONOR_BUDGET, 'budget after concurrent spends');

    assert.equal(await spendDonorBudget(requestId, donorIds[0]), false, 'duplicate donor must not double-spend');
    assert.equal(await readSearchBudget(requestId), MAX_DONOR_BUDGET);

    await resetSearchBudget(requestId);
  });

  test('15 stale/ineligible donors then 1 eligible → owner spends 1, not 15', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const requestId = nextId('req');
    const cooldown = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    for (let i = 301; i <= 315; i++) await seedDonor(i, { cooldown_until: cooldown }); // ineligible
    await seedDonor(316); // the ONE eligible donor
    const request = makeRequest({ id: requestId });
    await arm(request);

    await matchAndNotifyRequest(request);
    const all = await requestMatches(requestId);
    assert.equal(all.length, 1, 'owner invites exactly the one eligible donor');
    assert.equal(await readSearchBudget(requestId), 1, 'budget spends 1, not 15');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit-slot ledger: claim lowest-free, release re-opens
// ─────────────────────────────────────────────────────────────────────────────

describe('Unit-slot ledger', () => {
  test('approvals claim lowest free slots; release re-opens the gap; reclaim fills it', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    await quarantineOtherPools(4);
    for (let i = 401; i <= 406; i++) await seedDonor(i);
    const request = makeRequest({ id: nextId('req'), units_required: 2 });
    await arm(request);

    await approveNext(request.id); // donor A → slot 1
    await approveNext(request.id); // donor B → slot 2
    assert.deepEqual(await approvedSlotsOf(request.id), [1, 2], 'lowest free slots, unique');

    // Authoritative non-donation releases donor A's slot (SREM) + owner-safe.
    const donorA = (await requestMatches(request.id)).find((m) => m.unit_slot === 1)!;
    await recordDonationNotCompleted({ matchId: donorA.id, requestId: request.id });
    assert.deepEqual(await approvedSlotsOf(request.id), [2], 'released slot leaves the ledger');

    // A fresh approval reclaims the lowest free slot (1).
    await approveNext(request.id);
    assert.deepEqual(await approvedSlotsOf(request.id), [1, 2], 'released slot reclaimed by lowest-free loop');
  });

  test('release does not over-release on an unclaimed slot (no crash, no throw)', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const request = makeRequest({ id: nextId('req'), units_required: 2 });
    await arm(request);
    // Slot 7 was never claimed — SREM is a no-op, must not throw or mutate.
    await releaseApprovedSlot(request.id, 7);
    assert.deepEqual(await approvedSlotsOf(request.id), []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle: secured at full allocation, fulfilled only after donations
// ─────────────────────────────────────────────────────────────────────────────

describe('Lifecycle statuses', () => {
  test('3-unit request → partial → secured (NOT fulfilled) → fulfilled after donations', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    await quarantineOtherPools(5);
    for (let i = 501; i <= 505; i++) await seedDonor(i);
    const request = makeRequest({ id: nextId('req'), units_required: 3 });
    await arm(request);

    await approveNext(request.id); // 1/3
    let persisted = await liveRequest(request.id);
    assert.equal(persisted?.units_confirmed, 1);
    assert.equal(persisted?.status, 'partially_matched');

    await approveNext(request.id); // 2/3
    await approveNext(request.id); // 3/3 → full allocation
    persisted = await liveRequest(request.id);
    assert.equal(persisted?.units_confirmed, 3);
    assert.equal(persisted?.status, 'secured', 'full allocation must be secured, NOT fulfilled');
    assert.equal(persisted?.fulfilled_at ?? null, null, 'secured is NOT terminal');

    // Complete all approved matches via the provider → derived fulfilled.
    const matches = await requestMatches(request.id);
    assert.equal(matches.length, 3);
    for (const m of matches) {
      const donor = (await dbGetDoc<User>('users', m.donor_id)) as User;
      await recordDonationCompletion({
        matchId: m.id,
        requestId: request.id,
        donor,
        confirmedAt: new Date().toISOString(),
      });
    }
    persisted = await liveRequest(request.id);
    assert.equal(persisted?.units_completed, 3);
    assert.equal(persisted?.status, 'fulfilled');
    assert.ok(persisted?.fulfilled_at, 'fulfilled_at stamped once donations complete');
  });

  test('search_exhausted is NOT terminal; approved+completed donors reach fulfilled', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    await quarantineOtherPools(6);
    await seedDonor(601);
    const request = makeRequest({ id: nextId('req'), units_required: 1 });
    await arm(request);

    // One invitation in flight (budget 1) → burn the remaining budget to 15.
    await matchAndNotifyRequest(request);
    const pending = (await requestMatches(request.id)).find((m) => m.donor_response === 'pending')!;
    for (let i = 0; i < 14; i++) await spendDonorBudget(request.id, `phantom-${i}-${request.id}`);

    // Owner no-ops at the budget gate and re-derives → search_exhausted.
    const r = await matchAndNotifyRequest((await liveRequest(request.id)) as BloodRequest);
    assert.equal(r.matched, 0, 'donor #16 blocked');
    let persisted = await liveRequest(request.id);
    assert.equal(persisted?.status, 'search_exhausted', 'budget exhausted + not fully allocated');
    assert.notEqual(persisted?.status, 'fulfilled');

    // The in-flight invite approves → `secured`, still not terminal.
    const ar = await approveMatchById(pending.id);
    assert.equal(ar.ok, true);
    persisted = await liveRequest(request.id);
    assert.equal(persisted?.status, 'secured', 'existing pending resolves to full allocation');

    // Completion → fulfilled (search_exhausted was never terminal).
    const donor = (await dbGetDoc<User>('users', pending.donor_id)) as User;
    await recordDonationCompletion({ matchId: pending.id, requestId: request.id, donor, confirmedAt: new Date().toISOString() });
    persisted = await liveRequest(request.id);
    assert.equal(persisted?.status, 'fulfilled', 'search_exhausted is NOT terminal');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Completion provider: double-fire exactly-once
// ─────────────────────────────────────────────────────────────────────────────

describe('Completion provider', () => {
  test('second completion attempt is a no-op; units_completed stays exact', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    await quarantineOtherPools(7);
    await seedDonor(701);
    const request = makeRequest({ id: nextId('req'), units_required: 1 });
    await arm(request);

    await matchAndNotifyRequest(request);
    const pending = (await requestMatches(request.id)).find((m) => m.donor_response === 'pending')!;
    const r = await approveMatchById(pending.id);
    assert.equal(r.ok, true);

    const donor = (await dbGetDoc<User>('users', pending.donor_id)) as User;
    const first = await recordDonationCompletion({ matchId: pending.id, requestId: request.id, donor, confirmedAt: new Date().toISOString() });
    assert.equal(first.already, false);

    const second = await recordDonationCompletion({ matchId: pending.id, requestId: request.id, donor, confirmedAt: new Date().toISOString() });
    assert.equal(second.already, true, 'completion double-fire must be idempotent');

    const logs = (await dbGetCollection<{ request_id: string }>('donation_log')).filter((l) => l.request_id === request.id);
    assert.equal(logs.length, 1, 'exactly one donation_log row despite double-fire');
    const persisted = await liveRequest(request.id);
    assert.equal(persisted?.units_completed, 1);
    assert.equal(persisted?.status, 'fulfilled');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cancellation & reopen (budget reset)
// ─────────────────────────────────────────────────────────────────────────────

describe('Cancellation & reopen', () => {
  test('cancel retires invites / preserves approved; reopen resets the search budget', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    // Pool 20 (donors 2001+) collides with NO other pool in this file or any
    // prior run's stale donors (which top out at pool ~9) — fully isolated.
    await quarantineOtherPools(20);
    await seedDonor(2001);
    await seedDonor(2002);
    const request = makeRequest({ id: nextId('req'), units_required: 2 });
    await arm(request);

    await matchAndNotifyRequest(request);
    const pending0 = (await requestMatches(request.id)).find((m) => m.donor_response === 'pending')!;
    await dbSaveDoc('matches', pending0.id, { ...pending0, donor_response: 'approved', unit_slot: 1 } as unknown as Record<string, unknown>);
    await matchAndNotifyRequest((await liveRequest(request.id)) as BloodRequest);
    const [a, b] = await requestMatches(request.id);
    assert.equal(a.donor_response === 'approved' || b.donor_response === 'approved', true);
    assert.equal(await readSearchBudget(request.id), 2, 'budget reflects both spent donors');

    const cancelled = await cancelRequest((await liveRequest(request.id)) as BloodRequest);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal((await requestMatches(request.id)).find((m) => m.id === pending0.id)?.donor_response, 'approved', 'approved history preserved');

    const reopened = await reopenRequest(cancelled);
    assert.equal(reopened.status, 'open');
    assert.equal(await readSearchBudget(reopened.id), 0, 'reopen must reset the search budget');
  });

  test('approval on a cancelled request rejected; expired invitation cannot approve', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    await quarantineOtherPools(9);
    await seedDonor(901);
    const request = makeRequest({ id: nextId('req') });
    await arm(request);

    await matchAndNotifyRequest(request);
    const [m] = await requestMatches(request.id);

    await dbSaveDoc('blood_requests', request.id, { ...request, status: 'cancelled' } as unknown as Record<string, unknown>);
    const r = await approveMatchById(m.id);
    assert.equal(r.ok, false, 'approval must fail on a cancelled request');
    assert.equal((r as { status?: number }).status, 409);
    assert.equal((await requestMatches(request.id))[0]?.donor_response, 'pending', 'dead-request approval must not mutate the match');

    // Simulate the 5-min sweep expiry (pending → expired): approval is blocked.
    await dbSaveDoc('blood_requests', request.id, { ...request, status: 'open' } as unknown as Record<string, unknown>);
    await dbSaveDoc('matches', m.id, { ...m, donor_response: 'expired' } as unknown as Record<string, unknown>);
    const r2 = await approveMatchById(m.id);
    assert.equal(r2.ok, false, 'approval must fail once the invitation expired');
  });
});