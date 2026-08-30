import './setup-env';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';

const PORT = process.env.TEST_PORT || '5002';
const BASE = process.env.TEST_BASE_URL || `http://localhost:${PORT}`;

describe('Simulator data endpoint (/api/simulator/data)', () => {
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

  test('GET /api/simulator/data returns capped notifications without PII', async () => {
    const res = await fetch(`${BASE}/api/simulator/data`);
    assert.equal(res.status, 200, 'Should return 200 OK');
    const data = await res.json() as any;
    
    assert.ok(Array.isArray(data.notifications), 'Should return notifications array');
    assert.ok(data.notifications.length <= 20, 'Notifications should be capped at 20');

    assert.ok(Array.isArray(data.donors), 'Should return donors array');
    for (const donor of data.donors) {
      assert.equal(donor.phone, undefined, 'donor.phone must be stripped');
      assert.equal(donor.email, undefined, 'donor.email must be stripped');
      assert.equal(donor.whatsapp_number, undefined, 'donor.whatsapp_number must be stripped');
      assert.equal(donor.pincode, undefined, 'donor.pincode must be stripped');
    }

    assert.ok(Array.isArray(data.requests), 'Should return requests array');
    for (const req of data.requests) {
      assert.equal(req.requester_phone, undefined, 'requester_phone must be stripped');
      assert.equal(req.requester_email, undefined, 'requester_email must be stripped');
    }
  });
});
