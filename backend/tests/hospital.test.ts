import './setup-env';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';

const PORT = process.env.TEST_PORT || '5003';
const BASE = process.env.TEST_BASE_URL || `http://localhost:${PORT}`;

describe('Hospital dashboard endpoint (/api/hospital/dashboard)', () => {
  let child: ChildProcess | null = null;

  before(async () => {
    try {
      const check = await fetch(`${BASE}/api/health`).catch(() => null);
      if (!check || !check.ok) {
        child = spawn(process.execPath, ['--import', 'tsx', 'backend/server.ts'], { stdio: 'pipe', env: { ...process.env, PORT, NODE_ENV: 'test' } });
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 500));
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
        spawn('taskkill', ['/pid', String(child.pid), '/t', '/f']);
      } else {
        child.kill();
      }
    }
  });

  test('GET /api/hospital/dashboard without valid Authorization header returns 401', async () => {
    const res = await fetch(`${BASE}/api/hospital/dashboard`);
    assert.equal(res.status, 401, 'Unauthenticated request should return 401 Unauthorized');

    const resBadToken = await fetch(`${BASE}/api/hospital/dashboard`, {
      headers: { Authorization: 'Bearer invalid-token-for-test' }
    });
    assert.equal(resBadToken.status, 401, 'Invalid token should return 401 Unauthorized');
  });

  test('GET /api/hospital/dashboard with valid auth masks donor contact info unless donor_response is approved', async () => {
    const res = await fetch(`${BASE}/api/hospital/dashboard`, {
      headers: { Authorization: 'Bearer test-valid-token' }
    });
    assert.equal(res.status, 200, 'Should return 200 OK when authenticated');
    const data = await res.json() as any;

    assert.ok(Array.isArray(data.requests), 'Should return requests array');
    assert.ok(Array.isArray(data.matches), 'Should return matches array');
    assert.ok(Array.isArray(data.users) || Array.isArray(data.donors), 'Should return users/donors array');

    const donors: any[] = data.users || data.donors || [];
    const approvedDonorIds = new Set(
      data.matches.filter((m: any) => m.donor_response === 'approved').map((m: any) => m.donor_id)
    );

    for (const donor of donors) {
      if (!approvedDonorIds.has(donor.id)) {
        assert.equal(donor.phone, undefined, `Donor ${donor.id} phone must be stripped when not approved`);
        assert.equal(donor.whatsapp_number, undefined, `Donor ${donor.id} whatsapp_number must be stripped when not approved`);
      }
    }
  });
});
