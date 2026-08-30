/**
 * Donor Dashboard — Privacy-Safe Projection Test Matrix (plan.md §14.1)
 *
 * Verifies that GET /api/donor/matches returns a sanitized per-donor payload:
 *  - Each match carries the donor's OWN capability token as `matchToken`
 *    (from match.public_token), never another donor's raw match id.
 *  - Requester PII (requester_name/phone/email) + patient-sensitive detail
 *    (patient_name, additional_notes) are revealed ONLY when THIS donor's own
 *    match for that request is approved (donor_response === 'approved' AND
 *    contact_shared_at set) AND the request is still live. Closure wins:
 *    Phase 8 drops terminal requests (cancelled/fulfilled/expired) from the
 *    live projection entirely — no invite card, no PII, not even redacted.
 *    share_contact_immediately is NOT a donor gate.
 *
 * Fixtures are seeded directly into the store (same store the server reads),
 * and the actor authenticates via the test backdoor token (test-valid-token
 * -> authUser.id 'test-user-id'), so the suite is deterministic and needs no
 * external OTP / messaging providers.
 *
 * Run:
 *   npx tsx --test backend/tests/donor-privacy.test.ts
 */
import 'dotenv/config';
import './setup-env';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import { saveDoc as dbSaveDoc } from '../src/lib/serverDb';

const PORT = process.env.TEST_PORT || '5011';
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = 'Bearer test-valid-token';

const DONOR_ID = 'test-user-id';
const REQ_A_ID = 'req-priv-a';
const REQ_B_ID = 'req-priv-b';
const MATCH_A_ID = 'match-priv-a';
const MATCH_B_ID = 'match-priv-b';
const TOKEN_A = 'tok-priv-a';
const TOKEN_B = 'tok-priv-b';
const TRACKING_A = 'BLD-PRIV-A';
const TRACKING_B = 'BLD-PRIV-B';

const nowISO = () => new Date().toISOString();
const futureISO = () => new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

function makeDonor(): Record<string, unknown> {
  return {
    id: DONOR_ID,
    full_name: 'Privacy Donor',
    email: 'privacy.donor@findmydonor.test',
    phone: '919911122233',
    whatsapp_number: '919911122233',
    blood_type: 'O+',
    pincode: '110029',
    area: 'Ansari Nagar',
    city: 'New Delhi',
    state: 'Delhi',
    availability_status: 'available',
    number_sharing_pref: 'on_approval',
    emergency_only: false,
    account_status: 'active',
    profile_complete: true,
    can_donate: true,
    created_at: nowISO(),
    updated_at: nowISO(),
  };
}

function makeRequest(id: string, tracking: string, requesterName: string, patientName: string): Record<string, unknown> {
  return {
    id,
    tracking_code: tracking,
    patient_name: patientName,
    blood_type_needed: 'O+',
    units_required: 2,
    units_confirmed: 0,
    hospital_name: 'AIIMS New Delhi',
    hospital_pincode: '110029',
    hospital_area: 'Ansari Nagar',
    hospital_city: 'New Delhi',
    hospital_state: 'Delhi',
    urgency_level: 'urgent',
    requester_name: requesterName,
    requester_email: 'privacy.requester@findmydonor.test',
    requester_phone: '919900001111',
    requester_id: DONOR_ID,
    additional_notes: '',
    status: 'open',
    expires_at: futureISO(),
    fulfilled_at: null,
    created_at: nowISO(),
  };
}

function makeMatch(id: string, requestId: string, token: string): Record<string, unknown> {
  return {
    id,
    request_id: requestId,
    donor_id: DONOR_ID,
    match_rank: 1,
    notification_channel: 'dashboard',
    notification_sent_at: null,
    reminder_sent_at: null,
    donor_response: 'pending',
    donor_response_at: null,
    contact_shared_at: null,
    outcome: 'pending',
    outcome_confirmed_at: null,
    created_at: nowISO(),
    distance_km: 1,
    unit_slot: null,
    public_token: token,
  };
}

