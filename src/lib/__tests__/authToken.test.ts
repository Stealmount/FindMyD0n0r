// Regression test for the production auth bug: GET /api/auth/me must NEVER be
// sent without an Authorization header. resolveToken() is the single gate that
// makes a missing Firebase user fail fast locally (before any network request).
//
// Note: authenticatedApi() (api.ts) awaits `resolveToken(auth.currentUser)`
// before its single fetch() call, so a missing user — which makes resolveToken
// reject below — structurally can never reach fetch. Since resolveToken(null)
// rejects with a 401 ApiError here, the headerless request path is impossible.
//
// Run: npx tsx --test src/lib/__tests__/authToken.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveToken } from '../authToken';
import { ApiError } from '../errors';

function okUser(token: string): { getIdToken: () => Promise<string> } {
  return { getIdToken: () => Promise.resolve(token) };
}

test('resolveToken(null) rejects with a 401 UNAUTHORIZED ApiError', async () => {
  await assert.rejects(
    resolveToken(null),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 401);
      assert.equal(err.code, 'UNAUTHORIZED');
      return true;
    },
    'missing Firebase user must fail fast with UNAUTHORIZED'
  );
});

test('resolveToken(valid user) returns the exact Firebase ID token', async () => {
  const TOKEN = 'firebase-abc.def.ghi';
  const token = await resolveToken(okUser(TOKEN));
  assert.equal(token, TOKEN, 'the exact getIdToken result must be used');
});

test('getIdToken() rejection propagates as an error, never an empty token', async () => {
  const boom = new Error('token minting failed');
  const failingUser = { getIdToken: () => Promise.reject(boom) };
  await assert.rejects(resolveToken(failingUser), (err: unknown) => {
    assert.equal(err, boom);
    return true;
  });
});
