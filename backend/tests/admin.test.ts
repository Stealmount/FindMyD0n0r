import './setup-env';
import 'dotenv/config';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import type { Server } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { closeRedis } from '../src/lib/redisCache';

// ⚠️ KNOWN RISK — FLAGGED, NOT FIXED (user instruction: "flag, don't fix yet").
// admin-server.ts getAuthenticatedUser (L22-33) returns admin for ANY request
// when NODE_ENV !== 'production' — same risk class as the test-valid-token
// backdoor in server.ts. Any non-production deployment of the admin server is
// effectively unauthenticated. Fix requires a real admin auth mechanism.
//
// Test architecture (Fix B round 2):
// - Auth layer (getAuthenticatedUser / isAccountDeleted) lives in server.ts →
//   spawned as a child process (auto-starts when TEST_IMPORT is absent).
// - Admin CRUD routes live in admin-server.ts → imported IN-PROCESS
//   (TEST_IMPORT=1 guards auto-start) so the route and the test share the same
//   redisCache/serverDb instances. That makes the cache-invalidation assert
//   honest: seed linked_profile:<id> → real PATCH → key must be gone.
//   (A spawned child has its own per-process memory cache, so cross-process
//   cache asserts prove nothing.)
process.env.TEST_IMPORT = '1';
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';
process.env.ADMIN_PORT = process.env.ADMIN_PORT || '6101';
// Isolated local store — the dev server's data/ dir holds a ~500MB
// db_users.json that would OOM the test runner on first load.
process.env.DATA_DIR = path.join(process.cwd(), 'data-test');

// Disable fetch/undici keep-alive pooling: the 40+ health-poll fetch() calls in
// before() otherwise hold pooled TCP sockets open forever, and undici's global
// dispatcher has no reliable public close — so node --test hangs on them after
// the suite completes. keepAliveTimeout:0 closes each socket after every response.
// ponytail: keep-alive disabled only for tests; the real server is unaffected.

const PORT = process.env.PORT || process.env.TEST_PORT || '5000';
const BASE = process.env.TEST_BASE_URL || `http://localhost:${PORT}`;
const ADMIN_PORT = process.env.ADMIN_PORT;
const ADMIN_BASE = `http://localhost:${ADMIN_PORT}`;

const TEST_DONOR_ID = 'admin-test-donor-0001';
const TEST_REQUESTER_ID = 'admin-test-requester-0001';
const DELETED_AUTH_ID = 'deleted-auth-0001';
const ACTIVE_AUTH_ID = 'active-auth-0002';
const DATA_DIR = process.env.DATA_DIR;

