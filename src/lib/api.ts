import { auth } from './firebase';
import { resolveToken } from './authToken';
import { ApiError } from './errors';

// Backward-compatible re-export: existing callers import ApiError from './api'.
export { ApiError } from './errors';


export async function authenticatedApi<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  // Hard invariant: if there is no authenticated Firebase user, fail fast
  // locally instead of sending a deliberately headerless authenticated request.
  const token = await resolveToken(auth.currentUser);

  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error || payload.message || 'Request failed. Please try again.';
    throw new ApiError(message, response.status, payload.code, payload.details);
  }
  return payload as T;
}
