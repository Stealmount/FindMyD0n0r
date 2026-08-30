import 'dotenv/config';
import './setup-env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { nextLifecycle, recomputeUnitsConfirmed } from '../helpers/requestLifecycle';
import { saveDoc as dbSaveDoc, isFirebaseConfigured } from '../src/lib/serverDb';
import { nowISO } from '../helpers/time';

test('nextLifecycle: 0 approvals -> open with 0 confirmed', () => {
  const l = nextLifecycle(2, 0);
  assert.equal(l.units_confirmed, 0);
  assert.equal(l.status, 'open');
});

test('nextLifecycle: 1/3 approvals -> partially_matched with 1 confirmed', () => {
  const l = nextLifecycle(3, 1);
  assert.equal(l.units_confirmed, 1);
  assert.equal(l.status, 'partially_matched');
});

test('nextLifecycle: 3/3 approvals -> fulfilled exact', () => {
  const l = nextLifecycle(3, 3);
  assert.equal(l.units_confirmed, 3);
  assert.equal(l.status, 'fulfilled');
});

test('nextLifecycle: over-supply capped at units_required', () => {
  const l = nextLifecycle(3, 5);
  assert.equal(l.units_confirmed, 3, 'counts must not exceed units_required');
  assert.equal(l.status, 'fulfilled');
});

test('nextLifecycle: 1-unit request fulfilled on first approval', () => {
  const l = nextLifecycle(1, 1);
  assert.equal(l.units_confirmed, 1);
  assert.equal(l.status, 'fulfilled');
});

test('recomputeUnitsConfirmed: partial, exact, and over-supply from live matches', async (t) => {
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

  // 1 approval → partially_matched
  await seedApproved(randomUUID());
  const partial = await recomputeUnitsConfirmed(requestId, 3);
  assert.equal(partial.units_confirmed, 1);
  assert.equal(partial.status, 'partially_matched');
  assert.equal(partial.fulfilled_at, null);

  // 3 approvals → fulfilled exact, stamped fulfilled_at
  await seedApproved(randomUUID());
  await seedApproved(randomUUID());
  const exact = await recomputeUnitsConfirmed(requestId, 3);
  assert.equal(exact.units_confirmed, 3);
  assert.equal(exact.status, 'fulfilled');
  assert.ok(exact.fulfilled_at, 'fulfilled_at must be stamped on fulfilment');

  // 5 approvals → over-supply capped at units_required
  await seedApproved(randomUUID());
  await seedApproved(randomUUID());
  const capped = await recomputeUnitsConfirmed(requestId, 3);
  assert.equal(capped.units_confirmed, 3, 'over-supply must be capped at units_required');
  assert.equal(capped.status, 'fulfilled');
});