// Regression tests for the production auth race:
// AuthContext can resolve /api/auth/me (profile:null) before
// complete-verification provisions the application profile. A profile:null
// result must NEVER permanently mark the Firebase UID as resolved — otherwise
// the same UID can never resolve again after provisioning.
//
// Run: npx tsx --test src/lib/__tests__/authSession.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginResolution, isCurrentResponse, isResolvableMe } from '../authSession';
import type { Rev3Me } from '../rev3Auth';

function me(overrides: Partial<Rev3Me> = {}): Rev3Me {
  return {
    authUser: { id: 'uid-1', email: 'a@b.c', provider: 'google.com' },
    profile: null,
    donorProfile: null,
    institution: null,
    nextStep: 'basic',
    ...overrides,
  };
}

test('A: profile:null /me is NOT resolvable (pre-provisioning)', () => {
  assert.equal(isResolvableMe(me()), false);
});

test('B+C: after complete-verification, /me with a donor intent profile is resolvable', () => {
  const resolved = me({
    profile: { intent: 'donor', can_donate: true } as Rev3Me['profile'],
  });
  assert.equal(isResolvableMe(resolved), true);
});

test('B+C: requester intent profile is resolvable', () => {
  const resolved = me({
    profile: { intent: 'requester', can_request: true } as Rev3Me['profile'],
  });
  assert.equal(isResolvableMe(resolved), true);
});

test('D: a stale earlier response cannot overwrite a newer resolution', () => {
  // seq 5 started later than the stale seq 3 response → dropped.
  assert.equal(isCurrentResponse(5, 3), false);
  // the newest request is the only one allowed to write state.
  assert.equal(isCurrentResponse(5, 5), true);
});

test('E: an unresolved (profile:null) UID can begin resolution again', () => {
  // resolvedUid=null means the uid was never fully resolved → re-resolution allowed.
  const first = beginResolution(0, null, 'uid-1', false);
  assert.equal(first.proceeded, true);
  assert.equal(first.seq, 1);
  // Same uid, still unresolved (profile:null never marked it) → proceeds again.
  const second = beginResolution(1, null, 'uid-1', false);
  assert.equal(second.proceeded, true);
  assert.equal(second.seq, 2);
  // After a resolvable outcome marks resolvedUid=uid, a duplicate is skipped.
  const dup = beginResolution(2, 'uid-1', 'uid-1', false);
  assert.equal(dup.proceeded, false);
  // forceRefresh always proceeds (used by refreshSession after provisioning).
  const forced = beginResolution(2, 'uid-1', 'uid-1', true);
  assert.equal(forced.proceeded, true);
});
