// Auth session-resolution helpers (pure, unit-testable).
// Isolates the production race where AuthContext resolves /api/auth/me
// (profile:null) before complete-verification provisions the profile.
// A profile:null result must NEVER permanently mark a Firebase UID as resolved.
import type { Rev3Me } from './rev3Auth';

export interface AuthResolution {
  seq: number;
  proceeded: boolean;
}

/**
 * Decide whether a resolution should begin for a UID.
 * - same uid already fully resolved and not forcing → skip.
 * - otherwise bump the sequence so any in-flight OLDER response (lower seq)
 *   is later ignored and can never overwrite a newer resolution.
 */
export function beginResolution(
  currentSeq: number,
  resolvedUid: string | null,
  uid: string,
  forceRefresh: boolean
): AuthResolution {
  if (!forceRefresh && resolvedUid === uid) {
    return { seq: currentSeq, proceeded: false };
  }
  return { seq: currentSeq + 1, proceeded: true };
}

/** A response may write auth state only if it is the newest initiated request. */
export function isCurrentResponse(currentSeq: number, requestSeq: number): boolean {
  return requestSeq === currentSeq;
}

// Mirrors the donor/requester predicates in rev3Auth.toLegacy() so the
// resolvability decision stays authoritative without dragging firebase into
// this pure module. ponytail: if toLegacy's role predicates change, update
// this predicate to match.
function hasRole(me: Rev3Me): boolean {
  if (me.institution) return true;
  const intent = me.profile?.intent;
  const isDonor = intent ? intent === 'donor' : !!me.profile?.can_donate;
  const isRequester = intent
    ? intent === 'requester'
    : !!me.profile?.can_request && !me.profile?.can_donate;
  return isDonor || isRequester;
}

/**
 * A UID is only "fully resolved" once /me yields a real application identity
 * (donor / requester / institution). A pre-provisioning profile:null must not
 * count as resolved, or the same UID could never resolve again.
 */
export function isResolvableMe(me: Rev3Me | null | undefined): boolean {
  if (!me) return false;
  return hasRole(me);
}
