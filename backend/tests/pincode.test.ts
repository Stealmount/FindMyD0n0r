// Pincode tests — Phase 1 (auth redesign, Rev 3). Unit tests for the
// cache + external-API + fallback resolution. No child server, no network:
// global.fetch is stubbed.
import 'dotenv/config';
import './setup-env';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePincode } from '../routes/pincode';
import { cacheDel, closeRedis } from '../src/lib/redisCache';

const REAL_FETCH = globalThis.fetch;
type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

let handler: FetchHandler | null = null;
before(() => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (handler) return handler(input, init);
    throw new Error('No fetch handler installed');
  }) as typeof fetch;
});
after(async () => {
  globalThis.fetch = REAL_FETCH;
  await cacheDel('pincode:110001');
  await cacheDel('pincode:560001');
  closeRedis();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('resolvePincode hits the external API and returns source:api', async () => {
  handler = () =>
    Promise.resolve(
      jsonResponse([
        {
          Status: 'Success',
          PostOffice: [
            { Name: 'Connaught Place SO', District: 'New Delhi', State: 'DELHI', Division: 'New Delhi' },
          ],
        },
      ])
    );
  const r = await resolvePincode('110001');
  assert.equal(r.source, 'api');
  assert.equal(r.district, 'New Delhi');
  assert.equal(r.state, 'DELHI');
  assert.ok(r.area);
});

test('unknown PIN returns source:none (not a throw)', async () => {
  handler = () => Promise.resolve(jsonResponse([{ Status: 'Error', PostOffice: null }]));
  const r = await resolvePincode('999999');
  assert.equal(r.source, 'none');
  assert.equal(r.city, null);
});

test('network failure falls back to source:none (onboarding never blocks)', async () => {
  handler = () => Promise.reject(new Error('ECONNRESET'));
  const r = await resolvePincode('400001');
  assert.equal(r.source, 'none');
});

test('second call returns from cache with source:cache', async () => {
  let calls = 0;
  handler = () => {
    calls++;
    return Promise.resolve(
      jsonResponse([
        { Status: 'Success', PostOffice: [{ Name: 'MG Road SO', District: 'Bengaluru', State: 'KARNATAKA', Division: 'Bengaluru' }] },
      ])
    );
  };
  await resolvePincode('560001'); // warms cache
  const cached = await resolvePincode('560001'); // served from cache
  assert.equal(cached.source, 'cache');
  assert.equal(cached.district, 'Bengaluru');
  // Only ONE network call — the second came from cache.
  assert.equal(calls, 1);
});

test('invalid PIN (non-6-digit) resolves to source:none (normalized)', async () => {
  handler = () => Promise.resolve(jsonResponse([{ Status: 'Error' }]));
  const r = await resolvePincode('123');
  assert.equal(r.source, 'none');
});
