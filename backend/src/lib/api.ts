import { auth } from './firebase';

export async function authenticatedApi<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  let token = '';
  if (auth) {
    // Backend firebase admin auth doesn't have currentUser like client SDK
    // This is for server-side API calls, typically use service account
    token = '';
  }

  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request failed. Please try again.');
  return payload as T;
}
