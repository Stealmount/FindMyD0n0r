/**
 * Matching National Fallback / Index Coverage Regression Tests
 *
 * Proves the production matching fix:
 *   1. findEligibleDonorsFromDB returns null (not []) when the pincode-bounded
 *      index scan finds no candidates → callers must fall back to the full scan.
 *   2. findEligibleDonors falls back to the full users scan for donors OUTSIDE
 *      the request hospital's 3-digit-pincode-prefix neighborhood.
 *   3. The shared isDonorEligibleForRequest predicate excludes unavailable /
 *      cooldown / suspended / anti-spam / incompatible / self-match donors on
 *      both acquisition paths.
 *
 * Run:
 *   npm run test:matching-national-fallback
 *
 * Uses the same store-backed test harness as the other suites: real Upstash
 * with the fmdt: test prefix (setup-env.ts), flushed by the pretest hook.
 */

import './setup-env.ts';

import test, { describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { saveDoc } from '../src/lib/serverDb.ts';
import { cacheInvalidatePrefix } from '../src/lib/redisCache.ts';
import {
  findEligibleDonors,
  findEligibleDonorsFromDB,
  isDonorEligibleForRequest,
} from '../services/matchingEngine.ts';
import type { BloodRequest, User } from '../src/types.ts';

const today = new Date().toISOString().split('T')[0];

function makeUser(overrides: Partial<User> & { id: string }): User {
  return {
    id: overrides.id,
    full_name: `Donor ${overrides.id}`,
    email: `donor${overrides.id}@test.com`,
    phone: `91700000${overrides.id.replace(/\D/g, '').padStart(4, '0')}`,
    whatsapp_number: `91700000${overrides.id.replace(/\D/g, '').padStart(4, '0')}`,
    blood_type: 'O+',
    donation_frequency: 'occasional',
    last_donation_date: null,
    cooldown_until: null,
    pincode: '400001',
    area: 'Fort',
    city: 'Mumbai',
    availability_status: 'available',
    number_sharing_pref: 'on_approval',
    emergency_only: false,
    account_status: 'active',
    whatsapp_verified: true,
    profile_complete: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeRequest(overrides: Partial<BloodRequest> & { id: string }): BloodRequest {
  return {
    id: overrides.id,
    tracking_code: `BLD-2026-${overrides.id}`,
    patient_name: 'Test Patient',
    blood_type_needed: 'O+',
    units_required: 1,
    hospital_name: 'AIIMS Delhi',
    hospital_pincode: '110029',
    hospital_area: 'Ansari Nagar',
    hospital_city: 'New Delhi',
    urgency_level: 'urgent',
    requester_name: 'Test Requester',
    requester_email: 'requester@fallback-test.com',
    requester_phone: '919999999999',
    additional_notes: '',
    status: 'open',
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    fulfilled_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

before(async () => {
  // Isolate cache: the pretest hook already flushed the store; also clear any
  // eligible_ keys seeded by other suites in this run.
  await cacheInvalidatePrefix('eligible_');
});

// ── 1. Shared predicate (pure) ────────────────────────────────────────────────
describe('isDonorEligibleForRequest', () => {
  const req = makeRequest({ id: 'predreq', requester_email: 'req@pred.com' });
  const ctx = (recent = new Set<string>()) => ({ today, recentAlertedDonors: recent });

  test('admits an active, available, compatible donor', () => {
    const d = makeUser({ id: 'u-ok', blood_type: 'O+' });
    assert.equal(isDonorEligibleForRequest(d, req, ctx()), true);
  });

  test('excludes suspended / unavailable / cooldown / unverified / incomplete', () => {
    const cases: Partial<User>[] = [
      { account_status: 'banned' },
      { availability_status: 'unavailable' },
      { cooldown_until: today },
      { whatsapp_verified: false },
      { profile_complete: false },
      { is_available: false },
    ];
    for (const patch of cases) {
      const d = makeUser({ id: 'u-x', blood_type: 'O+', ...patch });
      assert.equal(isDonorEligibleForRequest(d, req, ctx()), false, JSON.stringify(patch));
    }
  });

  test('excludes incompatible blood, anti-spam-throttled, and self-match donors', () => {
    const incompatible = makeUser({ id: 'u-b', blood_type: 'B+' });
    assert.equal(isDonorEligibleForRequest(incompatible, req, ctx()), false);

    const throttled = makeUser({ id: 'u-t', blood_type: 'O+' });
    assert.equal(isDonorEligibleForRequest(throttled, req, ctx(new Set(['u-t']))), false);
    // Critical urgency bypasses the throttle.
    const criticalReq = { ...req, urgency_level: 'critical' as const };
    assert.equal(isDonorEligibleForRequest(throttled, criticalReq, ctx(new Set(['u-t']))), true);

    const selfMatch = makeUser({ id: 'u-s', blood_type: 'O+', phone: req.requester_phone });
    assert.equal(isDonorEligibleForRequest(selfMatch, req, ctx()), false);
  });
});

// ── 2. Index path returns null on empty neighborhood ─────────────────────────
describe('findEligibleDonorsFromDB', () => {
  test('returns null (not []) when the pincode neighborhood has no candidates', async () => {
    // Seed a compatible donor at 400001 (Mumbai) — NOT in the 110xxx neighborhood.
    await saveDoc('donor_profiles', 'dp-400', {
      profile_id: 'dp-400',
      blood_group: 'O+',
      pincode: '400001',
      is_available: true,
      profile_complete: true,
    });
    const res = await findEligibleDonorsFromDB(makeRequest({ id: 'nulldb', hospital_pincode: '110029' }));
    assert.equal(res, null, 'empty index neighborhood must signal full-scan fallback');
  });
});

// ── 3. Fallback: out-of-neighborhood donor is found via full scan ────────────
describe('findEligibleDonors national fallback', () => {
  test('matches an eligible donor OUTSIDE the 3-digit-prefix neighborhood', async () => {
    const donor = makeUser({ id: 'fallback-donor', blood_type: 'O+', pincode: '400001', city: 'Mumbai' });
    await saveDoc('users', donor.id, { ...donor, is_available: true });

    const request = makeRequest({ id: 'fallback-req', hospital_pincode: '110029' });
    const result = await findEligibleDonors(request);

    assert.ok(result.some((d) => d.id === donor.id), 'out-of-neighborhood donor must be matched via fallback');
  });

  test('does NOT match unavailable/suspended/cooldown donors even via fallback', async () => {
    const bad = [
      makeUser({ id: 'fb-unavail', blood_type: 'O+', availability_status: 'unavailable' }),
      makeUser({ id: 'fb-susp', blood_type: 'O+', account_status: 'banned' }),
      makeUser({ id: 'fb-cool', blood_type: 'O+', cooldown_until: today }),
      makeUser({ id: 'fb-incompat', blood_type: 'B+' }),
    ];
    for (const d of bad) await saveDoc('users', d.id, d);

    const result = await findEligibleDonors(makeRequest({ id: 'fallback-req2', hospital_pincode: '110029' }));
    for (const d of bad) {
      assert.ok(!result.some((r) => r.id === d.id), `${d.id} must be excluded`);
    }
  });

  test('in-neighborhood donor still found via the index path (fast path intact)', async () => {
    await saveDoc('donor_profiles', 'dp-local', {
      profile_id: 'dp-local',
      blood_group: 'O+',
      pincode: '110029',
      is_available: true,
      profile_complete: true,
    });
    await saveDoc('profiles', 'dp-local', { id: 'dp-local', full_name: 'Local Donor', phone: '917222222222', whatsapp_verified: true });

    const result = await findEligibleDonors(makeRequest({ id: 'local-req', hospital_pincode: '110029' }));
    assert.ok(result.some((d) => d.id === 'dp-local'), 'index-path donor must still match');
  });
});
