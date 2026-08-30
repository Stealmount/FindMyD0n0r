import './setup-env';
import 'dotenv/config';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Full institution lifecycle (Rev 3 §11):
//   sign-in-gated registration → POST /api/institutions/register (creates
//   pending row + profile link) → admin queue GET /api/admin/institutions →
//   review PATCH /api/admin/institutions/:id/review (approve/reject) →
//   /api/auth/me reflects the new verification_status.
//
// Uses the test-admin-token backdoor identity ('test-admin-id') for both the
// registration actor and the admin actor: the seeded Rev 3 profile has
// auth_method "google" so isRev3Profile passes, and no "users" row exists for
// that id (avoiding the deleted-account cross-file trap admin.test.ts sets on
// 'test-user-id').
const PORT = process.env.TEST_PORT || '5012';
const BASE = process.env.TEST_BASE_URL || `http://localhost:${PORT}`;

const ADMIN_TOKEN = 'Bearer test-admin-token';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const TEST_PROFILE_ID = 'test-admin-id';
const INST_PHONE = '919980001234';
const INST_EMAIL = 'institution-flow@example.com';

const REGISTER_BODY = {
  type: 'hospital',
  orgName: 'Flow Test Hospital',
  registrationNumber: 'REG-FLOW-001',
  contactPerson: 'Dr Flow',
  phone: INST_PHONE,
  email: INST_EMAIL,
  password: '1234567890', // Part B: 10-digit sign-in password
  address: '21 Test Road',
  city: 'Pune',
  pincode: '411001',
};

// Distinct payload for the email + password-only (no Google) sign-up path so it
// never collides with the main lifecycle institution above.
const NOAUTH_BODY = {
  type: 'blood_bank',
  orgName: 'NoAuth Blood Bank',
  registrationNumber: 'REG-NOAUTH-001',
  contactPerson: 'Dr NoAuth',
  phone: '919980005555',
  email: 'noauth-flow@example.com',
  password: '9876543210',
  address: '5 NoAuth Road',
  city: 'Mumbai',
  pincode: '400001',
};

