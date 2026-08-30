/**
 * Recovery + queued-delivery hardening regression suite.
 *
 * Two mechanisms are proven here:
 *
 *  ISSUE 1 — EVENTUAL POST-CLAIM RECONCILIATION
 *    The atomic Lua capacity claim makes the allocation authoritative while the
 *    request's units_confirmed/status/fulfilled_at are a derived projection. If
 *    the projection persist fails or the process crashes after the claim — and
 *    the original donor never retries — the maintenance path
 *    (helpers/sweepReconcile.reconcileActiveRequestLifecycles, invoked by the
 *    background sweep every cycle) must reconverge the projection. Recovery
 *    must NOT depend on the donor retry. Proven by running the actual
 *    maintenance entry and checking convergence, idempotency, and no
 *    capacity/ledger side effects.
 *
 *  ISSUE 2 — QUEUED DELIVERY-TIME GUARD
 *    A match-actionable donor message (donor_match / match_sos_retry) is queued
 *    while the request is active, but the request closes before the worker
 *    delivers. processMessage() must re-read the live request + match and
 *    suppress (no provider call, no retry, structured reason) instead of sending
 *    a stale invite. Active requests must still deliver normally.
 *
 * Run (store configured; flush between suites):
 *   node_modules/.bin/tsx --test --test-force-exit backend/tests/recovery-queue-guard.test.ts
 */
import 'dotenv/config';
import './setup-env';
process.env.WAHA_BASE_URL = ''; // offline-safe WhatsApp adapter

import test from 'node:test';
import assert from 'node:assert/strict';

import { reconcileActiveRequestLifecycles } from '../helpers/sweepReconcile';
import { reconcileRequestLifecycle } from '../helpers/requestLifecycle';
import { claimUnitSlot, computeApprovedSlots } from '../helpers/capacityClaim';
import { enqueueMessage, claimDueMessages, processMessage, type OutgoingMessage, clearMessageQueueForTest } from '../src/lib/messaging';
import { getDoc as dbGetDoc, getCollection as dbGetCollection, saveDoc as dbSaveDoc, isFirebaseConfigured } from '../src/lib/serverDb';
import { getUpstash, k } from '../src/lib/upstash';
import type { BloodRequest, Match } from '../src/types';

let seq = 0;
const tag = () => `rqg${process.pid}_${Date.now()}_${++seq}`;
const nowISO = () => new Date().toISOString();
const HOSPITAL_PINCODE = '110001';

function testRequest(units_required: number, status: string, units_confirmed: number): BloodRequest {
  return {
    id: `req_${tag()}`,
    tracking_code: `BLD-RQG-${tag()}`,
    patient_name: 'Recovery Patient',
    blood_type_needed: 'O+',
    units_required,
    hospital_name: 'Recovery Hospital',
    hospital_pincode: HOSPITAL_PINCODE,
    hospital_area: 'Delhi',
    hospital_city: 'New Delhi',
    urgency_level: 'urgent',
    requester_name: 'Recovery Requester',
    requester_phone: '91999900001',
    requester_email: 'recovery-requester@example.com',
    additional_notes: '',
    status: status as BloodRequest['status'],
    units_confirmed,
    search_batch: 0,
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    fulfilled_at: null,
    created_at: nowISO(),
  };
}

async function seedUser(id: string) {
  const phone = `91999${String(Math.abs(id.length * 7) % 100000000).padStart(8, '0')}`;
  await dbSaveDoc('users', id, {
    id,
    phone,
    whatsapp_number: phone,
    full_name: `Donor ${id}`,
    email: `${id}@example.local`,
    blood_type: 'O+',
    pincode: HOSPITAL_PINCODE,
    availability_status: 'available',
    account_status: 'active',
    created_at: nowISO(),
    updated_at: nowISO(),
  } as unknown as Record<string, unknown>);
}

