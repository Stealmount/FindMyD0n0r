/**
 * WhatsApp destination safety regression test (Step 4.1).
 *
 * PRODUCT RULE: Only donor.whatsapp_number / profiles.whatsapp_phone may be used
 * as a WhatsApp destination. A phone number must NEVER be used for WhatsApp
 * delivery, and donors without a WhatsApp number must be skipped safely.
 *
 * Run:
 *   npx tsx --test backend/tests/whatsapp-safety.test.ts
 */
import './setup-env.ts';

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sendDonorWhatsApp } from '../src/lib/waha.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('sendDonorWhatsApp destination safety', () => {
  test('CASE 1: whatsapp present + different phone → uses whatsapp branch (no skip)', async () => {
    const donor: any = { id: 'd1', full_name: 'Don', whatsapp_number: '919999000001', phone: '918888000001' };
    const warns: string[] = [];
    const origWarn = console.warn;
    console.warn = (m?: any) => { warns.push(String(m)); };
    try {
      const result = await sendDonorWhatsApp(donor, 'hello');
      assert.equal(typeof result, 'boolean');
      assert.ok(!warns.some((w) => w.includes('no WhatsApp number')), 'should not warn about missing WhatsApp when whatsapp_number is present');
    } finally {
      console.warn = origWarn;
    }
  });

  test('CASE 2: whatsapp NULL + valid phone → sendWhatsApp must NOT be called (skip branch)', async () => {
    const donor: any = { id: 'd2', full_name: 'Don', whatsapp_number: '', phone: '918888000002' };
    const warns: string[] = [];
    const origWarn = console.warn;
    console.warn = (m?: any) => { warns.push(String(m)); };
    try {
      const result = await sendDonorWhatsApp(donor, 'hello');
      assert.equal(result, false);
      assert.ok(warns.some((w) => w.includes('no WhatsApp number')), 'should warn about missing WhatsApp');
    } finally {
      console.warn = origWarn;
    }
  });

  test('CASE 3: whatsapp empty string + valid phone → skipped', async () => {
    const donor: any = { id: 'd3', full_name: 'Don', whatsapp_number: '', phone: '918888000003' };
    const result = await sendDonorWhatsApp(donor, 'hello');
    assert.equal(result, false);
  });

  test('CASE 4: whatsapp NULL + phone NULL → no crash', async () => {
    const donor: any = { id: 'd4', full_name: 'Don', whatsapp_number: undefined, phone: undefined };
    const result = await sendDonorWhatsApp(donor, 'hello');
    assert.equal(result, false);
  });
});

describe('No backend WhatsApp path falls back to donor.phone', () => {
  const unsafePattern = /whatsapp_number\s*\|\|\s*donor\.phone/;
  const files = [
    '../services/matchingEngine.ts',
    '../routes/notifications.ts',
    '../routes/matching.ts',
    '../src/lib/waha.ts',
  ];

  for (const rel of files) {
    test(`No unsafe fallback in ${rel}`, () => {
      const src = readFileSync(join(__dirname, rel), 'utf8');
      assert.ok(
        !unsafePattern.test(src),
        `${rel} still contains an unsafe whatsapp_number || donor.phone fallback`
      );
    });
  }
});
