// Dependency-neutral token-resolution gate.
// Single source of truth for "no authenticated Firebase user ⇒ no authenticated
// API request". Imports ApiError only from the neutral ./errors module so there
// is no import cycle between api.ts and authToken.ts.
import { ApiError } from './errors';

/**
 * Resolve the current Firebase ID token, or fail fast (locally, before any
 * network request) if there is no authenticated Firebase user.
 *
 * This is the ONLY place the authenticated-request invariant is implemented:
 * a missing user throws immediately, so callers never send a deliberately
 * headerless authenticated request.
 */
export async function resolveToken(user: {
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
} | null): Promise<string> {
  if (!user) {
    throw new ApiError('Sign in is required.', 401, 'UNAUTHORIZED');
  }
  return user.getIdToken(false);
}
