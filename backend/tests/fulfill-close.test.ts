/**
 * Phase 8 end-to-end verification — requester "Mark Fulfilled" close lifecycle.
 *
 * Proves, over the real HTTP surface (spawned server, shared fmdt: store):
 *   A. Profile-linked requester owners (auth UID maps to a different profile id
 *      via auth_profile_links; phone signups with null email) can close their
 *      own request — the earlier strict id/email check returned 403 and the
 *      frontend showed "Failed to fulfill request." Strictness is preserved for
 *      non-owners (still 403).
 *   B. After any successful close — full (fulfilled) or under-filled
 *      (cancelled) — the request disappears from the Donor Dashboard "Live
 *      Matching Requests" (GET /api/donor/matches) on the next refresh.
 *   C. The search physically stops: pending invitations are retired to
 *      timed_out, donor reservation locks are released, and re-running matching
 *      (matchAndNotifyRequest / POST next-donor) creates ZERO new matches and
 *      sends no new donor notifications for the closed request.
 *   D. Fulfilled is honest: satisfied (N=1, 1 approved) -> status fulfilled +
 *      fulfilled_at. Under-filled (N=2, 1 approved) -> status cancelled,
 *      units_confirmed=1, fulfilled_at=null (no fabricated fulfilled).
 *   E. Status cache reflects the terminal state (no stale "matching").
 *
 * Run (store configured; flush between suites):
 *   node_modules/.bin/tsx --test --test-force-exit backend/tests/fulfill-close.test.ts
 */
import 'dotenv/config';
import './setup-env';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import { saveDoc as dbSaveDoc, getDoc as dbGetDoc, getCollection as dbGetCollection, isFirebaseConfigured } from '../src/lib/serverDb';
import { saveDoc as storeSaveDoc } from '../src/lib/store';
import { cacheGet, cacheSetNX } from '../src/lib/redisCache';
import { matchAndNotifyRequest, createNextDonorMatch } from '../services/matchingEngine';
import { nowISO } from '../helpers/time';
import type { BloodRequest } from '../src/types';

const PORT = process.env.TEST_PORT || '5007';
const BASE = `http://127.0.0.1:${PORT}`;
const AUTH = { 'Authorization': 'Bearer test-valid-token', 'Content-Type': 'application/json' };

let seq = 0;
const tag = () => `fc${process.pid}_${Date.now()}_${++seq}`;