async function seedMatch(id: string, request_id: string, donor_id: string, donor_response: string, unit_slot: number | null, public_token?: string) {
  await dbSaveDoc('matches', id, {
    id,
    request_id,
    donor_id,
    donor_response,
    unit_slot,
    distance_km: 1,
    public_token: public_token ?? `tok_${id}`,
    created_at: nowISO(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  } as unknown as Record<string, unknown>);
}

async function reqMatches(requestId: string): Promise<Match[]> {
  const all = (await dbGetCollection<any>('matches')) as Match[];
  return all.filter((m) => m.request_id === requestId);
}

async function ledgerSlots(requestId: string): Promise<number[]> {
  const raw = (await getUpstash().smembers(k(`capslot:${requestId}`))) as string[];
  return raw.map(Number).sort((a, b) => a - b);
}

function cleanup(ids: { requestId?: string; matchIds?: string[]; donorIds?: string[] }) {
  const all = [...ids.matchIds ?? [], ...ids.donorIds ?? [], ...(ids.requestId ? [ids.requestId] : [])];
  return Promise.all(all.map((id) => getUpstash().del(k(id)).catch(() => {}))).then(() => {});
}

test('ISSUE 1: eventual reconciliation converges stale post-claim projection without donor retry', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured');
  const req = testRequest(2, 'partially_matched', 1);
  await dbSaveDoc('blood_requests', req.id, req as unknown as Record<string, unknown>);
  const dA = `dA_${tag()}`, dB = `dB_${tag()}`;
  await seedUser(dA);
  await seedUser(dB);
  const mA = `mA_${tag()}`, mB = `mB_${tag()}`;
  await seedMatch(mA, req.id, dA, 'approved', 1);
  await seedMatch(mB, req.id, dB, 'approved', 2);

  try {
    // Projection is stale: 1/2 partially_matched, but the authoritative store
    // already has TWO approved matches (slots 1 & 2).
    const before = await dbGetDoc<{ status?: string; units_confirmed?: number }>('blood_requests', req.id);
    assert.equal(before?.status, 'partially_matched');
    assert.equal(before?.units_confirmed, 1);

    // Maintenance/recovery path runs (no donor retry involved).
    const rec1 = await reconcileActiveRequestLifecycles();
    assert.equal(rec1.reconciled, 1, 'one projection reconciled');

    const after = await dbGetDoc<{ status?: string; units_confirmed?: number; fulfilled_at?: string | null }>('blood_requests', req.id);
    assert.equal(after?.units_confirmed, 2, 'units_confirmed converged to authoritative approved count');
    assert.equal(after?.status, 'fulfilled', 'fulfilled transition occurs when approved count reaches units_required');
    assert.ok(after?.fulfilled_at, 'fulfilled_at correct');

    // No duplicate slot / no new capacity claim: matches and ledger untouched by reconcile.
    const approved = (await reqMatches(req.id)).filter((m) => m.donor_response === 'approved');
    assert.equal(approved.length, 2, 'exactly two approved contributions, no new row');
    assert.deepEqual([...approved].map((m) => m.unit_slot).sort((a: any, b: any) => a - b), [1, 2], 'unique slots');
    assert.deepEqual(await ledgerSlots(req.id), [], 'reconciliation never writes to the capslot ledger');

    // Repeated recovery runs are no-ops.
    const rec2 = await reconcileActiveRequestLifecycles();
    assert.equal(rec2.reconciled, 0, 'second run idempotent — nothing to change');
    // reconcileRequestLifecycle is also idempotent
    const rec3 = await reconcileRequestLifecycle(req.id, 2);
    assert.equal(rec3.changed, false, 'canonical reconciliation reports no change on second pass');
  } finally {
    await cleanup({ matchIds: [mA, mB], donorIds: [dA, dB] });
  }
});

