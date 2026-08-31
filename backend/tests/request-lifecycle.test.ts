import 'dotenv/config';
import './setup-env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { nextLifecycle, recomputeUnitsConfirmed } from '../helpers/requestLifecycle';
import { saveDoc as dbSaveDoc, isFirebaseConfigured } from '../src/lib/serverDb';
import { resetSearchBudget } from '../services/matchingEngine';
import { nowISO } from '../helpers/time';

test('nextLifecycle: 0 approvals, 0 completed, budget 5 -> open', () => {
  const l = nextLifecycle(2, 0, 0, 5);
  assert.equal(l.units_confirmed, 0);
  assert.equal(l.units_completed, 0);
  assert.equal(l.status, 'open');
});

test('nextLifecycle: 1/3 approvals, budget < 15 -> partially_matched', () => {
  const l = nextLifecycle(3, 1, 0, 5);
  assert.equal(l.units_confirmed, 1);
  assert.equal(l.status, 'partially_matched');
});

test('nextLifecycle: 3/3 approvals -> secured (NOT fulfilled until donation)', () => {
  const l = nextLifecycle(3, 3, 0, 5);
  assert.equal(l.units_confirmed, 3);
  assert.equal(l.status, 'secured');
});

test('nextLifecycle: completed >= required -> fulfilled', () => {
  const l = nextLifecycle(3, 3, 2, 5);
  assert.equal(l.status, 'secured');
  const done = nextLifecycle(3, 3, 3, 5);
  assert.equal(done.status, 'fulfilled');
  assert.equal(done.units_completed, 3);
});

test('nextLifecycle: budget exhausted (15) with sub-required secured -> search_exhausted', () => {
  const l = nextLifecycle(3, 1, 0, 15);
  assert.equal(l.status, 'search_exhausted');
});

test('nextLifecycle: secured 0, budget 15 -> search_exhausted (all donors spent)', () => {
  const l = nextLifecycle(3, 0, 0, 15);
  assert.equal(l.status, 'search_exhausted');
});

test('nextLifecycle: over-supply capped at units_required', () => {
  const l = nextLifecycle(3, 5, 0, 5);
  assert.equal(l.units_confirmed, 3, 'counts must not exceed units_required');
  assert.equal(l.status, 'secured');
});

test('nextLifecycle: 1-unit request with 1 approval and 1 completed -> fulfilled', () => {
  const l = nextLifecycle(1, 1, 1, 5);
  assert.equal(l.units_confirmed, 1);
  assert.equal(l.units_completed, 1);
  assert.equal(l.status, 'fulfilled');
});

test('recomputeUnitsConfirmed: secured, completed, exhaustion from live matches', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured — integration test requires Upstash');

  const requestId = `rl-int-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const donorId = (id: string) => `rl-donor-${id}`;
  await dbSaveDoc('blood_requests', requestId, {
    id: requestId, tracking_code: `BLD-RL-${nowISO().slice(0, 10)}-${Date.now()}`,
    units_required: 3, status: 'open', created_at: nowISO(), updated_at: nowISO(),
  } as unknown as Record<string, unknown>);

  const seedApproved = async (matchId: string) => {
    await dbSaveDoc('matches', matchId, {
      id: matchId, request_id: requestId, donor_id: donorId(matchId),
      donor_response: 'approved', donor_response_at: nowISO(), created_at: nowISO(),
    } as unknown as Record<string, unknown>);
  };

  await resetSearchBudget(requestId);

  // 1 approval, budget 5 → partially_matched
  await seedApproved(randomUUID());
  const partial = await recomputeUnitsConfirmed(requestId, 3);
  assert.equal(partial.units_confirmed, 1);
  assert.equal(partial.status, 'partially_matched');
  assert.equal(partial.fulfilled_at, null);

  // 3 approvals → secured (fully allocated, awaiting donation), no fulfilled_at
  await seedApproved(randomUUID());
  await seedApproved(randomUUID());
  const secured = await recomputeUnitsConfirmed(requestId, 3);
  assert.equal(secured.units_confirmed, 3);
  assert.equal(secured.status, 'secured');
  assert.equal(secured.fulfilled_at, null, 'secured is NOT terminal');

  // Completed 3 via donation_log (request-keyed) → fulfilled
  await dbSaveDoc('donation_log', `donation_${randomUUID()}`, {
    id: `donation_${randomUUID()}`,
    donor_id: donorId('c1'), match_id: 'm1', request_id: requestId,
    donation_date: nowISO().split('T')[0], source: 'platform_match',
    created_at: nowISO(),
  } as unknown as Record<string, unknown>);
  await dbSaveDoc('donation_log', `donation_${randomUUID()}`, {
    id: `donation_${randomUUID()}`,
    donor_id: donorId('c2'), match_id: 'm2', request_id: requestId,
    donation_date: nowISO().split('T')[0], source: 'platform_match',
    created_at: nowISO(),
  } as unknown as Record<string, unknown>);
  await dbSaveDoc('donation_log', `donation_${randomUUID()}`, {
    id: `donation_${randomUUID()}`,
    donor_id: donorId('c3'), match_id: 'm3', request_id: requestId,
    donation_date: nowISO().split('T')[0], source: 'platform_match',
    created_at: nowISO(),
  } as unknown as Record<string, unknown>);

  const fulfilled = await recomputeUnitsConfirmed(requestId, 3);
  assert.equal(fulfilled.units_completed, 3);
  assert.equal(fulfilled.status, 'fulfilled');
  assert.ok(fulfilled.fulfilled_at, 'fulfilled_at stamped on fulfilment');
});