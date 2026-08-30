/**
 * Targeted correctness review — fulfill invariant + reopen/ledger lifecycle.
 *
 * Covers:
 *  - fulfillRequest MUST only ever label a request 'fulfilled' when the
 *    authoritative approved count >= units_required (exact / over-filled).
 *  - An under-filled manual fulfill closes the request through the established
 *    cancel domain flow (approved rows retained, pending invites retired,
 *    locks freed) and NEVER stamps the truthful allocation with a life.
 *  - reopenRequest preserves approved allocations (with their unit_slots) and
 *    resets search_batch to 0 so a fresh donor wave targets only the still-open
 *    units; capacity claims after reopen land in the lowest-free slot ABOVE the
 *    retained slots (capslot ledger coherence — retained approved rows are
 *    re-hydrated, so no stale/duplicate slot can ever be granted).
 *
 * Run (store configured; flush between suites):
 *   node_modules/.bin/tsx --test --test-force-exit backend/tests/fulfill-reopen.test.ts
 */
import 'dotenv/config';
import './setup-env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  saveDoc as dbSaveDoc,
  getDoc as dbGetDoc,
  getCollection as dbGetCollection,
  isFirebaseConfigured,
} from '../src/lib/serverDb';
import { releaseDonorLock } from '../services/matchingEngine';
import { approveMatchById } from '../routes/matching';
import { cancelRequest, reopenRequest, fulfillRequest } from '../routes/tracking';
import { nowISO } from '../helpers/time';
import type { BloodRequest } from '../src/types';

let seq = 0;
const tag = () => `fr${process.pid}_${Date.now()}_${++seq}`;

function testRequest(unitsRequired: number): BloodRequest {
  return {
    id: `req_${tag()}`,
    tracking_code: `BLD-FR-${tag()}`,
    patient_name: 'Review Patient',
    blood_type_needed: 'O+',
    units_required: unitsRequired,
    hospital_name: 'Review Hospital',
    hospital_pincode: '110001',
    hospital_area: 'Delhi',
    hospital_city: 'New Delhi',
    urgency_level: 'urgent',
    requester_name: 'Review Requester',
    requester_phone: '', // empty => no requester WhatsApp attempt
    requester_email: '', // empty => no requester email attempt
    additional_notes: '',
    status: 'partially_matched',
    units_confirmed: 0,
    expires_at: nowISO(),
    fulfilled_at: null,
    search_batch: 1,
    created_at: nowISO(),
  };
}

async function seedUser(id: string) {
  await dbSaveDoc('users', id, {
    id,
    phone: `9199${String(Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 100000000).padStart(8, '0')}`,
    full_name: `Review Donor ${id}`,
    blood_type: 'O+',
    pincode: '110001',
    availability_status: 'available',
    account_status: 'active',
    created_at: nowISO(),
    updated_at: nowISO(),
  } as unknown as Record<string, unknown>);
}

async function seedMatch(id: string, requestId: string, donorId: string, response: 'approved' | 'pending', slot?: number) {
  await dbSaveDoc('matches', id, {
    id,
    request_id: requestId,
    donor_id: donorId,
    donor_response: response,
    donor_response_at: response === 'approved' ? nowISO() : null,
    contact_shared_at: response === 'approved' ? nowISO() : null,
    unit_slot: slot ?? null,
    notification_channel: 'whatsapp',
    created_at: nowISO(),
  } as unknown as Record<string, unknown>);
}

const requestMatches = async (requestId: string) =>
  (await dbGetCollection<any>('matches')).filter((m) => m.request_id === requestId);

test('fulfillRequest: exact-full request is signed off as fulfilled with truthful counters', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured');
  const request = testRequest(2);
  await dbSaveDoc('blood_requests', request.id, { ...request, units_confirmed: 2, status: 'partially_matched' } as unknown as Record<string, unknown>);
  for (const [d, slot] of [['d1', 1], ['d2', 2]] as const) {
    const donorId = `${d}_${tag()}`;
    await seedUser(donorId);
    await seedMatch(`m_${donorId}`, request.id, donorId, 'approved', slot);
  }

  const updated = await fulfillRequest(await dbGetDoc<BloodRequest>('blood_requests', request.id) as BloodRequest);

  assert.equal(updated.status, 'fulfilled');
  assert.equal(updated.units_confirmed, 2);
  assert.ok(updated.fulfilled_at, 'fulfilled_at must be stamped on honest fulfilment');
  const persisted = await dbGetDoc<BloodRequest>('blood_requests', request.id);
  assert.equal(persisted?.status, 'fulfilled');
  assert.equal(persisted?.units_confirmed, 2);
  assert.ok(persisted?.fulfilled_at);
});