test('ISSUE 1b: multi-unit reconciliation drives transitions only at enough approvals and never overcounts', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured');
  const req = testRequest(3, 'partially_matched', 1);
  await dbSaveDoc('blood_requests', req.id, req as unknown as Record<string, unknown>);
  const donors = [`d1_${tag()}`, `d2_${tag()}`, `d3_${tag()}`];
  for (const d of donors) await seedUser(d);
  const m1 = `m1_${tag()}`, m2 = `m2_${tag()}`, m3 = `m3_${tag()}`;
  await seedMatch(m1, req.id, donors[0], 'approved', 1);
  await seedMatch(m2, req.id, donors[1], 'approved', 2);
  await seedMatch(m3, req.id, donors[2], 'pending', null);

  try {
    // Two approved of three needed, projection stale at 1/3.
    const rec = await reconcileRequestLifecycle(req.id, 3);
    assert.equal(rec.status, 'partially_matched', 'still partial at 2 of 3');
    assert.equal(rec.units_confirmed, 2, 'never overcounts, never undercounts — equals approved count');
    let live = await dbGetDoc<{ status?: string; units_confirmed?: number; fulfilled_at?: string | null }>('blood_requests', req.id);
    assert.equal(live?.units_confirmed, 2);

    // Third donor's claim lands: match becomes approved + ledger slot 3, BUT the
    // request projection is left stale (simulated post-claim crash). No donor retry.
    const thirdClaim = await claimUnitSlot({
      matchId: m3,
      requestId: req.id,
      unitsRequired: 3,
      approvedSlots: computeApprovedSlots(await reqMatches(req.id) as any, req.id),
      timestamp: nowISO(),
    });
    assert.equal(thirdClaim.status, 'ok');
    // Projection is still 2/3 (the post-claim persist was skipped).
    live = await dbGetDoc<{ status?: string; units_confirmed?: number }>('blood_requests', req.id);
    assert.equal(live?.units_confirmed, 2);

    // Maintenance/recovery runs → converges to fulfilled at exactly 3.
    const recMain = await reconcileActiveRequestLifecycles();
    assert.equal(recMain.reconciled, 1);
    live = await dbGetDoc<{ status?: string; units_confirmed?: number; fulfilled_at?: string | null }>('blood_requests', req.id);
    assert.equal(live?.units_confirmed, 3, 'converged to authoritative 3');
    assert.equal(live?.status, 'fulfilled', 'transition only when enough units approved');
    assert.ok(live?.fulfilled_at);

    const approved = (await reqMatches(req.id)).filter((m) => m.donor_response === 'approved');
    assert.deepEqual([...approved].map((m) => m.unit_slot).sort((a: any, b: any) => a - b), [1, 2, 3], 'unique slots across all units');
    // Ledger is hydrated from observed approved slots (docs: SADD idempotent
    // self-healing) — [1,2] were hydrated before the claim won slot 3.
    assert.deepEqual(await ledgerSlots(req.id), [1, 2, 3], 'ledger mirrors all approved slots');
  } finally {
    await cleanup({ matchIds: [m1, m2, m3], donorIds: donors });
  }
});

async function setupActiveMatch(): Promise<{ requestId: string; matchId: string; donorId: string }> {
  const req = testRequest(1, 'open', 0);
  await dbSaveDoc('blood_requests', req.id, req as unknown as Record<string, unknown>);
  const donorId = `don_${tag()}`;
  await seedUser(donorId);
  const matchId = `m_${tag()}`;
  await seedMatch(matchId, req.id, donorId, 'pending', null);
  return { requestId: req.id, matchId, donorId };
}

test('ISSUE 2: queued donor_match becomes stale before delivery → suppressed, no retry, no provider send', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured');
  await clearMessageQueueForTest();
  const { requestId, matchId, donorId } = await setupActiveMatch();

  try {
    // Enqueue a match-actionable donor message as if the request were active.
    const msg = await enqueueMessage({
      channel: 'whatsapp',
      recipient: '91999911111',
      type: 'donor_match',
      payload: { text: 'You have a match!', request_id: requestId, match_id: matchId },
      delaySeconds: 0,
    });

    // Request becomes terminal before the worker delivers.
    await dbSaveDoc('blood_requests', requestId, { id: requestId, status: 'cancelled' } as unknown as Record<string, unknown>);

    const claimed = (await claimDueMessages(25)).find((m: any) => m.id === msg.id)!;
    const result: OutgoingMessage = await processMessage(claimed);

    assert.equal(result.status, 'suppressed', 'message suppressed (terminal), never sent, never retried');
    assert.ok(result.suppressed_reason && result.suppressed_reason.includes('terminal'),
      `structured suppression reason recorded: ${result.suppressed_reason}`);
    assert.equal(result.retry_count, 0, 'no retry scheduled');
    assert.equal(result.channel !== undefined, true);

    // Standing idle: no provider failure was recorded (last_error null).
    assert.equal(result.last_error, null, 'not a retryable provider failure');
  } finally {
    await clearMessageQueueForTest();
    await cleanup({ matchIds: [matchId], donorIds: [donorId], requestId });
  }
});

