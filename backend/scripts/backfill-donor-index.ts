// Idempotent backfill: rebuilds donor index SETs (s:dprof:pin:<pin>,
// s:dprof:bg:<bg>) from donor_profiles rows and creates placeholder
// donor_profiles rows for legacy donor users missing them. Fixes the index
// coverage gap where eligible donors are invisible to the pincode index scan
// (matchingEngine.findEligibleDonorsFromDB).
//
// SADD is idempotent; saveDoc is merge-safe. Safe to re-run.
//
// Usage:
//   DRY_RUN=1 npx tsx backend/scripts/backfill-donor-index.ts   # preview only
//   npx tsx backend/scripts/backfill-donor-index.ts              # apply

await import('dotenv/config');

const DRY_RUN = process.env.DRY_RUN === '1';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.log('[backfill-donor-index] no Upstash creds — nothing to do');
  process.exit(0);
}

const { getCollection, saveDoc } = await import('../src/lib/serverDb');
const { getUpstash, k } = await import('../src/lib/upstash');
const { cacheInvalidatePrefix } = await import('../src/lib/redisCache');

const stringOrNull = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return s ? s : null;
};
const pinOf = (doc: any): string | null => stringOrNull(doc?.pincode ?? doc?.donor_profile?.pincode);
const bgOf = (doc: any): string | null => stringOrNull(doc?.blood_group ?? doc?.donor_profile?.blood_group);

try {
  const profiles = await getCollection<any>('donor_profiles');
  const existingIds = new Set(profiles.map((p) => p.id).filter(Boolean));

  // Rebuild index SETs from donor_profiles rows (mirror store.ts applyIndexWrites).
  const pinWrites = new Map<string, string[]>();
  const bgWrites = new Map<string, string[]>();
  for (const p of profiles) {
    if (!p?.id) continue;
    const pin = pinOf(p);
    if (pin) {
      const arr = pinWrites.get(pin) ?? [];
      arr.push(p.id);
      pinWrites.set(pin, arr);
    }
    const bg = bgOf(p);
    if (bg) {
      const arr = bgWrites.get(bg) ?? [];
      arr.push(bg);
      bgWrites.set(bg, arr);
    }
  }

  const redis = getUpstash();
  const pipe = redis.pipeline();
  for (const [pin, ids] of pinWrites) for (const id of ids) pipe.sadd(k(`s:dprof:pin:${pin}`), id);
  for (const [bg, ids] of bgWrites) for (const id of ids) pipe.sadd(k(`s:dprof:bg:${bg}`), id);
  if (!DRY_RUN) await pipe.exec();

  console.log(
    `[backfill-donor-index] ${DRY_RUN ? 'DRY RUN — would index' : 'indexed'} ` +
    `${profiles.length} donor_profiles row(s) → ${pinWrites.size} pincode set(s), ${bgWrites.size} blood-group set(s)`
  );

  // Legacy donor users without a donor_profiles row → create placeholder so the
  // index path (and its pincode SETs) covers them too.
  const users = await getCollection<any>('users');
  let created = 0;
  for (const u of users) {
    if (!u?.id || existingIds.has(u.id)) continue;
    const looksLikeDonor =
      u.account_status === 'active' &&
      (u.can_donate === true || (u.blood_type && u.pincode));
    if (!looksLikeDonor) continue;
    const pin = pinOf(u);
    const bg = bgOf(u);
    if (!pin && !bg) continue;
    if (DRY_RUN) {
      console.log(`  would create donor_profiles for ${u.id}`);
      created++;
      continue;
    }
    await saveDoc('donor_profiles', u.id, {
      profile_id: u.id,
      blood_group: bg ?? undefined,
      pincode: pin ?? undefined,
      is_available: u.availability_status !== 'unavailable' && u.is_available !== false,
      profile_complete: u.profile_complete !== false,
      updated_at: new Date().toISOString(),
    });
    created++;
  }
  console.log(
    `[backfill-donor-index] ${DRY_RUN ? 'DRY RUN — would create' : 'created'} ` +
    `${created} placeholder donor_profiles row(s)`
  );

  if (!DRY_RUN) await cacheInvalidatePrefix('eligible_');
  console.log(`[backfill-donor-index] ${DRY_RUN ? 'dry run complete' : 'done — index rebuilt; eligible_ cache invalidated'}`);
} catch (err: any) {
  console.error('[backfill-donor-index] failed:', err?.message || err);
  process.exit(1);
}
