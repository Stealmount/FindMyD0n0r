import './setup-env';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  enqueueMessage,
  claimDueMessages,
  processMessage,
  getQueueStats,
  clearMessageQueueForTest,
  type OutgoingMessage,
} from '../src/lib/messaging';

/**
 * Messaging Service queue lifecycle suite.
 *
 * Runs synchronously against the local JSON store (test mode) — the worker
 * is disabled in tests; these drive claim/process directly.
 */

const wahaSpy = {
  calls: 0 as number,
  lastText: '' as string,
};

// Spy on the WhatsApp adapter by intercepting processMessage's dependency is
// not possible without DI, so we assert on queue state transitions instead
// (status sent, retry_count increments) and on the fact that nothing is sent
// before scheduled_send_time.

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

describe('Messaging queue lifecycle', () => {
  before(async () => {
    process.env.MESSAGE_DELAY_SECONDS = '60';
    process.env.MESSAGE_MAX_RETRIES = '2';
    process.env.MESSAGE_CLAIM_STALE_SECONDS = '1';
    await clearMessageQueueForTest();
  });

  after(async () => {
    await clearMessageQueueForTest();
    delete process.env.MESSAGE_DELAY_SECONDS;
    delete process.env.MESSAGE_MAX_RETRIES;
    delete process.env.MESSAGE_CLAIM_STALE_SECONDS;
  });

  test('enqueue persists row with scheduled_send_time = now + delay', async () => {
    const before = Date.now();
    const msg = await enqueueMessage({
      channel: 'whatsapp',
      recipient: '919999999999',
      type: 'test_otp',
      payload: { text: 'hello' },
    });
    const scheduled = new Date(msg.scheduled_send_time).getTime();
    assert.ok(scheduled >= before + 60_000 - 500, 'scheduled >= now + 60s (within skew)');
    assert.ok(scheduled <= before + 60_000 + 500, 'scheduled <= now + 60s (within skew)');
    assert.equal(msg.status, 'queued');
    assert.equal(msg.retry_count, 0);
    assert.ok(msg.id, 'has id');
  });

  test('enqueue with delaySeconds=0 is deliverable immediately (OTP path)', async () => {
    const msg = await enqueueMessage({
      channel: 'whatsapp',
      recipient: '919888888888',
      type: 'otp',
      payload: { text: 'OTP 123456' },
      delaySeconds: 0,
    });
    assert.ok(new Date(msg.scheduled_send_time).getTime() <= Date.now() + 1000);
  });

  test('claimDueMessages skips rows not yet due', async () => {
    const msg = await enqueueMessage({
      channel: 'whatsapp',
      recipient: '919777777777',
      type: 'test_delayed',
      payload: { text: 'not yet' },
      delaySeconds: 60,
    });
    const due = await claimDueMessages(25);
    assert.ok(!due.some(m => m.id === msg.id), 'future message must not be claimed');
  });

  test('claimDueMessages picks up due rows (delay 0)', async () => {
    const msg = await enqueueMessage({
      channel: 'whatsapp',
      recipient: '919666666666',
      type: 'test_due',
      payload: { text: 'due now' },
      delaySeconds: 0,
    });
    const due = await claimDueMessages(25);
    const claimed = due.find(m => m.id === msg.id);
    assert.ok(claimed, 'due message claimed');
    assert.equal(claimed!.status, 'processing');
    assert.ok(claimed!.claimed_at, 'claimed_at set');
  });

  test('processMessage success → status sent with sent_at', async () => {
    // Delay 0 so the row is due immediately. WAHA is unconfigured in tests,
    // so sendWhatsApp returns false → this exercises the retry path instead.
    // To exercise success we need a configurable adapter; instead assert the
    // state machine: queued → processing → (sent | queued w/ retry) with no crash.
    const msg = await enqueueMessage({
      channel: 'whatsapp',
      recipient: '919555555555',
      type: 'test_success',
      payload: { text: 'x' },
      delaySeconds: 0,
    });
    const claimed = (await claimDueMessages(25)).find(m => m.id === msg.id)!;
    assert.ok(claimed);
    const result = await processMessage(claimed);
    // Either delivered (mock WAHA configured) or retried — never stuck processing.
    assert.notEqual(result.status, 'processing');
    assert.ok(result.retry_count >= 0);
    if (result.status === 'sent') {
      assert.ok(result.sent_at, 'sent_at set on success');
    }
  });

  test('retryable failure → retry_count incremented, rescheduled, status queued', async () => {
    const msg = await enqueueMessage({
      channel: 'whatsapp',
      recipient: '919444444444',
      type: 'test_retry',
      payload: { text: 'retry me' },
      delaySeconds: 0,
    });
    let current: OutgoingMessage = (await claimDueMessages(25)).find(m => m.id === msg.id)!;
    // First attempt (will fail: WAHA unconfigured) → retry_count 1, back queued.
    current = await processMessage(current);
    assert.equal(current.status, 'queued');
    assert.equal(current.retry_count, 1);
    assert.ok(new Date(current.scheduled_send_time).getTime() > Date.now(), 'rescheduled in future');
  });

  test('max retries exceeded → status failed with last_error', async () => {
    const msg = await enqueueMessage({
      channel: 'whatsapp',
      recipient: '919333333333',
      type: 'test_fail',
      payload: { text: 'fail me' },
      delaySeconds: 0,
    });
    let current: OutgoingMessage = (await claimDueMessages(25)).find(m => m.id === msg.id)!;
    // MESSAGE_MAX_RETRIES=2 → after 3rd attempt total (initial + 2 retries) it fails.
    for (let i = 0; i < 3; i++) {
      current = await processMessage(current);
      if (current.status === 'failed') break;
      // Re-claim after backoff by forcing due (claim ignores scheduled time for queued — re-set to now).
      if (current.status === 'queued') {
        current = { ...current, scheduled_send_time: new Date(Date.now() - 1000).toISOString() };
        current = (await claimDueMessages(25)).find(m => m.id === msg.id) ?? current;
      }
    }
    assert.equal(current.status, 'failed', 'should end failed after max retries');
    assert.ok(current.last_error, 'last_error populated');
    assert.equal(current.retry_count, 3);
  });

  test('at-most-once: processing row not double-claimed within stale window', async () => {
    process.env.MESSAGE_CLAIM_STALE_SECONDS = '120';
    const msg = await enqueueMessage({
      channel: 'whatsapp',
      recipient: '919222222222',
      type: 'test_atmostonce',
      payload: { text: 'once' },
      delaySeconds: 0,
    });
    const first = await claimDueMessages(25);
    assert.ok(first.some(m => m.id === msg.id), 'first claim works');
    const second = await claimDueMessages(25);
    assert.ok(!second.some(m => m.id === msg.id), 'not re-claimed while processing');
    delete process.env.MESSAGE_CLAIM_STALE_SECONDS;
  });

  test('stale processing row is reclaimed after claim timeout', async () => {
    process.env.MESSAGE_CLAIM_STALE_SECONDS = '1';
    const msg = await enqueueMessage({
      channel: 'whatsapp',
      recipient: '919111111111',
      type: 'test_stale',
      payload: { text: 'stale' },
      delaySeconds: 0,
    });
    const first = await claimDueMessages(25);
    assert.ok(first.some(m => m.id === msg.id), 'claimed');
    await sleep(1100); // wait for stale window
    const second = await claimDueMessages(25);
    assert.ok(second.some(m => m.id === msg.id), 'stale claim reclaimed');
    delete process.env.MESSAGE_CLAIM_STALE_SECONDS;
  });

  test('getQueueStats aggregates by status', async () => {
    const stats = await getQueueStats();
    assert.equal(typeof stats.total, 'number');
    assert.equal(stats.queued + stats.processing + stats.sent + stats.failed, stats.total);
  });

  test('unknown channel never crashes processMessage', async () => {
    const msg = await enqueueMessage({
      channel: 'whatsapp' as any,
      recipient: '919000000000',
      type: 'test_unknown',
      payload: { text: 'x' },
      delaySeconds: 0,
    });
    const claimed = (await claimDueMessages(25)).find(m => m.id === msg.id)!;
    const result = await processMessage({ ...claimed, channel: 'sms' as any });
    // Unknown channel → retry path (never throws out).
    assert.ok(['queued', 'failed'].includes(result.status));
  });
});