async function seedRequest(req: Partial<BloodRequest>): Promise<BloodRequest> {
  const base: BloodRequest = {
    id: `req_${tag()}`,
    tracking_code: `BLD-FC-${tag()}`,
    patient_name: 'Close Patient',
    blood_type_needed: 'O+',
    units_required: 1,
    hospital_name: 'Close Hospital',
    hospital_pincode: '110001',
    hospital_area: 'Delhi',
    hospital_city: 'New Delhi',
    urgency_level: 'urgent',
    requester_name: 'Close Requester',
    requester_phone: '',
    requester_email: '',
    additional_notes: '',
    status: 'broadcasting',
    units_confirmed: 0,
    expires_at: nowISO(),
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
  await dbSaveDoc('matches', id, {
    id,
    request_id: req.id,
    donor_id: donorId,
    donor_response: response,
    donor_response_at: response === 'approved' ? nowISO() : null,
    contact_shared_at: response === 'approved' ? nowISO() : null,
    unit_slot: slot ?? null,
    notification_channel: 'whatsapp',
    created_at: nowISO(),
  } as unknown as Record<string, unknown>);
  return id;
}

async function gateDonorLock(donorId: string, requestId: string) {
  await cacheSetNX(`donor_lock_${donorId}`, requestId, 300);
}

async function donorDashboardRequestIds(): Promise<Set<string>> {
  const res = await fetch(`${BASE}/api/donor/matches`, { headers: { 'Authorization': 'Bearer test-valid-token' } });
  assert.equal(res.status, 200, 'donor dashboard should be readable');
  const body = await res.json() as { requests: Array<{ id: string; tracking_code: string }> };
  return new Set((body.requests ?? []).map((r) => r.id));
}

async function fulfillViaHttp(trackingCode: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}/api/requests/${trackingCode}/fulfill`, {
    method: 'PATCH',
    headers: AUTH,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const reqMatches = async (requestId: string): Promise<any[]> =>
  (await dbGetCollection<any>('matches')).filter((m) => m.request_id === requestId);

describe('Requester "Mark Fulfilled" close lifecycle (/api/requests/:code/fulfill)', () => {
  let child: ChildProcess | null = null;

  before(async () => {
    if (!isFirebaseConfigured()) return;
    child = spawn(process.execPath, ['--import', 'tsx', 'backend/server.ts'], {
      stdio: 'pipe',
      env: { ...process.env, PORT, NODE_ENV: 'test' },
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

  test('A: profile-linked requester can fulfill; non-owner still 403', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const ownerProfile = `linked_s0_${tag()}`;
    // test-valid-token -> { id: 'test-user-id', email: 'test@example.com' }.
    // The request is owned by a *profile* id the auth UID is bound to.
    await storeSaveDoc('auth_profile_links', 'test-user-id', { profile_id: ownerProfile });
    await dbSaveDoc('profiles', ownerProfile, { id: ownerProfile, full_name: 'Linked Owner', phone: '9199999999' });

    const owned = await seedRequest({ requester_id: ownerProfile, requester_email: '' });
    const beforeFix = await fulfillViaHttp(owned.tracking_code);
    assert.equal(beforeFix.status, 200, 'profile-linked owner must be authorized (was 403 — the bug)');
    assert.equal(beforeFix.body.request.status, 'cancelled');

    // Strictness intact: an unrelated request (no link, no email match) is refused.
    const stranger = await seedRequest({ requester_id: `ghost_${tag()}`, requester_email: '' });
    const refused = await fulfillViaHttp(stranger.tracking_code);
    assert.equal(refused.status, 403, 'non-owner must still be forbidden');
  });

  test('B+C+E: N=1, zero approved -> clean cancelled, donor dashboard cleared, matching stopped, locks freed, cache terminal', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const req = await seedRequest({ requester_id: 'test-user-id', units_required: 1, status: 'broadcasting' });
    const l1 = `d1_${tag()}`, l2 = `d2_${tag()}`;
    await seedMatch(req, l1, 'pending');
    await seedMatch(req, l2, 'pending');
    await gateDonorLock(l1, req.id);

    // Pre-close: the request IS visible on the donor dashboard.
    const before = await donorDashboardRequestIds();
    assert.ok(before.has(req.id), 'live request must be visible pre-close');

    const closed = await fulfillViaHttp(req.tracking_code);
    assert.equal(closed.status, 200);
    assert.equal(closed.body.request.status, 'cancelled');
    assert.equal(closed.body.request.fulfilled_at, null);

    // Dashboard: request gone after one refresh (server-side terminal filter).
    const after = await donorDashboardRequestIds();
    assert.ok(!after.has(req.id), 'closed request must vanish from donor dashboard');

    // Pending invites retired; reservation locks freed.
    const matches = await reqMatches(req.id);
    assert.equal(matches.length, 2);
    assert.ok(matches.every((m) => m.donor_response === 'timed_out'), 'pendings retired to timed_out');
    assert.ok(!(await cacheGet(`donor_lock_${l1}`)), 'donor reservation lock must be freed');

    // Matching physically stops: direct + HTTP triggers create zero new matches.
    const beforeCount = matches.length;
    const re1 = await matchAndNotifyRequest(await dbGetDoc<BloodRequest>('blood_requests', req.id) as BloodRequest);
    assert.equal(re1.matched, 0, 'matchAndNotifyRequest must no-op on a closed request');
    const nextDonor = await fetch(`${BASE}/api/requests/${req.id}/next-donor`, { method: 'POST', headers: AUTH });
    assert.equal((await nextDonor.json()).success, false, 'next-donor must refuse a closed request');
    assert.equal((await reqMatches(req.id)).length, beforeCount, 'no new match rows for a closed request');

    // Status cache reflects the terminal state (never stale "matching").
    const statusRes = await fetch(`${BASE}/api/requests/${req.id}/status`, { headers: AUTH });
    const statusBody = await statusRes.json() as { status: string };
    assert.equal(statusBody.status, 'cancelled');
  });

  test('D: N=1 with 1 approved -> truthful fulfilled + fulfilled_at; pendings retired', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const req = await seedRequest({ requester_id: 'test-user-id', units_required: 1, status: 'partially_matched', units_confirmed: 1 });
    const approvedId = `da_${tag()}`;
    await seedMatch(req, approvedId, 'approved', 1);
    await seedMatch(req, `dp_${tag()}`, 'pending');

    const closed = await fulfillViaHttp(req.tracking_code);
    assert.equal(closed.status, 200);
    assert.equal(closed.body.request.status, 'fulfilled', 'allocated request is truly fulfilled');
    assert.equal(closed.body.request.units_confirmed, 1);
    assert.ok(closed.body.request.fulfilled_at, 'fulfilled_at stamped at real capacity');

    const after = await donorDashboardRequestIds();
    assert.ok(!after.has(req.id), 'fulfilled request must vanish from donor dashboard');

    const byId = new Map((await reqMatches(req.id)).map((m: any) => [m.id, m]));
    const approved = [...byId.values()].find((m) => m.donor_id === approvedId);
    assert.equal(approved?.donor_response, 'approved', 'approved contribution kept as history');
    const pending = [...byId.values()].find((m) => m.donor_response === 'pending');
    assert.ok(!pending, 'leftover pendings retired after fulfilled close');

    const statusBody = await (await fetch(`${BASE}/api/requests/${req.id}/status`, { headers: AUTH })).json() as { status: string };
    assert.equal(statusBody.status, 'fulfilled');
  });

  test('D: N=2 with 1 approved -> cancelled (not fulfilled), truthful counter, dashboard cleared, no new matches', async (t) => {
    if (!isFirebaseConfigured()) return t.skip('Store not configured');
    const req = await seedRequest({ requester_id: 'test-user-id', units_required: 2, status: 'partially_matched', units_confirmed: 1 });
    await seedMatch(req, `da_${tag()}`, 'approved', 1);
    await seedMatch(req, `dp_${tag()}`, 'pending');

    const closed = await fulfillViaHttp(req.tracking_code);
    assert.equal(closed.status, 200);
    assert.equal(closed.body.request.status, 'cancelled', 'under-filled close must never be labelled fulfilled');
    assert.equal(closed.body.request.units_confirmed, 1, 'counter stays truthful');
    assert.equal(closed.body.request.fulfilled_at, null);

    const after = await donorDashboardRequestIds();
    assert.ok(!after.has(req.id), 'under-filled closed request must vanish from donor dashboard');

    const persisted = await dbGetDoc<BloodRequest>('blood_requests', req.id);
    const reRun = await matchAndNotifyRequest(persisted as BloodRequest);
    assert.equal(reRun.matched, 0);
    const next = await createNextDonorMatch(persisted as BloodRequest);
    assert.equal(next, null, 'cascade match for a closed request must be refused');

    // Requester dashboard reflects the terminal state (revalidation source).
    const dash = await (await fetch(`${BASE}/api/requester/requests`, { headers: AUTH })).json() as { requests: Array<{ id: string; status: string; units_confirmed: number }> };
    const mine = (dash.requests ?? []).find((r: any) => r.id === req.id);
    assert.equal(mine?.status, 'cancelled');
    assert.equal(mine?.units_confirmed, 1);
  });
});