import { auth } from './firebase';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown[];

  constructor(message: string, status: number = 500, code?: string, details?: unknown[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export async function authenticatedApi<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  let token = '';
  if (auth.currentUser) {
    token = await auth.currentUser.getIdToken();
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
  if (!response.ok) {
    const message = payload.error || payload.message || 'Request failed. Please try again.';
    throw new ApiError(message, response.status, payload.code, payload.details);
  }
  return payload as T;
}
