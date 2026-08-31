/**
 * Focused regression tests for the donation-history + configurable-cooldown fix.
 *
 * Covers ONLY what changed:
 *   A. `resolveCooldownDays` — donor-selected 60/90/120 honored; default 90 when
 *      absent or invalid.
 *   B. `computeCooldownUntil` — base(donation date) + selected days.
 *   C. `recordDonationCompletion` uses the donor's selected cooldown (60/90/120)
 *      for `users.cooldown_until`, and writes an idempotent `donation_<matchId>`
 *      donation_log row — proving successful donations persist to history and a
 *      repeat completion never duplicates the row (idempotency).
 *   D. Admin hole closed: a donated completion with NO pre-existing log creates
 *      exactly one history row (this is the path the admin match-override now
 *      routes through).
 *
 * Run (store configured; flush between invocations):
 *   npx tsx backend/scripts/flush-test-store.ts && node_modules/.bin/tsx --test --test-force-exit backend/tests/donation-history-cooldown.test.ts
 */
import 'dotenv/config';
import './setup-env';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { saveDoc as dbSaveDoc, getDoc as dbGetDoc, getCollection as dbGetCollection, isFirebaseConfigured } from '../src/lib/serverDb';
import { recordDonationCompletion } from '../helpers/completionProvider';
import { resolveCooldownDays, computeCooldownUntil } from '../helpers/time';
import type { BloodRequest, DonationLog, Match, User } from '../src/types';

let seq = 0;
const tag = () => `dhc${process.pid}_${Date.now()}_${++seq}`;

before(async () => {});
after(async () => {});

async function seedDonor(cooldown_days?: 60 | 90 | 120): Promise<User> {
  const id = `donor_${tag()}`;
  const cd = cooldown_days as 60 | 90 | 120 | undefined;
  const doc: User = {
    id,
    full_name: 'Cooldown Donor',
    email: `${id}@example.local`,
    phone: '91999999999',
    whatsapp_number: '91999999999',
    blood_type: 'O+',
    donation_frequency: 'first_time',
    last_donation_date: null,
    cooldown_until: null,
    ...(cd !== undefined ? { cooldown_days: cd } : {}),
    pincode: '110001',
    area: 'Delhi',
    city: 'New Delhi',
    availability_status: 'available',
    number_sharing_pref: 'on_approval',
    emergency_only: false,
    account_status: 'active',
    whatsapp_verified: true,
    profile_complete: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await dbSaveDoc('users', id, doc as unknown as Record<string, unknown>);
  return doc;
}

async function seedMatchAndRequest(donorId: string): Promise<{ matchId: string; requestId: string }> {
  const requestId = `req_${tag()}`;
  const matchId = `match_${tag()}`;
  const req: BloodRequest = {
    id: requestId,
    tracking_code: `BLD-DHC-${requestId}`,
    patient_name: 'Patient',
    blood_type_needed: 'O+',
    units_required: 1,
    hospital_name: 'Hospital',
    hospital_pincode: '110001',
    hospital_area: 'Delhi',
    hospital_city: 'New Delhi',
    additional_notes: null,
    urgency_level: 'critical',
    requester_name: 'Requester',
    requester_phone: '91999988887',
    requester_email: 'req@example.com',
    status: 'secured',
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    fulfilled_at: null,
    created_at: new Date().toISOString(),
  };
  await dbSaveDoc('blood_requests', requestId, req as unknown as Record<string, unknown>);
  const match: Match = {
    id: matchId,
    request_id: requestId,
    donor_id: donorId,
    match_rank: 1,
    notification_channel: 'dashboard',
    notification_sent_at: null,
    reminder_sent_at: null,
    donor_response: 'approved',
    donor_response_at: new Date().toISOString(),
    contact_shared_at: new Date().toISOString(),
    outcome: null,
    outcome_confirmed_at: null,
    created_at: new Date().toISOString(),
  };
  await dbSaveDoc('matches', matchId, match as unknown as Record<string, unknown>);
  return { matchId, requestId };
}

describe('resolveCooldownDays', () => {
  test('honors 60/90/120 and defaults to 90 when absent or invalid', () => {
    assert.equal(resolveCooldownDays({ cooldown_days: 60 }), 60);
    assert.equal(resolveCooldownDays({ cooldown_days: 90 }), 90);
    assert.equal(resolveCooldownDays({ cooldown_days: 120 }), 120);
    assert.equal(resolveCooldownDays({}), 90, 'absent → default 90');
    assert.equal(resolveCooldownDays({ cooldown_days: 75 }), 90, 'invalid → default 90');
    assert.equal(resolveCooldownDays({ cooldown_days: 0 }), 90, 'invalid 0 → default 90');
  });
});

describe('computeCooldownUntil', () => {
  test('base + days arithmetic', () => {
    assert.equal(computeCooldownUntil('2026-08-31', 60), '2026-10-30');
    assert.equal(computeCooldownUntil('2026-08-31', 90), '2026-11-29');
    assert.equal(computeCooldownUntil('2026-08-31', 120), '2026-12-29');
  });
});

describe('Donation completion → history + donor cooldown', () => {
  test('records one idempotent donation_log row and applies selected cooldown', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const donor = await seedDonor(120);
    const { matchId, requestId } = await seedMatchAndRequest(donor.id);

    const first = await recordDonationCompletion({ matchId, requestId, donor, confirmedAt: new Date().toISOString() });
    assert.equal(first.already, false, 'first completion applies');

    const log = (await dbGetDoc<DonationLog>('donation_log', `donation_${matchId}`))!;
    const doneDonor = (await dbGetDoc<User>('users', donor.id)) as User;
    assert.equal(doneDonor.account_status, 'cooldown');
    assert.equal(doneDonor.cooldown_until, computeCooldownUntil(log.donation_date, 120), 'cooldown_until = donation date + 120');

    // Idempotency: second completion must not duplicate the log row.
    const second = await recordDonationCompletion({ matchId, requestId, donor, confirmedAt: new Date().toISOString() });
    assert.equal(second.already, true, 'repeat completion is a no-op');
    const logs = (await dbGetCollection<DonationLog>('donation_log')).filter((l) => l.request_id === requestId);
    assert.equal(logs.length, 1, 'exactly one donation_log row despite double-fire');
  });

  test('90-day default applies for donor without preference', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const donor = await seedDonor(); // no cooldown_days → default 90
    const { matchId, requestId } = await seedMatchAndRequest(donor.id);
    const first = await recordDonationCompletion({ matchId, requestId, donor, confirmedAt: new Date().toISOString() });
    assert.equal(first.already, false);
    const doneDonor = (await dbGetDoc<User>('users', donor.id)) as User;
    const log = (await dbGetDoc<DonationLog>('donation_log', `donation_${matchId}`))!;
    assert.equal(doneDonor.cooldown_until, computeCooldownUntil(log.donation_date, 90), 'default 90-day cooldown');
  });
});