test('fulfillRequest: under-filled manual close uses the cancel domain flow — never a fake fulfilled', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured');
  const request = testRequest(3);
  await dbSaveDoc('blood_requests', request.id, { ...request, units_confirmed: 1, status: 'partially_matched' } as unknown as Record<string, unknown>);
  const donorA = `dA_${tag()}`, donorP = `dP_${tag()}`;
  await seedUser(donorA);
  await seedUser(donorP);
  await seedMatch(`mA_${donorA}`, request.id, donorA, 'approved', 1);
  await seedMatch(`mP_${donorP}`, request.id, donorP, 'pending');

  const updated = await fulfillRequest(await dbGetDoc<BloodRequest>('blood_requests', request.id) as BloodRequest);

  assert.equal(updated.status, 'cancelled', 'under-filled close must route to the cancel state');
  assert.equal(updated.units_confirmed, 1, 'counter must stay truthful');
  assert.equal(updated.fulfilled_at, null);

  const byId = new Map((await dbGetCollection<any>('matches')).filter((m: any) => m.request_id === request.id).map((m: any) => [m.id, m]));
  assert.equal(byId.get(`mA_${donorA}`)?.donor_response, 'approved', 'approved allocation is history — never rewritten');
  assert.equal(byId.get(`mA_${donorA}`)?.unit_slot, 1, 'approved slot must be retained');
  assert.equal(byId.get(`mP_${donorP}`)?.donor_response, 'timed_out', 'dangling invite must be retired');
  await releaseDonorLock(donorP, request.id); // idempotent — must not throw
});

test('fulfillRequest: zero-approved manual close is a clean cancelled, not fulfilled', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured');
  const request = testRequest(2);
  await dbSaveDoc('blood_requests', request.id, { ...request, units_confirmed: 0, status: 'open' } as unknown as Record<string, unknown>);

  const updated = await fulfillRequest(await dbGetDoc<BloodRequest>('blood_requests', request.id) as BloodRequest);

  assert.equal(updated.status, 'cancelled');
  assert.equal(updated.units_confirmed, 0);
  assert.equal(updated.fulfilled_at, null);
});

test('reopenRequest: approved allocation retained (ledger coherent), fresh round, post-reopen claim lands on a new slot', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured');
  const request = testRequest(3);
  await dbSaveDoc('blood_requests', request.id, { ...request, units_confirmed: 2, status: 'partially_matched' } as unknown as Record<string, unknown>);

  const donor1 = `d1_${tag()}`, donor2 = `d2_${tag()}`;
  await seedUser(donor1);
  await seedUser(donor2);
  await seedMatch(`m1_${donor1}`, request.id, donor1, 'approved', 1);
  await seedMatch(`m2_${donor2}`, request.id, donor2, 'approved', 2);

  // Cancel an under-filled request (requester stops early).
  const cancelled = await cancelRequest(await dbGetDoc<BloodRequest>('blood_requests', request.id) as BloodRequest);
  assert.equal(cancelled.status, 'cancelled');

  // Reopen: approved contributions and their slots survive; search restarts fresh.
  const reopened = await reopenRequest(await dbGetDoc<BloodRequest>('blood_requests', request.id) as BloodRequest);
  assert.equal(reopened.status, 'open');
  assert.equal(reopened.units_confirmed, 2, 'live approved rows must be counted on reopen');
  assert.equal(reopened.search_batch, 0, 'search round must reset for a fresh donor wave');
  assert.equal(reopened.fulfilled_at, null);

  const retained = await requestMatches(request.id);
  assert.deepEqual(
    retained.filter((m: any) => m.donor_response === 'approved').map((m: any) => m.unit_slot).sort(),
    [1, 2],
    'approved unit_slots must be preserved through cancel/reopen'
  );

  // Fresh wave invites a NEW donor for the one still-open unit; the claim must
  // observe the retained slots and land on the lowest free slot (3).
  const donor3 = `d3_${tag()}`;
  await seedUser(donor3);
  await seedMatch(`m3_${donor3}`, request.id, donor3, 'pending');

  const approval = await approveMatchById(`m3_${donor3}`);
  assert.equal(approval.ok, true, 'post-reopen approval must succeed for the still-open unit');

  const byId = new Map((await requestMatches(request.id)).map((m: any) => [m.id, m]));
  assert.equal(byId.get(`m3_${donor3}`)?.unit_slot, 3, 'claim must reserve the lowest-free slot above retained slots');
  assert.equal(byId.get(`m3_${donor3}`)?.donor_response, 'approved');

  const persisted = await dbGetDoc<BloodRequest>('blood_requests', request.id);
  assert.equal(persisted?.units_confirmed, 3);
  assert.equal(persisted?.status, 'fulfilled', '3/3 reached — request truly fulfilled');
  assert.ok(persisted?.fulfilled_at, 'fulfilled_at stamped only now, at real capacity');
});