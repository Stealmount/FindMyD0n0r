// Wipes the fmdt:* Upstash namespace once before a test invocation so runs are
// hermetic while preserving cross-file fixture visibility within a single run.
// Wired as the "pretest" npm hook. Best-effort: exits 0 without Upstash creds.
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';
process.env.UPSTASH_KEY_PREFIX = 'fmdt:';

try {
  await import('dotenv/config');
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { getUpstash, k } = await import('../src/lib/upstash');
    const redis = getUpstash();
    let cursor = '0';
    let deleted = 0;
    do {
      const [next, keys] = (await redis.scan(cursor, { match: k('*'), count: 500 })) as [string, string[]];
      cursor = next;
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');
    console.log(`[pretest] flushed ${deleted} fmdt:* key(s)`);
  } else {
    console.log('[pretest] no Upstash creds — skipping store flush');
  }
} catch (err) {
  console.warn('[pretest] store flush skipped:', (err as Error)?.message || err);
}
