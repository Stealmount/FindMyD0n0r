import 'dotenv/config';
import './setup-env';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';

const PORT = process.env.TEST_PORT || '5009';
const BASE = `http://127.0.0.1:${PORT}`;

const DONOR_EMAIL = 'hello.sonusingh@proton.me';
const REQUESTER_EMAIL = 'pi.coordinater@gmail.com';

describe('EMAIL FLOW TEST: OTP Welcome -> SOS Match -> YES Reply -> Requester Profile', () => {
  let child: ChildProcess | null = null;
  let donorToken = '';
  let requesterToken = '';
  let donorId = '';
  let requestId = '';
  let matchId = '';

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

  test('Step 1: OTP & Welcome Message for Requester (pi.coordinater@gmail.com)', async () => {
    // 1. Send OTP
    let res = await fetch(`${BASE}/api/email/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: REQUESTER_EMAIL })
    });
    assert.equal(res.status, 200, 'Send OTP for requester should succeed');

    // 2. Verify OTP (DEV OTP is 000000)
    res = await fetch(`${BASE}/api/email/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: REQUESTER_EMAIL, otp: '000000' })
    });
    assert.equal(res.status, 200, 'Verify OTP for requester should succeed');
    const verifyData = await res.json() as any;
    const verificationToken = verifyData.verificationToken;
    assert.ok(verificationToken, 'Should receive verification token');

    // 3. Signup Requester
    res = await fetch(`${BASE}/api/auth/email-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: REQUESTER_EMAIL,
        password: 'Password123!',
        full_name: 'PI Coordinator',
        intent: 'requester',
        verificationToken
      })
    });
    assert.ok(res.status === 200 || res.status === 201, 'Requester email signup should succeed');
    const signupData = await res.json() as any;
    requesterToken = signupData.session.access_token;
    assert.ok(requesterToken, 'Should receive access token for requester');

    console.log('\n======================================================');
    console.log('✅ STEP 1 COMPLETE: OTP & Welcome Email processed for Requester:');
    console.log(`   Email: ${REQUESTER_EMAIL}`);
    console.log(`   Name: PI Coordinator`);
    console.log('======================================================\n');
  });

  test('Step 2: OTP & Welcome Message for Donor (hello.sonusingh@proton.me)', async () => {
    // 1. Send OTP
    let res = await fetch(`${BASE}/api/email/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: DONOR_EMAIL })
    });
    assert.equal(res.status, 200, 'Send OTP for donor should succeed');

    // 2. Verify OTP
    res = await fetch(`${BASE}/api/email/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: DONOR_EMAIL, otp: '000000' })
    });
    assert.equal(res.status, 200, 'Verify OTP for donor should succeed');
    const verifyData = await res.json() as any;
    const verificationToken = verifyData.verificationToken;
    assert.ok(verificationToken, 'Should receive verification token');

    // 3. Signup Donor
    res = await fetch(`${BASE}/api/auth/email-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: DONOR_EMAIL,
        password: 'Password123!',
        full_name: 'Sonu Singh',
        intent: 'donor',
        verificationToken
      })
    });
    assert.ok(res.status === 200 || res.status === 201, 'Donor email signup should succeed');
    const signupData = await res.json() as any;
    donorToken = signupData.session.access_token;
    donorId = signupData.profile.id;
    assert.ok(donorToken, 'Should receive access token for donor');

    // 4. Complete Donor Profile
    res = await fetch(`${BASE}/api/donor-profile/complete`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorToken}` },
      body: JSON.stringify({
        blood_group: 'O+',
        pincode: '110029',
        area: 'AIIMS / Safdarjung Enclave',
        city: 'New Delhi',
        state: 'Delhi',
        latitude: 28.5672,
        longitude: 77.2100,
        health_self_declaration: true
      })
    });
    assert.equal(res.status, 200, 'Donor profile completion should succeed');

    // 5. Set availability to TRUE
    res = await fetch(`${BASE}/api/donor-profile/availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorToken}` },
      body: JSON.stringify({ isAvailable: true })
    });
    assert.equal(res.status, 200, 'Donor availability update should succeed');

    console.log('\n======================================================');
    console.log('✅ STEP 2 COMPLETE: OTP & Welcome Email processed for Donor:');
    console.log(`   Email: ${DONOR_EMAIL}`);
    console.log(`   Name: Sonu Singh`);
    console.log(`   Blood Group: O+ | Pincode: 110029`);
    console.log('======================================================\n');
  });

  test('Step 3: Create Blood Request & Broadcast Match Message', async () => {
    const res = await fetch(`${BASE}/api/requests`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${requesterToken}`,
        'idempotency-key': 'req_email_test_1'
      },
      body: JSON.stringify({
        patient_name: 'Patient Emergency Case',
        blood_type_needed: 'O+',
        units_required: 1,
        hospital_name: 'AIIMS New Delhi',
        hospital_pincode: '110029',
        hospital_area: 'Ansari Nagar',
        hospital_city: 'New Delhi',
        hospital_state: 'Delhi',
        urgency_level: 'critical',
        requester_name: 'PI Coordinator',
        requester_phone: '919876543210'
      })
    });
    assert.equal(res.status, 201, 'Blood request creation should succeed');
    const data = await res.json() as any;
    requestId = data.requestId;
    assert.ok(requestId, 'Should return requestId');

    // Wait for match engine to associate donor
    await new Promise(r => setTimeout(r, 1000));

    // Fetch matches for donor
    const matchRes = await fetch(`${BASE}/api/donor/matches`, {
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    assert.equal(matchRes.status, 200);
    const matchData = await matchRes.json() as any;
    assert.ok(matchData.matches && matchData.matches.length > 0, 'Match engine should match Sonu Singh with the request');
    
    const matched = matchData.matches.find((m: any) => m.request_id === requestId) || matchData.matches[0];
    matchId = matched.id;
    assert.ok(matchId, 'Match ID should be present');

    console.log('\n======================================================');
    console.log('✅ STEP 3 COMPLETE: Emergency Blood Request & SOS Match Broadcasted:');
    console.log(`   Request ID: ${requestId}`);
    console.log(`   Matched Donor Email: ${DONOR_EMAIL}`);
    console.log(`   Match ID: ${matchId}`);
    console.log('======================================================\n');
  });

  test('Step 4: Donor Replies "YES" via Email & Unlocks Requester Profile', async () => {
    assert.ok(matchId, 'matchId must be defined');

    // Simulate donor replying "YES" via email / respond-public API
    const replyRes = await fetch(`${BASE}/api/matches/${matchId}/respond-public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: 'approved' })
    });
    assert.equal(replyRes.status, 200, 'Donor YES reply should be processed successfully');

    // Fetch updated matches & requester profile details
    const donorMatchesRes = await fetch(`${BASE}/api/donor/matches`, {
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    const donorMatchesData = await donorMatchesRes.json() as any;
    const matchDetails = (donorMatchesData.matches || []).find((m: any) => m.id === matchId);
    
    assert.ok(matchDetails, 'Match details should exist');
    assert.equal(matchDetails.donor_response, 'approved', 'Donor response should be approved');

    // Retrieve associated request object (Requester's Profile)
    const reqDetails = (donorMatchesData.requests || []).find((r: any) => r.id === requestId);
    assert.ok(reqDetails, 'Requester request details should be revealed');

    console.log('\n================================================================');
    console.log('🎉 STEP 4 COMPLETE: YES REPLY PROCESSED & REQUESTER PROFILE REVEALED:');
    console.log('----------------------------------------------------------------');
    console.log(`  👤 Requester Name  : ${reqDetails.requester_name}`);
    console.log(`  📧 Requester Email : ${REQUESTER_EMAIL}`);
    console.log(`  📞 Requester Phone : ${reqDetails.requester_phone}`);
    console.log(`  🏥 Hospital Name   : ${reqDetails.hospital_name}`);
    console.log(`  📍 Location        : ${reqDetails.hospital_area}, ${reqDetails.hospital_city} (${reqDetails.hospital_pincode})`);
    console.log(`  🩸 Patient Name    : ${reqDetails.patient_name}`);
    console.log(`  🩸 Blood Type Needed: ${reqDetails.blood_type_needed} (${reqDetails.units_required} Unit)`);
    console.log(`  ⚡ Urgency Level   : ${reqDetails.urgency_level.toUpperCase()}`);
    console.log(`  🔑 Tracking Code   : ${reqDetails.tracking_code}`);
    console.log(`  ✅ Match Status    : APPROVED (Contact shared with Sonu Singh)`);
    console.log('================================================================\n');
  });
});
