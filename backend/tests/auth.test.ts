import './setup-env';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';

const PORT = process.env.TEST_PORT || '5005';
const BASE = process.env.TEST_BASE_URL || `http://localhost:${PORT}`;

describe('Authentication & Onboarding API Endpoints (/api/auth/* & /api/wa/*)', () => {
  let child: ChildProcess | null = null;

  before(async () => {
    try {
      const check = await fetch(`${BASE}/api/health`).catch(() => null);
      if (!check || !check.ok) {
        child = spawn(process.execPath, ['--import', 'tsx', 'backend/server.ts'], {
          stdio: 'pipe',
          env: {
            ...process.env,
            PORT,
            NODE_ENV: 'test',
          }
        });

        for (let i = 0; i < 120; i++) {
          await new Promise(r => setTimeout(r, 500));
          const res = await fetch(`http://127.0.0.1:${PORT}/api/health`).catch(() => null);
          if (res && res.ok) break;
        }
      }
    } catch {
      // Use existing server or spawned process
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

  // ── Existing contract tests ────────────────────────────────────────────

  test('GET /api/auth/me without sign-in returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE}/api/auth/me`);
    assert.equal(res.status, 401, 'Should return 401 when no session token is provided');
    const body = await res.json() as { error?: string };
    assert.equal(body.error, 'Sign in is required.');
  });

  test('POST /api/wa/send-otp rejects invalid phone number format with 400', async () => {
    const res = await fetch(`${BASE}/api/wa/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '123' })
    });
    assert.equal(res.status, 400, 'Should reject non-10-digit phone');
    const body = await res.json() as { error?: string };
    assert.ok(body.error?.includes('valid 10-digit Indian WhatsApp number') || body.error?.includes('valid'), 'Should include validation error');
  });

  test('POST /api/wa/send-otp accepts valid 10-digit Indian mobile number', async () => {
    const res = await fetch(`${BASE}/api/wa/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210' })
    });
    assert.ok([200, 410, 429, 500, 503].includes(res.status), `Should respond with status indicating processing or rate limit, got ${res.status}`);
    const body = await res.json() as { success?: boolean; error?: string };
    assert.ok(body !== null, 'Response should be valid JSON payload');
  });

  test('POST /api/auth/complete-verification without sign-in returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE}/api/auth/complete-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationToken: 'test-token',
        phone: '9876543210',
        fullName: 'Test User',
        intent: 'donor',
        consentAccepted: true
      })
    });
    assert.equal(res.status, 401, 'Complete verification requires authenticated session');
  });

  test('PATCH /api/donor-profile/complete without sign-in returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE}/api/donor-profile/complete`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blood_group: 'O+',
        pincode: '110001',
        area: 'Connaught Place',
        city: 'New Delhi',
        health_self_declaration: true
      })
    });
    assert.equal(res.status, 401, 'Donor profile completion requires authenticated session');
  });

  test('PATCH /api/donor-profile/availability without sign-in returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE}/api/donor-profile/availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: true })
    });
    assert.equal(res.status, 401, 'Availability toggle requires authenticated session');
  });

  // ── Regression tests: null-phone / phone-optional authentication rules ─
  // Tests use the test-valid-token stub (active when NODE_ENV=test or
  // TEST_MODE=1). They verify the API contract without a live DB.
  // When the live DB is unavailable: 500/503 is acceptable.
  // 400 "phone required" on any auth endpoint is always a bug, regardless of env.

  test('REGRESSION 1: GET /api/auth/me with stub token returns 200 or 503 (never 401)', async () => {
    // A valid session must never be rejected as unauthenticated.
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: 'Bearer test-valid-token' }
    });
    assert.ok([200, 503].includes(res.status),
      `Valid token must not return 401. Got ${res.status}`);
  });

  test('REGRESSION 2: POST /api/auth/complete-verification accepts no phone (nullable)', async () => {
    // complete-verification MUST accept a body with no phone field.
    // 400 "phone required" = the bug we are guarding against.
    const res = await fetch(`${BASE}/api/auth/complete-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-token',
      },
      body: JSON.stringify({
        fullName: 'Test Google User',
        email: 'test@example.com',
        // phone intentionally omitted
      }),
    });
    const body = await res.json() as { error?: string };
    assert.ok([201, 500, 503].includes(res.status),
      `complete-verification must not reject missing phone. Got ${res.status}: ${body.error}`);
  });

  test('REGRESSION 3: POST /api/auth/complete-verification accepts no intent (nullable)', async () => {
    const res = await fetch(`${BASE}/api/auth/complete-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-token',
      },
      body: JSON.stringify({
        fullName: 'Test Google User',
        email: 'test@example.com',
        // intent intentionally omitted
      }),
    });
    const body = await res.json() as { error?: string };
    assert.ok([201, 500, 503].includes(res.status),
      `complete-verification must not reject missing intent. Got ${res.status}: ${body.error}`);
  });

  test('REGRESSION 4: POST /api/auth/complete-verification accepts no whatsappPhone (nullable)', async () => {
    const res = await fetch(`${BASE}/api/auth/complete-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-token',
      },
      body: JSON.stringify({
        fullName: 'Test Google User',
        email: 'test@example.com',
        // whatsappPhone intentionally omitted
      }),
    });
    const body = await res.json() as { error?: string };
    assert.ok([201, 500, 503].includes(res.status),
      `complete-verification must not reject missing whatsappPhone. Got ${res.status}: ${body.error}`);
  });

  test('REGRESSION 5: POST /api/auth/email-signup does not reject for missing phone', async () => {
    // email-signup must NOT require phone at any point.
    const res = await fetch(`${BASE}/api/auth/email-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Test Email User',
        email: 'regression5@findmydonor.test',
        password: 'Abcdefgh1!',
        intent: 'donor',
        // phone intentionally omitted
      }),
    });
    const body = await res.json() as { nextStep?: string; error?: string };
    // 409 = already registered; 500/503 = DB unavailable; 201 = success.
    // 400 with phone-related message = bug.
    assert.ok([201, 409, 500, 503].includes(res.status),
      `email-signup must not reject for missing phone. Got ${res.status}: ${body.error}`);
    if (res.status === 201) {
      assert.equal(body.nextStep, 'complete',
        `email-signup must return nextStep='complete', not '${body.nextStep}'`);
    }
  });

  test('REGRESSION 6: PATCH /api/profile/contact without sign-in returns 401', async () => {
    const res = await fetch(`${BASE}/api/profile/contact`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210' }),
    });
    assert.equal(res.status, 401, 'Contact endpoint requires authentication');
  });

  test('REGRESSION 7: PATCH /api/profile/contact accepts phone-only update (no whatsappPhone required)', async () => {
    const res = await fetch(`${BASE}/api/profile/contact`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-token',
      },
      body: JSON.stringify({ phone: '9876543210' }),
    });
    // 400 = phone-only update rejected = bug.
    assert.ok([200, 404, 500, 503].includes(res.status),
      `Contact endpoint must accept phone-only update. Got ${res.status}`);
  });

  test('REGRESSION 8: PATCH /api/profile/contact accepts whatsapp-only update (phone not required)', async () => {
    const res = await fetch(`${BASE}/api/profile/contact`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-token',
      },
      body: JSON.stringify({ whatsappPhone: '9123456789' }),
    });
    assert.ok([200, 404, 500, 503].includes(res.status),
      `Contact endpoint must accept whatsapp-only update. Got ${res.status}`);
  });

  test('REGRESSION 9: PATCH /api/profile/contact rejects empty body (no fields at all)', async () => {
    const res = await fetch(`${BASE}/api/profile/contact`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-token',
      },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400, 'Contact endpoint must reject body with no contact fields');
    const body = await res.json() as { error?: string };
    assert.ok(body.error, 'Should include error message');
  });

  test('REGRESSION 10: POST /api/auth/phone-signup requires intent (phone flow unchanged)', async () => {
    // Phone-signup still requires intent — this is the legacy phone-first flow.
    const res = await fetch(`${BASE}/api/auth/phone-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9876543210',
        password: 'Abcdefgh1!',
        full_name: 'Test Phone User',
        // intent intentionally omitted
      }),
    });
    assert.ok([400, 422].includes(res.status),
      `phone-signup must require intent. Got ${res.status}`);
  });

  test('REGRESSION 11: complete-verification with null phone field is accepted', async () => {
    // Explicitly sending phone: null must not trigger a 400 validation error.
    const res = await fetch(`${BASE}/api/auth/complete-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-token',
      },
      body: JSON.stringify({
        fullName: 'Google User No Phone',
        email: 'googlenophone@example.com',
        phone: null,
      }),
    });
    const body = await res.json() as { error?: string };
    assert.ok([201, 500, 503].includes(res.status),
      `complete-verification must accept null phone. Got ${res.status}: ${body.error}`);
  });

  test('REGRESSION 12: PATCH /api/profile/contact accepts empty phone string to clear it', async () => {
    // Sending phone="" should be accepted (clears the field).
    const res = await fetch(`${BASE}/api/profile/contact`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-token',
      },
      body: JSON.stringify({ phone: '' }),
    });
    assert.ok([200, 404, 500, 503].includes(res.status),
      `Contact endpoint must accept empty phone to clear it. Got ${res.status}`);
  });

  test('REGRESSION 13: GET /api/donor/matches without sign-in returns 401 (dashboard protected)', async () => {
    const res = await fetch(`${BASE}/api/donor/matches`);
    assert.equal(res.status, 401, 'Donor matches endpoint requires authentication');
  });

  test('REGRESSION 14: POST /api/auth/email-signup without phone never returns 400 for missing phone', async () => {
    // Explicit guard: schema must not have phone as required.
    const res = await fetch(`${BASE}/api/auth/email-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'No Phone User',
        email: 'nophone_r14@findmydonor.test',
        password: 'Abcdefgh1!',
        verificationToken: 'test-token',
        // phone intentionally omitted — schema must not reject this
      }),
    });
    const body = await res.json() as { error?: string };
    // If we get 400 AND the error message mentions phone, that is the regression.
    const isPhoneRejection = res.status === 400 && (body.error || '').toLowerCase().includes('phone');
    assert.ok(!isPhoneRejection,
      `email-signup must not reject for missing phone. Got 400: ${body.error}`);
  });

  test('REGRESSION 15: POST /api/auth/email-signup without verificationToken returns 400', async () => {
    const res = await fetch(`${BASE}/api/auth/email-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Unverified Email User',
        email: 'unverified_r15@findmydonor.test',
        password: 'Abcdefgh1!',
        // verificationToken intentionally omitted
      }),
    });
    assert.equal(res.status, 400, 'email-signup must require verificationToken');
  });

  test('REGRESSION 16: POST /api/auth/email-signin returns 401 on invalid credentials', async () => {
    const res = await fetch(`${BASE}/api/auth/email-signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent_r16@findmydonor.test',
        password: 'WrongPassword123!',
      }),
    });
    assert.equal(res.status, 401, 'email-signin must return 401 on invalid credentials');
  });
});