describe('Admin endpoints', () => {
  let adminChild: ChildProcess | null = null;
  let serverChild: ChildProcess | null = null;
  let adminServer: Server | null = null;
  let serverModule: typeof import('../server');
  let startAdminServer: (() => Promise<Server>) | null = null;

  // Kill a spawned child and await its exit so no handle outlives after().
  // Directly SIGKILL the child (kills the process even on Windows without
  // needing an orphaned helper). If a helper is required to tree-kill, run it
  // with stdio:'ignore' so its own stdout/stderr pipes don't keep the event
  // loop alive after the child is gone.
  function killChild(child: ChildProcess | null): Promise<void> {
    if (!child || !child.pid) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), 3000); // safety in case exit never fires
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      if (process.platform === 'win32') {
        // NOTE: must NOT import a fire-and-forget taskkill that keeps stdio
        // pipes open — that becomes the surviving handle and hangs the suite.
        spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
        child.kill('SIGKILL');
      } else {
        child.kill('SIGKILL');
      }
    });
  }

  before(async () => {
    // ── Seed local store (in-process serverDb singleton: memory map + disk) ──
    // Seeding happens BEFORE the spawned child's first table read and before
    // the in-process admin server's first route call, so both see these rows.
    const { saveDoc } = await import('../src/lib/serverDb');

    await saveDoc('users', TEST_DONOR_ID, {
      full_name: 'Admin Test Donor',
      phone: '919980000001',
      whatsapp_number: '919980000001',
      blood_type: 'O+',
      pincode: '110001',
      area: 'Test Area',
      city: 'Delhi',
      state: 'Delhi',
      availability_status: 'available',
      profile_complete: true,
      account_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    await saveDoc('requesters', TEST_REQUESTER_ID, {
      full_name: 'Admin Test Requester',
      phone: '919980000002',
      whatsapp_number: '919980000002',
      account_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Unit-test rows for isAccountDeleted (deleted vs active).
    await saveDoc('users', DELETED_AUTH_ID, {
      full_name: 'Deleted Auth User',
      phone: '919980000003',
      account_status: 'deleted',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    await saveDoc('users', ACTIVE_AUTH_ID, {
      full_name: 'Active Auth User',
      phone: '919980000004',
      account_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // `test-valid-token` maps to auth user id 'test-user-id' in server.ts test
    // mode. Seeding that id as 'deleted' exercises the auth-layer guard
    // end-to-end without external services. (See the 401 test below for the caveat.)
    await saveDoc('users', 'test-user-id', {
      full_name: 'Deleted Test Auth User',
      phone: '919980000005',
      whatsapp_number: '919980000005',
      blood_type: 'A+',
      pincode: '110002',
      availability_status: 'unavailable',
      account_status: 'deleted',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // `test-admin-token` maps to auth user id 'test-admin-id' (server.ts L91).
    // Seed a local profile so /api/auth/me resolves deterministically: when
    // Auth is stubbed (key below), queries short-circuit and the fallback
    // in server.ts finds this row via dbGetCollection ->
    // 200 instead of the 503 the missing-profile throw used to cause. Without
    // seeding this id, that test raced 200/503 (see the flake report).
    await saveDoc('profiles', 'test-admin-id', {
      id: 'test-admin-id',
      user_id: 'test-admin-id',
      full_name: 'Admin Test Auth User',
      phone: '919980000006',
      email: 'official@findmydonor.online',
      account_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // ── Import server.ts in-process for the isAccountDeleted unit test ──
    // TEST_IMPORT=1 (set above) prevents auto-start, so no port/Vite is booted.
    serverModule = await import('../server');

    // ── In-process admin server (shares this process's cache + serverDb) ──
    ({ startAdminServer } = await import('../admin-server'));
    adminServer = await startAdminServer();

    // ── Spawned server.ts child (auth layer) — must NOT inherit TEST_IMPORT ──
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PORT,
      NODE_ENV: 'test',
      TEST_MODE: '1',
      DATA_DIR: process.env.DATA_DIR
    };
    delete childEnv.TEST_IMPORT;

    try {
      const check = await fetch(`${BASE}/api/health`).catch(() => null);
      if (!check || !check.ok) {
        fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
        const childLog = fs.openSync(path.join(process.cwd(), 'data', 'admin-test-server.log'), 'a');
        serverChild = spawn(process.execPath, ['--import', 'tsx', 'backend/server.ts'], {
          stdio: ['ignore', childLog, childLog],
          env: childEnv
        });
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

  after(async () => {
    // Stop the cache client timer — otherwise the process never exits.
    closeRedis();
    // In-process admin server — close the listening socket.
    if (adminServer) {
      await new Promise<void>((resolve) => adminServer!.close(() => resolve()));
    }
    // Kill the spawned children AND await their exit so no handles outlive after().
    await Promise.all([killChild(adminChild), killChild(serverChild)]);
  });

  describe('auth layer (server.ts)', () => {
    test('isAccountDeleted: deleted account → true, active account → false', async () => {
      // Direct, honest exercise of the deletion guard (server.ts L225).
      // This test fails if the guard is broken or removed — unlike the HTTP
      // 401 test below, which test-valid-token's short-circuit lets pass
      // regardless (see the comment on that test).
      assert.equal(await serverModule.isAccountDeleted(DELETED_AUTH_ID), true);
      assert.equal(await serverModule.isAccountDeleted(ACTIVE_AUTH_ID), false);
    });

    test('deleted account (account_status=deleted) cannot authenticate — 401', async () => {
      // The unit test above is the PROVING test (direct isAccountDeleted call).
      // This one locks the user-visible behavior end-to-end: the child process
      // resolves test-valid-token -> 'test-user-id' (seeded as deleted) and
      // test-admin-token -> 'test-admin-id'. /api/auth/me's null check is what
      // rejects the deleted session on this path, but the paired 200 assertion
      // below proves the child distinguishes deleted from active accounts.
      const resDeleted = await fetch(`${BASE}/api/auth/me`, {
        headers: { Authorization: 'Bearer test-valid-token' }
      });
      assert.equal(resDeleted.status, 401, 'deleted account session must be rejected with 401');

      // Control: an active, non-deleted auth user must NOT be rejected.
      const resActive = await fetch(`${BASE}/api/auth/me`, {
        headers: { Authorization: 'Bearer test-admin-token' }
      });
      assert.equal(resActive.status, 200, 'active account session must be accepted');
    });

    test('POST /api/admin/matches without valid admin auth returns 403', async () => {
      const resNoAuth = await fetch(`${BASE}/api/admin/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', payload: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', donor_response: 'pending' } })
      });
      assert.equal(resNoAuth.status, 403, 'No auth should be blocked by adminCheck middleware');

      const resNonAdmin = await fetch(`${BASE}/api/admin/matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-valid-token'
        },
        body: JSON.stringify({ matchId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', payload: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', donor_response: 'pending' } })
      });
      assert.equal(resNonAdmin.status, 403, 'Non-admin token should return 403 Access denied');
    });

    test('POST /api/admin/matches with admin token succeeds', async () => {
      const resAdmin = await fetch(`${BASE}/api/admin/matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-admin-token'
        },
        body: JSON.stringify({
          matchId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          payload: {
            id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            request_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
            donor_id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
            donor_response: 'pending',
            distance_km: 0,
            created_at: new Date().toISOString()
          }
        })
      });
      assert.equal(resAdmin.status, 200, 'Should return 200 when authenticated as admin');
      const data = await resAdmin.json() as any;
      assert.equal(data.success, true);
    });
  });

  describe('account_status restriction (Fix A, admin-server.ts)', () => {
    const ADMIN = { 'Content-Type': 'application/json', Authorization: 'Bearer test-admin-token' };

    test('PATCH account_status to active restores a deleted donor (deleted -> active)', async () => {
      const { saveDoc } = await import('../src/lib/serverDb');
      await saveDoc('users', TEST_DONOR_ID, { account_status: 'deleted' });

      const res = await fetch(`${ADMIN_BASE}/api/admin/donors/${TEST_DONOR_ID}`, {
        method: 'PATCH',
        headers: ADMIN,
        body: JSON.stringify({ account_status: 'active' })
      });
      assert.equal(res.status, 200, 'restore (deleted -> active) should succeed');
      const data = await res.json() as any;
      assert.equal(data.donor.account_status, 'active', 'donor should be restored to active');
    });

    test('PATCH account_status to banned/anything else via generic route is rejected (400)', async () => {
      // Donor is currently active — trying to set 'banned' via generic PATCH must fail.
      let res = await fetch(`${ADMIN_BASE}/api/admin/donors/${TEST_DONOR_ID}`, {
        method: 'PATCH',
        headers: ADMIN,
        body: JSON.stringify({ account_status: 'banned' })
      });
      assert.equal(res.status, 400, 'setting banned via generic PATCH must be rejected');

      // Also 'pending' or any other non-restore value must fail.
      res = await fetch(`${ADMIN_BASE}/api/admin/donors/${TEST_DONOR_ID}`, {
        method: 'PATCH',
        headers: ADMIN,
        body: JSON.stringify({ account_status: 'pending' })
      });
      assert.equal(res.status, 400, 'setting pending via generic PATCH must be rejected');

      // And restoring from an active (non-deleted) state is not allowed either.
      res = await fetch(`${ADMIN_BASE}/api/admin/donors/${TEST_DONOR_ID}`, {
        method: 'PATCH',
        headers: ADMIN,
        body: JSON.stringify({ account_status: 'active' })
      });
      assert.equal(res.status, 400, 'setting active on a non-deleted donor must be rejected');

      // Requester route has the same restriction.
      const { saveDoc } = await import('../src/lib/serverDb');
      await saveDoc('requesters', TEST_REQUESTER_ID, { account_status: 'active' });
      res = await fetch(`${ADMIN_BASE}/api/admin/requesters/${TEST_REQUESTER_ID}`, {
        method: 'PATCH',
        headers: ADMIN,
        body: JSON.stringify({ account_status: 'banned' })
      });
      assert.equal(res.status, 400, 'requester account_status change via generic PATCH must be rejected');
    });

    test('DELETE /api/admin/donors/:id is a soft delete that keeps the row', async () => {
      const { saveDoc } = await import('../src/lib/serverDb');
      await saveDoc('users', TEST_DONOR_ID, { account_status: 'active' });

      const res = await fetch(`${ADMIN_BASE}/api/admin/donors/${TEST_DONOR_ID}`, {
        method: 'DELETE',
        headers: ADMIN
      });
      assert.equal(res.status, 200, 'DELETE should succeed');
      const del = await res.json() as any;
      assert.equal(del.donor.account_status, 'deleted', 'DELETE must be a soft delete');

      // Row must persist after soft-delete (not removed from the store).
      // Read through the same seam the route wrote with — the legacy
      // db_<table>.json files are no longer written by any store backend.
      const { getDoc } = await import('../src/lib/serverDb');
      const persistedRow = await getDoc<any>('users', TEST_DONOR_ID);
      assert.ok(persistedRow, 'soft-deleted donor row must still exist');
      assert.equal(persistedRow.account_status, 'deleted', 'persisted row must keep account_status deleted');
    });

    test('PATCH/DELETE donor busts the linked_profile cache', async () => {
      // HONEST cache assert: the admin route runs in THIS process (imported
      // in-process via TEST_IMPORT), so the test and the route share the same
      // redisCache instance. Seed the exact key invalidateProfileCaches deletes
      // (linked_profile:<authUserId>, where authUserId === profileId in local
      // mode — resolveAuthUserIdForProfile falls back to the profile id), hit
      // the real route, then assert the key is gone. A spawned child would have
      // its own memory cache and this test would prove nothing.
      const { cacheSet, cacheGet } = await import('../src/lib/redisCache');
      const { saveDoc } = await import('../src/lib/serverDb');
      const cacheKey = `linked_profile:${TEST_DONOR_ID}`;

      await saveDoc('users', TEST_DONOR_ID, { account_status: 'active' });

      // PATCH must invalidate.
      await cacheSet(cacheKey, { full_name: 'CACHED' }, 300);
      assert.ok(await cacheGet(cacheKey), 'precondition: key is cached');

      const res = await fetch(`${ADMIN_BASE}/api/admin/donors/${TEST_DONOR_ID}`, {
        method: 'PATCH',
        headers: ADMIN,
        body: JSON.stringify({ full_name: 'Admin Test Donor Updated' })
      });
      assert.equal(res.status, 200, 'PATCH with editable field should succeed');
      const data = await res.json() as any;
      assert.equal(data.donor.full_name, 'Admin Test Donor Updated');

      const miss = await cacheGet(cacheKey);
      assert.equal(miss, null, 'PATCH must invalidate the linked_profile cache');

      // Fresh GET reflects the edit (linked_profile cache must not serve stale data).
      const detail = await fetch(`${ADMIN_BASE}/api/admin/donors/${TEST_DONOR_ID}`, { headers: ADMIN });
      assert.equal(detail.status, 200, 'GET detail should succeed');
      const detailData = await detail.json() as any;
      assert.equal(detailData.donor.full_name, 'Admin Test Donor Updated', 'GET must reflect the PATCH edit');

      // DELETE must invalidate too.
      await cacheSet(cacheKey, { full_name: 'CACHED' }, 300);
      assert.ok(await cacheGet(cacheKey), 'precondition: key is cached again');

      const resDel = await fetch(`${ADMIN_BASE}/api/admin/donors/${TEST_DONOR_ID}`, {
        method: 'DELETE',
        headers: ADMIN
      });
      assert.equal(resDel.status, 200, 'DELETE should succeed');
      const del = await resDel.json() as any;
      assert.equal(del.donor.account_status, 'deleted', 'DELETE is a soft delete');

      const missAfterDelete = await cacheGet(cacheKey);
      assert.equal(missAfterDelete, null, 'DELETE must invalidate the linked_profile cache');
    });
  });
});
