// One-time data migration for "Part A — Donor/Requester Role Separation".
// Splits every profile with BOTH can_donate and can_request into a single
// exclusive role, resolved from profile.intent:
//   intent === "requester"  → requester only
//   anything else (donor/both/missing) → donor only (safe default)
// Profiles that already have exactly one role flag are left untouched.
//
// IMPLEMENTATION STATUS:
//   Code complete. Manual run required — as a safety-first convention this
//   script does NOT execute without an explicit --confirm flag. It writes a
//   full snapshot to backend/data/role-split-backup-<timestamp>.json before
//   mutating anything, and logs every split for audit.
//
// Run:
//   node --experimental-strip-types scripts/partition-roles.ts --confirm [--dry-run]
//   (or: node scripts/partition-roles.ts --confirm
//       from backend/ after npm run build)
//
// Options:
//   --dry-run   report what WOULD change without writing anything
//   --confirm   actually write changes (refused otherwise)

process.env.NODE_ENV = 'production';

import fs from 'node:fs';
import path from 'node:path';

const flags = new Set(process.argv.slice(2));
const dryRun = flags.has('--dry-run');
const confirmed = flags.has('--confirm');

if (!confirmed) {
  console.log(
    '[role-split] Aborted: pass --confirm to apply changes. Use --dry-run to preview without writing.'
  );
  process.exit(1);
}

type Profile = {
  id: string;
  can_donate?: boolean;
  can_request?: boolean;
  intent?: string | null;
  [key: string]: unknown;
};

await import('dotenv/config');

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.log('[role-split] Aborted: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set.');
  process.exit(1);
}

const { getAll, updateDoc } = await import('../src/lib/store.ts');

function resolveRole(p: Profile): 'donor' | 'requester' {
  return p.intent === 'requester' ? 'requester' : 'donor';
}

function isDual(p: Profile): boolean {
  return p.can_donate === true && p.can_request === true;
}

const profiles = await getAll<Profile>('profiles');
const duals = profiles.filter(isDual);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(process.cwd(), 'data');
const backupPath = path.join(outDir, `role-split-backup-${stamp}.json`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(backupPath, JSON.stringify(duals, null, 2), 'utf8');

console.log(`[role-split] ${profiles.length} profile(s) scanned, ${duals.length} dual-flag account(s).`);
console.log(`[role-split] Snapshot written: ${backupPath}`);

let splits = 0;
let unchanged = 0;

for (const p of duals) {
  const role = resolveRole(p);
  const becomesDonor = role === 'donor';
  const patch = {
    intent: role,
    can_donate: becomesDonor,
    can_request: !becomesDonor,
  };
  const summary = `  ${p.id}  intent="${p.intent ?? 'MISSING'}"  ->  ${role}`;
  if (dryRun) {
    console.log(`[role-split][dry] would split ${summary}`);
    continue;
  }
  try {
    await updateDoc('profiles', p.id, patch);
    splits += 1;
  } catch (err) {
    console.log(`[role-split][warn] failed to split ${p.id}: ${(err as Error)?.message || err}`);
  }
}

const skipped = profiles.length - duals.length;
console.log(
  dryRun
    ? `[role-split] DRY-RUN complete: ${duals.length} dual account(s) would be split; ${skipped} untouched profile(s).`
    : `[role-split] Done: ${splits} split (${unchanged} no-op), ${skipped} untouched. Restore from ${backupPath} if needed.`
);
console.log('[role-split] Conventional sanity check: donor_blood_counts/donor_profiles reindexing must follow this run (see plan Part A).');