describe('Institution registration + admin review flow', () => {
  let child: ChildProcess | null = null;

  before(async () => {
    process.env.DATA_DIR = path.join(process.cwd(), 'data-institution-test');

    // Rev 3 profile for the test-admin-token identity (merged — won't clobber
    // rows another suite seeds for the same id).
    const { saveDoc } = await import('../src/lib/serverDb');
    await saveDoc('profiles', TEST_PROFILE_ID, {
      full_name: 'Institution Flow Admin',
      phone: '919980000099',
      email: 'admin@findmydonor.online',
      auth_method: 'google',
      onboarding_step: 'complete',
      can_request: true,
      notification_channel: 'both',
      consent_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await saveDoc('auth_profile_links', TEST_PROFILE_ID, {
      auth_user_id: TEST_PROFILE_ID,
      profile_id: TEST_PROFILE_ID,
      provider: 'google',
    });

    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PORT,
      NODE_ENV: 'test',
      TEST_MODE: '1',
      DATA_DIR: process.env.DATA_DIR,
    };
    delete childEnv.TEST_IMPORT;

    try {
      const check = await fetch(`${BASE}/api/health`).catch(() => null);
      if (!check || !check.ok) {
        fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
        child = spawn(process.execPath, ['--import', 'tsx', 'backend/server.ts'], { stdio: 'pipe', env: childEnv });
        for (let i = 0; i < 40; i++) {
          await new Promise(r => setTimeout(r, 250));
          const res = await fetch(`${BASE}/api/health`).catch(() => null);
          if (res && res.ok) break;
        }
      }
    } catch (e) {
      console.error('Server startup helper failed', e);
    }
  });

  after(() => {
    if (child && child.pid) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      } else {
        child.kill();
      }
    }
  });

  let institutionId: string;

  test('POST /api/institutions/register without auth (email + password only) creates a pending institution', async () => {
    const res = await fetch(`${BASE}/api/institutions/register`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(NOAUTH_BODY),
    });
    assert.equal(res.status, 201, `Email+password registration must succeed without a Google/identity session; got ${res.status}`);
    const data = await res.json() as any;
    assert.equal(data.success, true);
    assert.equal(data.institution.verification_status, 'pending');
    assert.equal(data.institution.org_name, 'NoAuth Blood Bank');

    // The auto-created profile identity must be linked so the later
    // email + 10-digit-password sign-in resolves the institution.
    const links = await (await import('../src/lib/store')).getAll<{ profile_id: string; institution_id: string }>('institution_profile_links');
    const noAuthLink = links.find((l) => l.institution_id === data.institution.id);
    assert.ok(noAuthLink, 'No-auth registration must link an auto-created profile');
  });

  test('POST /api/institutions/register with valid auth creates a pending institution', async () => {
    const res = await fetch(`${BASE}/api/institutions/register`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, Authorization: ADMIN_TOKEN },
      body: JSON.stringify(REGISTER_BODY),
    });
    assert.equal(res.status, 201, `Expected 201, got ${res.status}`);
    const data = await res.json() as any;
    assert.equal(data.success, true);
    assert.equal(data.institution.verification_status, 'pending');
    assert.equal(data.institution.org_name, 'Flow Test Hospital');
    institutionId = data.institution.id;
    assert.ok(institutionId, 'Institution id must be returned');

    // The stored row must carry the canonical Rev 3 schema (not the legacy
    // institution_name / status fields) plus created_at.
    const { getDoc } = await import('../src/lib/store');
    const stored = await getDoc<any>('institutions', institutionId);
    assert.ok(stored, 'Institution row must be persisted');
    assert.equal(stored.org_name, 'Flow Test Hospital');
    assert.equal(stored.type, 'hospital');
    assert.equal(stored.phone, INST_PHONE);
    assert.equal(stored.email, INST_EMAIL);
    assert.equal(stored.city, 'Pune');
    assert.equal(stored.pincode, '411001');
    assert.equal(stored.verification_status, 'pending');
    assert.ok(stored.created_at, 'Institution row must carry created_at');

    // Part B: the 10-digit password is hashed (scrypt) — only salt+hash persist.
    assert.ok(stored.password_hash, 'password_hash must be stored');
    assert.ok(stored.password_salt, 'password_salt must be stored');
    assert.notEqual(stored.password_hash, '1234567890', 'Plaintext PIN must never be stored');
    assert.equal(stored.password_hash.length > 20, true, 'Hash must be non-trivial');
    assert.equal(stored.password_salt.length > 10, true, 'Salt must be non-trivial');

    // The submitting profile must be linked to the institution.
    const links = await (await import('../src/lib/store')).getAll<{ profile_id: string; institution_id: string }>('institution_profile_links');
    const link = links.find((l) => l.profile_id === TEST_PROFILE_ID);
    assert.ok(link, 'Profile must be linked to the institution');
    assert.equal(link.institution_id, institutionId);
  });

  test('re-registering with the same phone updates the existing row (id stable)', async () => {
    const res = await fetch(`${BASE}/api/institutions/register`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, Authorization: ADMIN_TOKEN },
      body: JSON.stringify({ ...REGISTER_BODY, orgName: 'Flow Test Hospital v2' }),
    });
    assert.equal(res.status, 201, `Expected 201, got ${res.status}`);
    const data = await res.json() as any;
    assert.equal(data.institution.id, institutionId, 'Duplicate phone must reuse the same institution id');
    assert.equal(data.institution.org_name, 'Flow Test Hospital v2');

    const { getDoc } = await import('../src/lib/store');
    const stored = await getDoc<any>('institutions', institutionId);
    assert.equal(stored.org_name, 'Flow Test Hospital v2');
    assert.equal(stored.verification_status, 'pending');
  });

  test('POST /api/institutions/login while pending returns 403 with a clear message', async () => {
    const res = await fetch(`${BASE}/api/institutions/login`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: INST_EMAIL, password: '1234567890' }),
    });
    assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
    const data = await res.json() as any;
    assert.equal(data.code, 'INSTITUTION_PENDING_REVIEW');
    assert.match(data.error, /pending review/i);
  });

  test('POST /api/institutions/login rejects malformed credentials', async () => {
    const resBadEmail = await fetch(`${BASE}/api/institutions/login`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: 'nope', password: '1234567890' }),
    });
    assert.equal(resBadEmail.status, 400, 'Invalid email format must be rejected by schema');

    const resBadPin = await fetch(`${BASE}/api/institutions/login`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: INST_EMAIL, password: 'notdigits' }),
    });
    assert.equal(resBadPin.status, 400, 'Non-numeric PIN must be rejected by schema');
  });

  test('PATCH /api/institutions/me while pending returns 403', async () => {
    const res = await fetch(`${BASE}/api/institutions/me`, {
      method: 'PATCH',
      headers: { ...JSON_HEADERS, Authorization: ADMIN_TOKEN },
      body: JSON.stringify({ city: 'Mumbai' }),
    });
    assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
    const data = await res.json() as any;
    assert.equal(data.code, 'INSTITUTION_NOT_VERIFIED');
  });

  test('GET /api/admin/institutions enforces admin auth and lists the pending row', async () => {
    const resNoAuth = await fetch(`${BASE}/api/admin/institutions`);
    assert.equal(resNoAuth.status, 403, 'No auth must be blocked by adminCheck');

    const resNonAdmin = await fetch(`${BASE}/api/admin/institutions`, {
      headers: { Authorization: 'Bearer test-valid-token' },
    });
    assert.equal(resNonAdmin.status, 403, 'Non-admin token must be rejected');

    const resAdmin = await fetch(`${BASE}/api/admin/institutions`, {
      headers: { Authorization: ADMIN_TOKEN },
    });
    assert.equal(resAdmin.status, 200, 'Admin token must list institutions');
    const data = await resAdmin.json() as any;
    assert.ok(Array.isArray(data.institutions), 'Response must contain an institutions array');
    const mine = data.institutions.find((i: any) => i.id === institutionId);
    assert.ok(mine, 'Pending institution must appear in the admin queue');
    assert.equal(mine.verification_status, 'pending');
    assert.equal('password_hash' in mine, false, 'Admin queue must not expose password_hash');
    assert.equal('password_salt' in mine, false, 'Admin queue must not expose password_salt');
  });

  test('GET /api/admin/institutions?status=verified excludes the pending row', async () => {
    const res = await fetch(`${BASE}/api/admin/institutions?status=verified`, {
      headers: { Authorization: ADMIN_TOKEN },
    });
    assert.equal(res.status, 200);
    const data = await res.json() as any;
    const mine = data.institutions.some((i: any) => i.id === institutionId);
    assert.equal(mine, false, 'Pending institution must not appear under ?status=verified');
  });

  test('PATCH review rejects invalid action and unknown id', async () => {
    const resBad = await fetch(`${BASE}/api/admin/institutions/${institutionId}/review`, {
      method: 'PATCH',
      headers: { ...JSON_HEADERS, Authorization: ADMIN_TOKEN },
      body: JSON.stringify({ action: 'nuke' }),
    });
    assert.equal(resBad.status, 400, 'Invalid action must be rejected');

    const resMissing = await fetch(`${BASE}/api/admin/institutions/does-not-exist/review`, {
      method: 'PATCH',
      headers: { ...JSON_HEADERS, Authorization: ADMIN_TOKEN },
      body: JSON.stringify({ action: 'approve' }),
    });
    assert.equal(resMissing.status, 404, 'Unknown institution must 404');
  });

  test('PATCH review rejects without a rejection reason', async () => {
    const res = await fetch(`${BASE}/api/admin/institutions/${institutionId}/review`, {
      method: 'PATCH',
      headers: { ...JSON_HEADERS, Authorization: ADMIN_TOKEN },
      body: JSON.stringify({ action: 'reject' }),
    });
    assert.equal(res.status, 400, 'Rejecting without a reason must 400');
  });

  test('PATCH review approve sets verification_status=verified and flips profile can_request', async () => {
    const res = await fetch(`${BASE}/api/admin/institutions/${institutionId}/review`, {
      method: 'PATCH',
      headers: { ...JSON_HEADERS, Authorization: ADMIN_TOKEN },
      body: JSON.stringify({ action: 'approve' }),
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json() as any;
    assert.equal(data.success, true);
    assert.equal(data.institution.verification_status, 'verified');
    assert.equal(data.institution.reviewed_by, 'admin@findmydonor.online');
    assert.ok(data.institution.reviewed_at, 'reviewed_at must be set');
    assert.equal(data.institution.rejection_reason, null);

    const { getDoc } = await import('../src/lib/store');
    const stored = await getDoc<any>('institutions', institutionId);
    assert.equal(stored.verification_status, 'verified');

    const profile = await getDoc<any>('profiles', TEST_PROFILE_ID);
    assert.equal(profile.can_request, true, 'Approval must flip the linked profile to can_request');
  });

  test('GET /api/auth/me reflects the verified institution', async () => {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: ADMIN_TOKEN },
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json() as any;
    assert.ok(data.institution, '/me must include the institution');
    assert.equal(data.institution.id, institutionId);
    assert.equal(data.institution.verification_status, 'verified');
    assert.equal(data.institution.org_name, 'Flow Test Hospital v2');
    assert.equal('password_hash' in data.institution, false, '/me must not expose password_hash');
    assert.equal('password_salt' in data.institution, false, '/me must not expose password_salt');
  });

  test('POST /api/institutions/login with wrong PIN returns 401', async () => {
    const res = await fetch(`${BASE}/api/institutions/login`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: INST_EMAIL, password: '0000000000' }),
    });
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
    const data = await res.json() as any;
    assert.equal(data.code, 'UNAUTHORIZED');
  });

  test('POST /api/institutions/login with correct PIN mints a session token and hides hashes', async () => {
    const res = await fetch(`${BASE}/api/institutions/login`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: INST_EMAIL, password: '1234567890' }),
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json() as any;
    assert.equal(data.success, true);
    assert.ok(data.customToken, 'Login must return a custom token');
    assert.equal(data.customToken, 'test-custom-token:test-admin-id', 'Test-mode token references the linked profile identity');
    assert.equal(data.institution.id, institutionId);
    assert.equal(data.institution.verification_status, 'verified');
    assert.equal('password_hash' in data.institution, false, 'Login response must not expose password_hash');
    assert.equal('password_salt' in data.institution, false, 'Login response must not expose password_salt');
  });

  test('POST /api/institutions/login rejects an unknown email', async () => {
    const res = await fetch(`${BASE}/api/institutions/login`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: 'nobody@example.com', password: '1234567890' }),
    });
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
  });

  test('PATCH /api/institutions/me updates contact fields, persists and hides hashes', async () => {
    const res = await fetch(`${BASE}/api/institutions/me`, {
      method: 'PATCH',
      headers: { ...JSON_HEADERS, Authorization: ADMIN_TOKEN },
      body: JSON.stringify({ contactPerson: 'Dr Updated', phone: '919980009876', address: '88 New Road', city: 'Nagpur', pincode: '440001' }),
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json() as any;
    assert.equal(data.success, true);
    assert.equal(data.institution.verification_status, 'verified');
    assert.equal(data.institution.contact_person, 'Dr Updated');
    assert.equal(data.institution.city, 'Nagpur');
    assert.equal(data.institution.pincode, '440001');
    assert.equal(data.institution.phone, '919980009876');
    assert.equal('password_hash' in data.institution, false, 'PATCH response must not expose password_hash');
    assert.equal('password_salt' in data.institution, false, 'PATCH response must not expose password_salt');

    const { getDoc } = await import('../src/lib/store');
    const stored = await getDoc<any>('institutions', institutionId);
    assert.equal(stored.contact_person, 'Dr Updated');
    assert.equal(stored.city, 'Nagpur');
    assert.equal(stored.pincode, '440001');
    assert.equal(stored.phone, '919980009876');
    assert.ok(String(stored.updated_at) >= String(stored.created_at), 'updated_at must advance');
  });

  test('GET /api/institutions/me reflects verified updates without exposing hashes', async () => {
    const res = await fetch(`${BASE}/api/institutions/me`, {
      headers: { ...JSON_HEADERS, Authorization: ADMIN_TOKEN },
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json() as any;
    const mine = (data.institutions || []).find((i: any) => i.id === institutionId);
    assert.ok(mine, '/me must list the institutional link');
    assert.equal(mine.verification_status, 'verified');
    assert.equal(mine.contact_person, 'Dr Updated');
    assert.equal(mine.city, 'Nagpur');
    assert.equal('password_hash' in mine, false, '/me must not expose password_hash');
    assert.equal('password_salt' in mine, false, '/me must not expose password_salt');
  });

  test('PATCH /api/institutions/me strips identity edits (immutable after review)', async () => {
    const res = await fetch(`${BASE}/api/institutions/me`, {
      method: 'PATCH',
      headers: { ...JSON_HEADERS, Authorization: ADMIN_TOKEN },
      body: JSON.stringify({ orgName: 'Sneaky Rename', registrationNumber: 'REG-HACK', email: 'hack@example.com', address: '99 Kept Road' }),
    });
    assert.equal(res.status, 200, `Expected 200 with identity fields stripped, got ${res.status}`);
    const data = await res.json() as any;
    assert.equal(data.institution.org_name, 'Flow Test Hospital v2');
    assert.equal(data.institution.registration_number, REGISTER_BODY.registrationNumber);
    assert.equal(data.institution.email, INST_EMAIL);
    assert.equal(data.institution.address, '99 Kept Road');

    const { getDoc } = await import('../src/lib/store');
    const stored = await getDoc<any>('institutions', institutionId);
    assert.equal(stored.org_name, 'Flow Test Hospital v2');
    assert.equal(stored.registration_number, REGISTER_BODY.registrationNumber);
    assert.equal(stored.email, INST_EMAIL);
    assert.equal(stored.address, '99 Kept Road');
  });

  test('PATCH /api/institutions/me rejects an invalid phone', async () => {
    const res = await fetch(`${BASE}/api/institutions/me`, {
      method: 'PATCH',
      headers: { ...JSON_HEADERS, Authorization: ADMIN_TOKEN },
      body: JSON.stringify({ phone: '12345' }),
    });
    assert.equal(res.status, 400, `Expected 400, got ${res.status}`);
  });

  test('PATCH /api/institutions/me without auth returns 401', async () => {
    const res = await fetch(`${BASE}/api/institutions/me`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ city: 'Mumbai' }),
    });
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
  });

  test('PATCH review reject with reason sets verification_status=rejected', async () => {
    const res = await fetch(`${BASE}/api/admin/institutions/${institutionId}/review`, {
      method: 'PATCH',
      headers: { ...JSON_HEADERS, Authorization: ADMIN_TOKEN },
      body: JSON.stringify({ action: 'reject', rejection_reason: 'Invalid registration number' }),
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json() as any;
    assert.equal(data.institution.verification_status, 'rejected');
    assert.equal(data.institution.rejection_reason, 'Invalid registration number');

    const { getDoc } = await import('../src/lib/store');
    const stored = await getDoc<any>('institutions', institutionId);
    assert.equal(stored.verification_status, 'rejected');
    assert.equal(stored.rejection_reason, 'Invalid registration number');
  });

  test('POST /api/institutions/login while rejected returns 403 with the reason', async () => {
    const res = await fetch(`${BASE}/api/institutions/login`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: INST_EMAIL, password: '1234567890' }),
    });
    assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
    const data = await res.json() as any;
    assert.equal(data.code, 'INSTITUTION_REJECTED');
    assert.match(data.error, /Invalid registration number/);
  });

  test('PATCH /api/institutions/me while rejected returns 403', async () => {
    const res = await fetch(`${BASE}/api/institutions/me`, {
      method: 'PATCH',
      headers: { ...JSON_HEADERS, Authorization: ADMIN_TOKEN },
      body: JSON.stringify({ city: 'Mumbai' }),
    });
    assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
    const data = await res.json() as any;
    assert.equal(data.code, 'INSTITUTION_NOT_VERIFIED');
  });

  test('GET /api/auth/me reflects the rejected institution', async () => {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: ADMIN_TOKEN },
    });
    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.equal(data.institution.verification_status, 'rejected');
    assert.equal(data.institution.rejection_reason, 'Invalid registration number');
  });

  test('legacy POST /register endpoint returns 410 Gone', async () => {
    const res = await fetch(`${BASE}/register`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, Authorization: ADMIN_TOKEN },
      body: JSON.stringify({
        institution_name: 'Old Schema Hospital',
        institution_type: 'hospital',
        pincode: '400001',
        city: 'Mumbai',
        contact_person: 'Old Contact',
        contact_phone: '919980000077',
        email: 'old-schema@example.com',
      }),
    });
    assert.equal(res.status, 410, 'Retired endpoint must return 410 Gone');
    const data = await res.json() as any;
    assert.equal(data.code, 'LEGACY_ENDPOINT');
  });
});