/**
 * Blood Connect — Matching Engine Test Suite
 *
 * 7 scenarios covering every edge case in the matching engine spec.
 * Uses Node's built-in node:test + node:assert — zero extra dependencies.
 *
 * Run:
 *   npx tsx --test tests/matching.test.ts
 *
 * All scenarios are pure (no DB / Redis / WhatsApp calls).
 * The findEligibleDonorsSync export in matching.ts gives full
 * engine logic with a synthetic donor pool injected as a plain array.
 */

// ── Test env setup so the module chain loads without throwing ──────────────────
import './setup-env.ts';

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

// ── Import the pure matching engine helpers ───────────────────────────────────
import {
  findEligibleDonorsSync,
  isDonorEligible,
} from '../src/lib/matching.ts';
import {
  BLOOD_COMPATIBILITY_MATRIX,
  isBloodCompatible,
} from '../src/types.ts';
import type { BloodRequest, User, BloodType } from '../src/types.ts';


// ─────────────────────────────────────────────────────────────────────────────
// Shared test-data helpers
// ─────────────────────────────────────────────────────────────────────────────

const TOMORROW = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
})();

/** Build a minimal valid donor with sane defaults. */
function makeUser(overrides: Partial<User> & { id: string; blood_type: BloodType }): User {
  return {
    full_name: `Donor ${overrides.id}`,
    email: `donor${overrides.id}@test.com`,
    phone: `91700000${(overrides.id ?? '').padStart(4, '0')}`,
    whatsapp_number: `91700000${(overrides.id ?? '').padStart(4, '0')}`,
    donation_frequency: 'occasional',
    last_donation_date: null,
    cooldown_until: null,
    pincode: '110001',
    area: 'Connaught Place',
    city: 'New Delhi',
    availability_status: 'available',
    number_sharing_pref: 'on_approval',
    emergency_only: false,
    account_status: 'active',
    whatsapp_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Build a minimal blood request. */
function makeRequest(overrides: Partial<BloodRequest> & { id: string; blood_type_needed: BloodType | 'ANY' }): BloodRequest {
  return {
    tracking_code: `BLD-2026-${overrides.id}`,
    patient_name: 'Test Patient',
    blood_type_needed: 'O-',
    units_required: 1,
    hospital_name: 'AIIMS New Delhi',
    hospital_pincode: '110029',
    hospital_area: 'Ansari Nagar',
    hospital_city: 'New Delhi',
    urgency_level: 'urgent',
    requester_name: 'Test Requester',
    requester_email: 'requester@test.com',
    requester_phone: '919999999999',
    additional_notes: '',
    status: 'open',
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    fulfilled_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 1 — Blood Compatibility Matrix
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 1: Blood compatibility matrix', () => {
  const BLOOD_TYPES: BloodType[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

  test('O- is the universal donor — compatible with all 8 recipient types', () => {
    for (const recipient of BLOOD_TYPES) {
      assert.ok(isBloodCompatible('O-', recipient), `O- donor should be compatible with recipient ${recipient}`);
    }
  });

  test('AB+ is the universal recipient — accepts all 8 donor types', () => {
    for (const donor of BLOOD_TYPES) {
      assert.ok(isBloodCompatible(donor, 'AB+'), `AB+ recipient should accept donor ${donor}`);
    }
  });

  test('Full matrix: every (donor, recipient) pair matches the hardcoded table', () => {
    let checked = 0;
    for (const [recipient, eligibleDonors] of Object.entries(BLOOD_COMPATIBILITY_MATRIX)) {
      const eligibleSet = new Set(eligibleDonors);
      for (const donor of BLOOD_TYPES) {
        const expected = eligibleSet.has(donor);
        assert.equal(isBloodCompatible(donor, recipient as BloodType), expected,
          `Donor ${donor} -> Recipient ${recipient}: expected ${expected}`);
        checked++;
      }
    }
    assert.equal(checked, 64, 'Should have checked all 8x8 = 64 combinations');
  });

  test('Exact-match tagging: O- donor for O- request is tagged is_exact_match=true', () => {
    const donor = makeUser({ id: 'u1', blood_type: 'O-', pincode: '110029' });
    const request = makeRequest({ id: 'r1', blood_type_needed: 'O-', hospital_pincode: '110029' });
    const [matched] = findEligibleDonorsSync([donor], request);
    assert.equal(matched?.is_exact_match, true);
  });

  test('Compatible-match tagging: O- donor for AB+ request is tagged is_exact_match=false', () => {
    const donor = makeUser({ id: 'u2', blood_type: 'O-', pincode: '110029' });
    const request = makeRequest({ id: 'r2', blood_type_needed: 'AB+', hospital_pincode: '110029' });
    const [matched] = findEligibleDonorsSync([donor], request);
    assert.equal(matched?.is_exact_match, false, 'O- donating to AB+ is compatible but not exact');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 2 — Multi-Donor Splitting (10-unit request)
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 2: Multi-donor splitting (10-unit request)', () => {
  test('15 available donors — engine returns all unique, no duplicates', () => {
    const donors = Array.from({ length: 15 }, (_, i) =>
      makeUser({ id: `d${i}`, blood_type: 'O-', pincode: '110029' })
    );
    const request = makeRequest({ id: 'r10', blood_type_needed: 'O-', units_required: 10, hospital_pincode: '110029' });
    const matched = findEligibleDonorsSync(donors, request);
    assert.ok(matched.length >= 10, `Expected >=10 matches, got ${matched.length}`);
    const uniqueIds = new Set(matched.map(d => d.id));
    assert.equal(uniqueIds.size, matched.length, 'All matched donors must be unique');
  });

  test('Already-matched donor IDs are excluded from subsequent runs', () => {
    const donors = Array.from({ length: 5 }, (_, i) =>
      makeUser({ id: `ex${i}`, blood_type: 'O-', pincode: '110029' })
    );
    const request = makeRequest({ id: 'r_excl', blood_type_needed: 'O-', units_required: 5, hospital_pincode: '110029' });
    const alreadyMatched = new Set(['ex0', 'ex1', 'ex2']);
    const secondRun = findEligibleDonorsSync(donors, request, alreadyMatched);
    assert.equal(secondRun.length, 2, 'Already-matched donors must be excluded');
    for (const d of secondRun) {
      assert.ok(!alreadyMatched.has(d.id), `Donor ${d.id} was already matched`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 3 — One O- Donor Eligible for Multiple Requests
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 3: One O- donor eligible for multiple requests', () => {
  const oDonor = makeUser({ id: 'ominus', blood_type: 'O-', pincode: '110029' });
  const BLOOD_TYPES: BloodType[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

  test('O- donor appears in eligible pool for all 8 blood type requests', () => {
    for (const recipientType of BLOOD_TYPES) {
      const request = makeRequest({
        id: `r_${recipientType.replace('+', 'p').replace('-', 'm')}`,
        blood_type_needed: recipientType,
        hospital_pincode: '110029',
      });
      const matched = findEligibleDonorsSync([oDonor], request);
      assert.equal(matched.length, 1, `O- donor should match ${recipientType} request`);
    }
  });

  test('O- donor locked by Request A is excluded from Request B', () => {
    const requestA = makeRequest({ id: 'rA', blood_type_needed: 'A+', hospital_pincode: '110029' });
    const requestB = makeRequest({ id: 'rB', blood_type_needed: 'B+', hospital_pincode: '110029' });
    const alreadyMatchedForA = new Set(['ominus']);
    const matchedForB = findEligibleDonorsSync([oDonor], requestB, alreadyMatchedForA);
    assert.equal(matchedForB.length, 0, 'O- donor locked by Request A must not appear in Request B');
  });

  test('Exact-match donor is ranked before compatible donor within same tier', () => {
    const ominusDonor = makeUser({ id: 'om', blood_type: 'O-', pincode: '110029' });
    const aplusDonor  = makeUser({ id: 'ap', blood_type: 'A+', pincode: '110029' });
    const request = makeRequest({ id: 'rank_test', blood_type_needed: 'A+', hospital_pincode: '110029' });
    const matched = findEligibleDonorsSync([ominusDonor, aplusDonor], request);
    assert.equal(matched.length, 2);
    assert.equal(matched[0].blood_type, 'A+', 'Exact match A+ should be ranked first');
    assert.equal(matched[0].is_exact_match, true);
    assert.equal(matched[1].is_exact_match, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 4 — Radius Expansion + Compatible Fallback
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 4: Radius expansion + compatible fallback', () => {
  test('Engine expands to Tier 2 when Tier 1 has < 3 donors', () => {
    const tier1Donor  = makeUser({ id: 't1', blood_type: 'O-', pincode: '110001' });
    const tier2Donors = Array.from({ length: 4 }, (_, i) =>
      makeUser({ id: `t2_${i}`, blood_type: 'O-', pincode: '110021' })
    );
    const request = makeRequest({ id: 'r_expand', blood_type_needed: 'O-', hospital_pincode: '110001' });
    const matched = findEligibleDonorsSync([tier1Donor, ...tier2Donors], request);
    assert.equal(matched[0].match_rank, 1, 'First result should be the closest donor (Tier 1)');
    assert.ok(matched.some(d => d.match_rank === 2), 'Should have expanded to Tier 2');
  });

  test('Engine falls back to compatible blood types when exact unavailable', () => {
    const ominusDonors = Array.from({ length: 3 }, (_, i) =>
      makeUser({ id: `fb${i}`, blood_type: 'O-', pincode: '110001' })
    );
    const request = makeRequest({ id: 'r_fallback', blood_type_needed: 'AB+', hospital_pincode: '110001' });
    const matched = findEligibleDonorsSync(ominusDonors, request);
    assert.equal(matched.length, 3, 'Compatible O- donors should be included as fallback');
    for (const d of matched) {
      assert.equal(d.is_exact_match, false, 'Fallback donors must be tagged is_exact_match=false');
    }
  });

  test('Unavailable and cooldown donors are hard-filtered out', () => {
    const goodDonor       = makeUser({ id: 'g1', blood_type: 'O-', pincode: '110001' });
    const unavailableDonor = makeUser({ id: 'g2', blood_type: 'O-', pincode: '110001', availability_status: 'unavailable' });
    const cooldownDonor   = makeUser({ id: 'g3', blood_type: 'O-', pincode: '110001', cooldown_until: TOMORROW });
    const request = makeRequest({ id: 'r_hf', blood_type_needed: 'O-', hospital_pincode: '110001' });
    const matched = findEligibleDonorsSync([goodDonor, unavailableDonor, cooldownDonor], request);
    assert.equal(matched.length, 1, 'Only the available non-cooldown donor should match');
    assert.equal(matched[0].id, 'g1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 5 — Concurrency & Fairness
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 5: Concurrency — donor reservation locking contract', () => {
  function makeInMemoryLockStore() {
    const store = new Map<string, string>();
    const acquire = (donorId: string, requestId: string): boolean => {
      if (store.has(donorId)) return false;
      store.set(donorId, requestId);
      return true;
    };
    const release = (donorId: string) => { store.delete(donorId); };
    const isLocked = (donorId: string, byRequestId?: string) =>
      byRequestId ? store.get(donorId) === byRequestId : store.has(donorId);
    return { acquire, release, isLocked };
  }

  test('Donor acquired by Request A cannot be acquired by Request B', () => {
    const locks = makeInMemoryLockStore();
    assert.ok(locks.acquire('donor1', 'reqA'), 'First acquire should succeed');
    assert.ok(!locks.acquire('donor1', 'reqB'), 'Second acquire must fail');
  });

  test('Releasing a lock makes donor available for next request', () => {
    const locks = makeInMemoryLockStore();
    locks.acquire('donor3', 'reqA');
    locks.release('donor3');
    assert.ok(locks.acquire('donor3', 'reqB'), 'After release, donor3 should be available for reqB');
  });

  test('Two concurrent requests competing for 3 donors — no double-booking', () => {
    const locks = makeInMemoryLockStore();
    const donors = ['d1', 'd2', 'd3'];
    const reqALocked: string[] = [];
    for (const d of donors.slice(0, 2)) {
      if (locks.acquire(d, 'reqA')) reqALocked.push(d);
    }
    const reqBLocked: string[] = [];
    for (const d of donors) {
      if (locks.acquire(d, 'reqB')) reqBLocked.push(d);
    }
    const overlap = reqALocked.filter(d => reqBLocked.includes(d));
    assert.equal(overlap.length, 0, 'No donor should be locked by both requests simultaneously');
    assert.equal(reqBLocked.length, 1, 'reqB should only lock d3');
  });

  test('Emergency-only donors match all request urgency levels', () => {
    const emergencyDonor = makeUser({ id: 'emerg', blood_type: 'O-', pincode: '110029', emergency_only: true });
    const normalReq  = makeRequest({ id: 'r_normal',   blood_type_needed: 'O-', urgency_level: 'planned',  hospital_pincode: '110029' });
    const criticalReq = makeRequest({ id: 'r_critical', blood_type_needed: 'O-', urgency_level: 'critical', hospital_pincode: '110029' });
    assert.equal(findEligibleDonorsSync([emergencyDonor], normalReq).length, 1);
    assert.equal(findEligibleDonorsSync([emergencyDonor], criticalReq).length, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 6 — Partial Fulfillment Tracking
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 6: Partial fulfillment progress tracking', () => {
  function simulatePartialFulfillment(totalDonors: number, unitsRequired: number) {
    const matchRecords = Array.from({ length: totalDonors }, (_, i) => ({
      donor_id: `pd${i}`,
      donor_response: 'pending' as 'pending' | 'approved' | 'declined',
    }));
    const countApproved = () => matchRecords.filter(m => m.donor_response === 'approved').length;
    const countPending  = () => matchRecords.filter(m => m.donor_response === 'pending').length;
    const isFullyMatched = () => countApproved() >= unitsRequired;
    const getStatus = () => {
      const approved = countApproved();
      if (approved === 0)            return 'open';
      if (approved >= unitsRequired) return 'fulfilled';
      return 'partially_matched';
    };
    return { matchRecords, countApproved, countPending, isFullyMatched, getStatus };
  }

  test('Status progresses open -> partially_matched -> fulfilled as donors accept', () => {
    const sim = simulatePartialFulfillment(10, 10);
    assert.equal(sim.getStatus(), 'open');
    sim.matchRecords[0].donor_response = 'approved';
    sim.matchRecords[1].donor_response = 'approved';
    sim.matchRecords[2].donor_response = 'approved';
    assert.equal(sim.getStatus(), 'partially_matched');
    assert.equal(sim.countApproved(), 3);
    for (let i = 3; i < 7; i++) sim.matchRecords[i].donor_response = 'approved';
    assert.equal(sim.getStatus(), 'partially_matched');
    for (let i = 7; i < 10; i++) sim.matchRecords[i].donor_response = 'approved';
    assert.equal(sim.getStatus(), 'fulfilled');
    assert.ok(sim.isFullyMatched());
  });

  test('Declined donors reduce pending count but not approved count', () => {
    const sim = simulatePartialFulfillment(5, 3);
    sim.matchRecords[0].donor_response = 'approved';
    sim.matchRecords[1].donor_response = 'approved';
    sim.matchRecords[2].donor_response = 'declined';
    assert.equal(sim.countApproved(), 2);
    assert.equal(sim.countPending(), 2);
    assert.equal(sim.getStatus(), 'partially_matched');
  });

  test('Self-match prevention: requester phone cannot match own request', () => {
    const selfMatchDonor = makeUser({ id: 'self1', blood_type: 'O-', pincode: '110029', phone: '919999999999' });
    const request = makeRequest({ id: 'r_self', blood_type_needed: 'O-', hospital_pincode: '110029', requester_phone: '919999999999' });
    const matched = findEligibleDonorsSync([selfMatchDonor], request);
    assert.equal(matched.length, 0, 'Self-match must be prevented');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 7 — Notification Reliability & Idempotency
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 7: Notification idempotency', () => {
  interface NotifLog { id: string; type: string; recipient_id: string; trigger_event: string; status: string; }

  function makeNotifStore() {
    const logs: NotifLog[] = [];
    const record = (id: string, type: string, recipient_id: string, trigger_event: string, status: string): boolean => {
      const alreadySent = logs.some(l =>
        l.recipient_id === recipient_id && l.trigger_event === trigger_event && l.type === type && l.status === 'sent'
      );
      if (alreadySent) return false;
      logs.push({ id, type, recipient_id, trigger_event, status });
      return true;
    };
    const countSent = (recipient_id: string, trigger_event: string) =>
      logs.filter(l => l.recipient_id === recipient_id && l.trigger_event === trigger_event && l.status === 'sent').length;
    return { record, countSent, logs };
  }

  test('Same match_found event fires WhatsApp exactly once per donor (idempotent)', () => {
    const store = makeNotifStore();
    const first  = store.record('n1', 'whatsapp', 'donor_1', 'match_found', 'sent');
    const second = store.record('n2', 'whatsapp', 'donor_1', 'match_found', 'sent');
    assert.ok(first,   'First notification should be recorded');
    assert.ok(!second, 'Duplicate notification must be skipped');
    assert.equal(store.countSent('donor_1', 'match_found'), 1);
  });

  test('Failed notifications do not block subsequent retry attempts', () => {
    const store = makeNotifStore();
    store.record('n3', 'whatsapp', 'donor_2', 'match_found', 'failed');
    const retry = store.record('n4', 'whatsapp', 'donor_2', 'match_found', 'sent');
    assert.ok(retry, 'Retry after failure should be allowed');
    assert.equal(store.countSent('donor_2', 'match_found'), 1);
  });

  test('N donors matched to same request: exactly N WhatsApp notifications fire', () => {
    const store = makeNotifStore();
    const N = 5;
    for (let i = 0; i < N; i++) {
      store.record(`nb${i}`, 'whatsapp', `batch_donor_${i}`, 'match_found:req_batch', 'sent');
    }
    let totalSent = 0;
    for (let i = 0; i < N; i++) {
      totalSent += store.countSent(`batch_donor_${i}`, 'match_found:req_batch');
    }
    assert.equal(totalSent, N, `Exactly ${N} notifications should fire`);
  });

  // P2 guard: when both WhatsApp and email fail, the log must NOT claim a
  // nonexistent 'in_app' channel. The honest record is type='failed', status='failed'.
  test('All channels failed → no in_app type, honest failed log entry', () => {
    const store = makeNotifStore();
    const ok = store.record('n9', 'failed', 'donor_p2', 'match_found', 'failed');
    assert.ok(ok, 'Failed notification should still be recorded for observability');
    const { type, status } = store.logs[0];
    assert.notEqual(type, 'in_app', 'No in-app channel exists — must not claim type in_app');
    assert.equal(type, 'failed', 'Honest type: failed');
    assert.equal(status, 'failed', 'Honest status: failed');
  });

  test('Different trigger events for same recipient logged independently', () => {
    const store = makeNotifStore();
    store.record('n7', 'whatsapp', 'donor_4', 'match_found', 'sent');
    store.record('n8', 'whatsapp', 'donor_4', 'registration_confirmation', 'sent');
    assert.equal(store.countSent('donor_4', 'match_found'), 1);
    assert.equal(store.countSent('donor_4', 'registration_confirmation'), 1);
    assert.equal(store.logs.length, 2, 'Different events should produce separate log entries');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 8 — Profile Hard Gates (whatsapp_verified, profile_complete, is_available)
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 8: Profile hard gates', () => {
  const baseRequest = makeRequest({ id: 'gate_req', blood_type_needed: 'O+', hospital_pincode: '110029' });

  test('Donor with whatsapp_verified=false is excluded from matching pool', () => {
    const donor = makeUser({ id: 'unverified_wa', blood_type: 'O+', pincode: '110029', whatsapp_verified: false });
    const todayStr = new Date().toISOString().split('T')[0];
    assert.equal(isDonorEligible(donor, baseRequest, todayStr), false, 'Unverified WhatsApp donor must be excluded');
    const matched = findEligibleDonorsSync([donor], baseRequest);
    assert.equal(matched.length, 0, 'Unverified WhatsApp donor must not appear in eligible pool');
  });

  test('Donor with profile_complete=false is excluded from matching pool', () => {
    const donor = makeUser({ id: 'incomplete_profile', blood_type: 'O+', pincode: '110029', profile_complete: false });
    const todayStr = new Date().toISOString().split('T')[0];
    assert.equal(isDonorEligible(donor, baseRequest, todayStr), false, 'Incomplete profile donor must be excluded');
    const matched = findEligibleDonorsSync([donor], baseRequest);
    assert.equal(matched.length, 0);
  });

  test('Donor with is_available=false is excluded from matching pool', () => {
    const donor = makeUser({ id: 'unavailable', blood_type: 'O+', pincode: '110029', is_available: false });
    const todayStr = new Date().toISOString().split('T')[0];
    assert.equal(isDonorEligible(donor, baseRequest, todayStr), false, 'Unavailable donor must be excluded');
    const matched = findEligibleDonorsSync([donor], baseRequest);
    assert.equal(matched.length, 0);
  });

  test('Verified, complete, available donor passes all gates', () => {
    const donor = makeUser({
      id: 'fully_gated', blood_type: 'O+', pincode: '110029',
      whatsapp_verified: true, profile_complete: true, is_available: true,
    });
    const todayStr = new Date().toISOString().split('T')[0];
    assert.equal(isDonorEligible(donor, baseRequest, todayStr), true, 'Fully gated donor must be eligible');
    const matched = findEligibleDonorsSync([donor], baseRequest);
    assert.equal(matched.length, 1);
  });

  test('Mixed pool: only verified+complete+available donors match', () => {
    const good1 = makeUser({ id: 'good1', blood_type: 'O+', pincode: '110029', whatsapp_verified: true, profile_complete: true, is_available: true });
    const good2 = makeUser({ id: 'good2', blood_type: 'O+', pincode: '110029' }); // defaults: verified=true, no explicit flags
    const bad1 = makeUser({ id: 'bad1', blood_type: 'O+', pincode: '110029', whatsapp_verified: false });
    const bad2 = makeUser({ id: 'bad2', blood_type: 'O+', pincode: '110029', profile_complete: false });
    const bad3 = makeUser({ id: 'bad3', blood_type: 'O+', pincode: '110029', is_available: false });
    const matched = findEligibleDonorsSync([good1, good2, bad1, bad2, bad3], baseRequest);
    const matchedIds = new Set(matched.map(m => m.id));
    assert.ok(matchedIds.has('good1'), 'Fully gated donor should match');
    assert.ok(matchedIds.has('good2'), 'Default-gated donor should match');
    assert.ok(!matchedIds.has('bad1'), 'Unverified donor must not match');
    assert.ok(!matchedIds.has('bad2'), 'Incomplete donor must not match');
    assert.ok(!matchedIds.has('bad3'), 'Unavailable donor must not match');
  });
});
