/**
 * Security baseline tests — CORS allowlist & security headers.
 *
 * These tests make real HTTP requests to the running dev server.
 * Start the server first:  npm run dev
 * Then run:                npx tsx --test tests/security.test.ts
 *
 * Uses Node's built-in node:test + node:assert — zero extra dependencies.
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { isOriginAllowed } from '../middleware/security';
import { sanitizeErrorMessage, AppError, ValidationError, UnauthorizedError } from '../helpers/errors';

const BASE = process.env.TEST_BASE_URL || 'https://findmydonor.online';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchAPI(path: string, opts: RequestInit = {}) {
  return fetch(`${BASE}${path}`, { ...opts, redirect: 'manual' });
}

// ─── Unit tests for error sanitization contract ──────────────────────────────

describe('Error sanitization & structured contract unit tests', () => {
  test('Sanitizes database relation errors and leaks no internal tables', () => {
    const raw = 'relation "private_profiles" does not exist in schema "public"';
    const clean = sanitizeErrorMessage(raw, 'Database query failed.');
    assert.equal(clean, 'Database query failed.');
    assert.equal(clean.includes('private_profiles'), false);
  });

  test('Sanitizes SQL injection/syntax error messages', () => {
    const raw = 'syntax error at or near "SELECT" line 1';
    const clean = sanitizeErrorMessage(raw, 'Operation failed.');
    assert.equal(clean, 'Operation failed.');
    assert.equal(clean.includes('SELECT'), false);
  });

  test('Sanitizes database connection strings containing credentials', () => {
    const raw = 'connection to postgres://admin:secret123@db.supabase.co:5432 failed';
    const clean = sanitizeErrorMessage(raw, 'Connection failed.');
    assert.equal(clean, 'Connection failed.');
    assert.equal(clean.includes('secret123'), false);
  });

  test('Preserves safe human-readable error messages', () => {
    assert.equal(sanitizeErrorMessage('Sign in is required.', 'An error occurred.'), 'Sign in is required.');
    assert.equal(sanitizeErrorMessage('Invalid OTP code provided. Please try again.', 'An error occurred.'), 'Invalid OTP code provided. Please try again.');
    assert.equal(sanitizeErrorMessage('Enter a valid 6-digit PIN code.', 'An error occurred.'), 'Enter a valid 6-digit PIN code.');
  });

  test('AppError creates structured error object with code and status', () => {
    const err = new ValidationError('Enter a valid email.');
    assert.equal(err.statusCode, 400);
    assert.equal(err.code, 'VALIDATION_ERROR');
    assert.equal(err.message, 'Enter a valid email.');
    assert.equal(err.isOperational, true);
  });
});

// ─── Unit tests for isOriginAllowed ───────────────────────────────────────

describe('isOriginAllowed unit tests', () => {
  test('Allows production domain https://findmydonor.online', () => {
    assert.equal(isOriginAllowed('https://findmydonor.online'), true);
    assert.equal(isOriginAllowed('https://www.findmydonor.online'), true);
  });

  test('Allows localhost origins for development', () => {
    assert.equal(isOriginAllowed('http://localhost:5173'), true);
    assert.equal(isOriginAllowed('http://localhost:5001'), true);
    assert.equal(isOriginAllowed('http://localhost:3000'), true);
    assert.equal(isOriginAllowed('http://127.0.0.1:5173'), true);
    assert.equal(isOriginAllowed('http://127.0.0.1:5001'), true);
  });

  test('Rejects wildcard origin (*)', () => {
    assert.equal(isOriginAllowed('*'), false);
  });

  test('Rejects spoofed domain origins', () => {
    assert.equal(isOriginAllowed('http://findmydonor.online.evil.com'), false);
    assert.equal(isOriginAllowed('http://evil.com/findmydonor.online'), false);
    assert.equal(isOriginAllowed('https://evil.example.com'), false);
  });

  test('Rejects empty or invalid origins', () => {
    assert.equal(isOriginAllowed(''), false);
    assert.equal(isOriginAllowed('not-a-url'), false);
  });
});

// ─── Security Headers ───────────────────────────────────────────────────────

describe('Security headers', () => {
  test('API responses include X-Content-Type-Options: nosniff', async () => {
    const res = await fetchAPI('/api/health');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  test('API responses include X-Frame-Options: DENY', async () => {
    const res = await fetchAPI('/api/health');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
  });

  test('API responses include Referrer-Policy', async () => {
    const res = await fetchAPI('/api/health');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  });

  test('API responses include Cross-Origin-Opener-Policy', async () => {
    const res = await fetchAPI('/api/health');
    assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin');
  });

  test('API responses include Content-Security-Policy', async () => {
    const res = await fetchAPI('/api/health');
    const csp = res.headers.get('content-security-policy');
    assert.ok(csp, 'CSP header should be present');
    assert.ok(csp!.includes("default-src 'self'"), 'CSP should restrict default-src');
    assert.ok(csp!.includes("frame-ancestors 'none'"), 'CSP should block framing');
  });

  test('API responses include Permissions-Policy', async () => {
    const res = await fetchAPI('/api/health');
    const pp = res.headers.get('permissions-policy');
    assert.ok(pp, 'Permissions-Policy header should be present');
    assert.ok(pp!.includes('camera=()'), 'Camera should be disabled');
    assert.ok(pp!.includes('microphone=()'), 'Microphone should be disabled');
  });
});

// ─── CORS Allowlist ─────────────────────────────────────────────────────────

describe('CORS allowlist', () => {
  test('Same-origin requests (no Origin header) are allowed', async () => {
    const res = await fetchAPI('/api/health');
    assert.equal(res.status, 200, 'Should return 200 for same-origin');
  });

  test('Approved origin receives Access-Control-Allow-Origin', async () => {
    const res = await fetchAPI('/api/health', {
      headers: { 'Origin': `https://findmydonor.online` },
    });
    assert.equal(res.status, 200);
    assert.equal(
      res.headers.get('access-control-allow-origin'),
      'https://findmydonor.online',
      'Should echo approved origin',
    );
    assert.equal(res.headers.get('vary'), 'Origin', 'Should set Vary: Origin');
  });

  test('Unapproved origin is rejected with 403', async () => {
    const res = await fetchAPI('/api/health', {
      headers: { 'Origin': 'https://evil.example.com' },
    });
    assert.equal(res.status, 403, 'Unapproved origin should be blocked');
    const body = await res.json() as { error?: string };
    assert.ok(body.error, 'Response should include error message');
  });

  test('Preflight OPTIONS for approved origin returns 204', async () => {
    const res = await fetchAPI('/api/health', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://findmydonor.online',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization,Content-Type',
      },
    });
    assert.equal(res.status, 204, 'Preflight should return 204');
    assert.equal(
      res.headers.get('access-control-allow-origin'),
      'https://findmydonor.online',
    );
    assert.ok(
      res.headers.get('access-control-allow-methods')?.includes('POST'),
      'Should allow POST',
    );
  });

  test('Preflight OPTIONS for unapproved origin is rejected', async () => {
    const res = await fetchAPI('/api/health', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://evil.example.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert.equal(res.status, 403, 'Unapproved preflight should be rejected');
  });
});

// ─── Auth guards on /api/send-email ─────────────────────────────────────────

describe('/api/send-email auth guard', () => {
  test('Unauthenticated request returns 401', async () => {
    const res = await fetchAPI('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'test@test.com', subject: 'Test', text: 'hi' }),
    });
    assert.equal(res.status, 401, 'Should reject unauthenticated request');
  });
});