test('ISSUE 2b: unverifiable match identifiers are safely suppressed (never send unverified invite)', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured');
  await clearMessageQueueForTest();
  try {
    const msg = await enqueueMessage({
      channel: 'whatsapp',
      recipient: '91999922222',
      type: 'match_sos_retry',
      payload: { text: 'retry' }, // no request_id / match_id
      delaySeconds: 0,
    });
    const claimed = (await claimDueMessages(25)).find((m: any) => m.id === msg.id)!;
    const result = await processMessage(claimed);
    assert.equal(result.status, 'suppressed', 'unverifiable donor invite suppressed');
    assert.equal(result.suppressed_reason, 'unresolvable_match_identifiers');
    assert.equal(result.retry_count, 0);
  } finally {
    await clearMessageQueueForTest();
  }
});

test('ISSUE 2c: active valid request still delivers (guard does not break normal flow)', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured');
  await clearMessageQueueForTest();
  const { requestId, matchId, donorId } = await setupActiveMatch();

  try {
    // Active request + pending match → the guard must NOT suppress. It proceeds
    // to the provider path. WAHA is unconfigured → sendWhatsApp returns false →
    // the row is retried (queued), which proves the provider path ran (never
    // short-circuited to suppression).
    const msg = await enqueueMessage({
      channel: 'whatsapp',
      recipient: '91999933333',
      type: 'donor_match',
      payload: { text: 'Live invite', request_id: requestId, match_id: matchId },
      delaySeconds: 0,
    });
    const claimed = (await claimDueMessages(25)).find((m: any) => m.id === msg.id)!;
    const result = await processMessage(claimed);
    assert.notEqual(result.status, 'suppressed', 'active message is not suppressed');
    assert.equal(result.suppressed_reason, undefined, 'no suppression reason on an active message');
    // Normal behavior for an unconfigured adapter: provider path attempted → retried.
    assert.equal(result.status, 'queued', 'normal retry path, delivery attempted normally');
  } finally {
    await clearMessageQueueForTest();
    await cleanup({ matchIds: [matchId], donorIds: [donorId], requestId });
  }
});

test('ISSUE 2d: already-sent stale notification safety — approval/claim protections intact', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured');
  const req = testRequest(1, 'fulfilled', 1);
  await dbSaveDoc('blood_requests', req.id, req as unknown as Record<string, unknown>);
  const dA = `dA2_${tag()}`;
  await seedUser(dA);
  const matchA = `mA2_${tag()}`;
  await seedMatch(matchA, req.id, dA, 'approved', 1);

  try {
    // A late reply on an already-sent, already-closed request must never claim
    // new capacity: replay the reply against the REAL match row (which still
    // exists in the store) — the atomic claim refuses because the request is
    // terminal. The row was already approved+slotted (units_confirmed=1,
    // fulfilled), so no NEW capacity may be created by the stale duplicate.
    const claim = await claimUnitSlot({
      matchId: matchA,
      requestId: req.id,
      unitsRequired: 1,
      approvedSlots: computeApprovedSlots(await reqMatches(req.id) as any, req.id),
      timestamp: nowISO(),
    });
    assert.ok(claim.status === 'full' || claim.status === 'terminal' || claim.status === 'already_resolved',
      `atomic claim refuses stale approval (got ${claim.status})`);
    // No NEW capacity: the pre-existing approved slot 1 is hydrated into the
    // ledger (idempotent mirror), but the stale duplicate created nothing new.
    assert.deepEqual(await ledgerSlots(req.id), [1], 'no newly created capacity from a stale approval');
  } finally {
    await cleanup({ matchIds: [matchA], donorIds: [dA], requestId: req.id });
  }
});
