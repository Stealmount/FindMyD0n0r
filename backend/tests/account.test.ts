// Account deletion endpoint tests (Section 9)
// Uses Node's built-in node:test + fetch — zero extra dependencies, matching
// sibling suites. Spawns the real server as a child and asserts auth guards.
import './setup-env';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Resolve the server entry relative to this file so the test works from any cwd.
const SERVER_PATH = fileURLToPath(new URL('../server.ts', import.meta.url));

const PORT = process.env.TEST_PORT || '5011';
const BASE = `http://127.0.0.1:${PORT}`;

describe('Account Deletion Endpoint (POST /api/account/delete)', () => {
  let child: ChildProcess | null = null;

  before(async () => {
    child = spawn(process.execPath, ['--import', 'tsx', SERVER_PATH], {
      stdio: 'pipe',
      env: {
        ...process.env,
        PORT,
        NODE_ENV: 'test',
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

  test('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${BASE}/api/account/delete`, { method: 'POST' });
    assert.equal(res.status, 401, 'Should return 401 when unauthenticated');
  });

  test('rejects admin tokens (admin accounts cannot self-delete)', async () => {
    const res = await fetch(`${BASE}/api/account/delete`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test-admin-token' }
    });
    assert.equal(res.status, 401, 'Admin identities must be rejected with 401');
  });
});
