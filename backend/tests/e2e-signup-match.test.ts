import 'dotenv/config';
import './setup-env';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';

const PORT = process.env.TEST_PORT || '5008';
const BASE = `http://127.0.0.1:${PORT}`;

describe('E2E: Donor and Requester Signup & Match', () => {
  let child: ChildProcess | null = null;
  let donorToken = '';
  let requesterToken = '';
  let requestId = '';
  let donorId = '';
  let matchId = '';

  const randomSuffix1 = Math.floor(1000000 + Math.random() * 9000000).toString();
  const randomSuffix2 = Math.floor(1000000 + Math.random() * 9000000).toString();
  const DONOR_PHONE = `91999${randomSuffix1}`;
  const REQ_PHONE = `91999${randomSuffix2}`;

  before(async () => {
    child = spawn(process.execPath, ['--import', 'tsx', 'backend/server.ts'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT,
        NODE_ENV: 'test',
        WAHA_BASE_URL: ''
      }
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

  test('Create Donor Account', async () => {
    // 1. Send OTP
    let res = await fetch(`${BASE}/api/wa/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: DONOR_PHONE, purpose: 'signup' })
    });
    assert.equal(res.status, 200);

    // 2. Verify OTP (dev bypass OTP is 000000)
    res = await fetch(`${BASE}/api/wa/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: DONOR_PHONE, otp: '000000', purpose: 'signup' })
    });
    assert.equal(res.status, 200);
    const verifyData = await res.json() as any;
    const verificationToken = verifyData.verificationToken;
    assert.ok(verificationToken);

    // 3. Signup
    res = await fetch(`${BASE}/api/auth/phone-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: DONOR_PHONE,
        password: 'password123',
        full_name: 'Test Donor',
        intent: 'donor',
        verificationToken
      })
    });
    assert.equal(res.status, 201);
    const signupData = await res.json() as any;
    donorToken = signupData.session.access_token;
    donorId = signupData.profile.id;
    assert.ok(donorToken);
    
    // 4. Complete donor profile
    res = await fetch(`${BASE}/api/donor-profile/complete`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorToken}` },
      body: JSON.stringify({
        blood_group: 'O+',
        pincode: '110001',
        area: 'Test Area',
        city: 'Delhi',
        state: 'Delhi',
        latitude: 28.6,
        longitude: 77.2,
        health_self_declaration: true
      })
    });
    assert.equal(res.status, 200);

    // 5. Set availability
    res = await fetch(`${BASE}/api/donor-profile/availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorToken}` },
      body: JSON.stringify({ isAvailable: true })
    });
    assert.equal(res.status, 200);
  });

  test('Create Requester Account', async () => {
    // 1. Send OTP
    let res = await fetch(`${BASE}/api/wa/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: REQ_PHONE, purpose: 'signup' })
    });
    assert.equal(res.status, 200);

    // 2. Verify OTP
    res = await fetch(`${BASE}/api/wa/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: REQ_PHONE, otp: '000000', purpose: 'signup' })
    });
    assert.equal(res.status, 200);
    const verifyData = await res.json() as any;
    const verificationToken = verifyData.verificationToken;

    // 3. Signup
    res = await fetch(`${BASE}/api/auth/phone-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: REQ_PHONE,
        password: 'password123',
        full_name: 'Test Requester',
        intent: 'requester',
        verificationToken
      })
    });
    assert.equal(res.status, 201);
    const signupData = await res.json() as any;
    requesterToken = signupData.session.access_token;
    assert.ok(requesterToken);
  });

  test('Requester Creates Blood Request', async () => {
    const res = await fetch(`${BASE}/api/requests`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${requesterToken}`,
        'idempotency-key': 'req1'
      },
      body: JSON.stringify({
        patient_name: 'Patient X',
        blood_type_needed: 'O+',
        units_required: 1,
        hospital_name: 'Test Hospital',
        hospital_pincode: '110001',
        hospital_area: 'Test Area',
        hospital_city: 'Delhi',
        hospital_state: 'Delhi',
        urgency_level: 'urgent',
        requester_name: 'Test Requester',
        requester_phone: REQ_PHONE
      })
    });
    assert.equal(res.status, 201);
    const data = await res.json() as any;
    requestId = data.requestId;
    assert.ok(requestId);
  });

  test('Check if Match is created', async () => {
    // Wait for the background worker or matching algorithm to run
    await new Promise(r => setTimeout(r, 1000));

    const res = await fetch(`${BASE}/api/donor/matches`, {
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.ok(data.matches && data.matches.length > 0, 'Should find at least 1 match');
    const myMatch = (data.matches || []).find((m: any) => m.request_id === requestId) || data.matches[0];
    matchId = myMatch.id;
  });

  test('Donor Approves Match', async () => {
    if (!matchId) {
      assert.fail('matchId is not set. Skipping approval test.');
    }
    // Donor approves the match
    const res = await fetch(`${BASE}/api/matches/${matchId}/approve`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${donorToken}`
      }
    });
    assert.equal(res.status, 200);
    
    // Requester verifies it's approved
    const reqRes = await fetch(`${BASE}/api/requester/requests`, {
      headers: { 'Authorization': `Bearer ${requesterToken}` }
    });
    const data = await reqRes.json() as any;
    const myMatches = (data.matches || []).filter((m: any) => m.id === matchId || m.request_id === requestId);
    assert.ok(myMatches.length > 0, "myMatches should not be empty");
    assert.equal(myMatches[0].donor_response, 'approved', 'Match should be approved');
  });
});