describe('DONOR PRIVACY PROJECTION: per-donor sanitized /api/donor/matches', () => {
  let child: ChildProcess | null = null;

  before(async () => {
    // Seed fixture data into the shared store first so the server sees it.
    await dbSaveDoc('users', DONOR_ID, makeDonor());
    await dbSaveDoc('blood_requests', REQ_A_ID, makeRequest(REQ_A_ID, TRACKING_A, 'Secret Requester A', 'Secret Patient A'));
    await dbSaveDoc('blood_requests', REQ_B_ID, makeRequest(REQ_B_ID, TRACKING_B, 'Secret Requester B', 'Secret Patient B'));
    await dbSaveDoc('matches', MATCH_A_ID, makeMatch(MATCH_A_ID, REQ_A_ID, TOKEN_A));
    await dbSaveDoc('matches', MATCH_B_ID, makeMatch(MATCH_B_ID, REQ_B_ID, TOKEN_B));

    child = spawn(process.execPath, ['--import', 'tsx', 'backend/server.ts'], {
      stdio: 'inherit',
      env: { ...process.env, PORT, NODE_ENV: 'test', WAHA_BASE_URL: '' }
    });
    let up = false;
    for (let i = 0; i < 160; i++) {
      await new Promise(r => setTimeout(r, 250));
      const res = await fetch(`${BASE}/api/health`).catch(() => null);
      if (res && res.ok) { up = true; break; }
    }
    assert.ok(up, 'Test server should become healthy');
  });

  after(() => {
    if (child && child.pid) {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/t', '/f']);
      else child.kill();
    }
  });

  test('PENDING matches: requester PII + patient detail are HIDDEN; matchToken present', async () => {
    const res = await fetch(`${BASE}/api/donor/matches`, { headers: { Authorization: TOKEN } });
    assert.equal(res.status, 200);
    const data = await res.json() as any;

    const reqA = (data.requests || []).find((r: any) => r.id === REQ_A_ID);
    const reqB = (data.requests || []).find((r: any) => r.id === REQ_B_ID);
    assert.ok(reqA, 'request A present in projection');
    assert.ok(reqB, 'request B present in projection');
    for (const req of [reqA, reqB]) {
      assert.equal(req.requester_name, undefined, 'requester_name hidden while pending');
      assert.equal(req.requester_phone, undefined, 'requester_phone hidden while pending');
      assert.equal(req.requester_email, undefined, 'requester_email hidden while pending');
      assert.equal(req.patient_name, undefined, 'patient_name hidden while pending');
      assert.equal(req.additional_notes, undefined, 'additional_notes hidden while pending');
      assert.ok(req.hospital_name, 'hospital_name remains visible');
      assert.ok(req.tracking_code, 'tracking_code remains visible');
    }

    const matchA = (data.matches || []).find((m: any) => m.id === MATCH_A_ID);
    const matchB = (data.matches || []).find((m: any) => m.id === MATCH_B_ID);
    assert.ok(matchA && matchB, 'both matches present');
    assert.equal(matchA.matchToken, TOKEN_A, 'matchToken = public_token for A');
    assert.equal(matchB.matchToken, TOKEN_B, 'matchToken = public_token for B');
    assert.notEqual(matchA.matchToken, MATCH_A_ID, 'matchToken must differ from raw match id');
  });

  test('Donor approves match B; its request PII is REVEALED; A stays hidden', async () => {
    const accept = await fetch(`${BASE}/api/matches/${MATCH_B_ID}/approve`, {
      method: 'POST', headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(accept.status, 200, 'Approve should succeed');

    const res = await fetch(`${BASE}/api/donor/matches`, { headers: { Authorization: TOKEN } });
    assert.equal(res.status, 200);
    const data = await res.json() as any;

    const reqB = (data.requests || []).find((r: any) => r.id === REQ_B_ID);
    assert.ok(reqB, 'request B present');
    assert.equal(reqB.requester_name, 'Secret Requester B', 'requester_name revealed after approval');
    assert.equal(reqB.requester_phone, '919900001111', 'requester_phone revealed after approval');
    assert.equal(reqB.requester_email, 'privacy.requester@findmydonor.test', 'requester_email revealed after approval');
    assert.equal(reqB.patient_name, 'Secret Patient B', 'patient_name revealed after approval');

    const matchB = (data.matches || []).find((m: any) => m.id === MATCH_B_ID);
    assert.equal(matchB.donor_response, 'approved', 'match B approved');
    assert.ok(matchB.contact_shared_at, 'contact_shared_at set on approved match');

    const reqA = (data.requests || []).find((r: any) => r.id === REQ_A_ID);
    assert.equal(reqA.requester_name, undefined, 'A still hidden (still pending)');
    assert.equal(reqA.patient_name, undefined, 'A still hidden (still pending)');
  });

  test('CANCELLED/closed request: dropped from the live donor projection entirely', async () => {
    const cancel = await fetch(`${BASE}/api/requests/${TRACKING_B}/cancel`, {
      method: 'PATCH', headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(cancel.status, 200, `cancel should succeed, got ${cancel.status}`);

    // Phase 8: terminal requests (cancelled/fulfilled/expired) are removed
    // from "Live Matching Requests" — the search is over and no donor sees the
    // request (or its invite card) on any refresh. Stronger than redacting PII.
    const res = await fetch(`${BASE}/api/donor/matches`, { headers: { Authorization: TOKEN } });
    assert.equal(res.status, 200);
    const data = await res.json() as any;
    const reqB = (data.requests || []).find((r: any) => r.id === REQ_B_ID);
    assert.equal(reqB, undefined, 'cancelled request must not appear in the live donor projection');
    const matchB = (data.matches || []).find((m: any) => m.id === MATCH_B_ID);
    assert.equal(matchB, undefined, 'invite card for a cancelled request must not appear');
  });

  test('matchToken is stable across fetches', async () => {
    const res = await fetch(`${BASE}/api/donor/matches`, { headers: { Authorization: TOKEN } });
    assert.equal(res.status, 200);
    const data = await res.json() as any;
    const matchA = (data.matches || []).find((m: any) => m.id === MATCH_A_ID);
    assert.equal(matchA.matchToken, TOKEN_A, 'matchToken stable');
  });
});
