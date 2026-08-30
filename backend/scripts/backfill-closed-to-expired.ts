// Run-once backfill: converts legacy terminal rows `status === "closed"`
// (written by sweepWorker before the Phase 3 unification) to `status === "expired"`.
//
// Idempotent: only touches rows whose status is exactly "closed". Safe to run
// repeatedly — after the first run there is nothing left to convert.
//
// Usage:
//   DRY_RUN=1 npx tsx backend/scripts/backfill-closed-to-expired.ts   # preview only
//   npx tsx backend/scripts/backfill-closed-to-expired.ts              # apply

await import('dotenv/config');

const DRY_RUN = process.env.DRY_RUN === '1';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.log('[backfill-closed-to-expired] no Upstash creds — nothing to do');
  process.exit(0);
}

const { getCollection, saveDoc } = await import('../src/lib/serverDb');
const { nowISO } = await import('../helpers/time');
const typeModule = await import('../src/types');
const { TERMINAL_REQUEST_STATUSES } = await import('../services/matchingEngine');

type Row = { id: string; status: string; tracking_code?: string; updated_at?: string };

try {
  const all = await getCollection<Row>('blood_requests');
  const closed = all.filter((r) => r.status === 'closed');
  if (closed.length === 0) {
    console.log(`[backfill-closed-to-expired] no "closed" rows — already clean (${all.length} requests scanned)`);
    process.exit(0);
  }
  console.log(
    `[backfill-closed-to-expired] ${DRY_RUN ? 'DRY RUN — would update' : 'updating'} ${closed.length} row(s) ` +
    `we're converting closed -> expired; terminal ordinal set = ${TERMINAL_REQUEST_STATUSES.join(', ')}`
  );
  for (const row of closed) {
    if (DRY_RUN) {
      console.log(`  would update ${row.id} (${row.tracking_code || 'no-code'})`);
    } else {
      await saveDoc('blood_requests', row.id, {
        ...row,
        status: 'expired',
        updated_at: nowISO(),
      } as unknown as Record<string, unknown>);
      console.log(`  updated ${row.id} (${row.tracking_code || 'no-code'})`);
    }
  }
  console.log(`[backfill-closed-to-expired] ${DRY_RUN ? 'dry run complete' : `done — ${closed.length} row(s) migrated`}`);
} catch (err: any) {
  console.error('[backfill-closed-to-expired] failed:', err?.message || err);
  process.exit(1);
}