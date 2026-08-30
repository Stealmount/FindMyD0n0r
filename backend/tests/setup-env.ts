import 'dotenv/config'; // Load .env first: serverDb must see Upstash config at seed time
// Test environment setup — imported first by test files.
// Store isolation is handled once per invocation by the "pretest" npm hook
// (backend/scripts/flush-test-store.ts), NOT here: per-file wipes would break
// suites that depend on fixtures created by earlier files in the same run.
// Load .env first: serverDb must see Upstash config at seed time, else seeds
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';
// Namespace Upstash keys for spawned test servers so they can never touch
// production keys. Trailing ":" matters: k() concatenates directly.
process.env.UPSTASH_KEY_PREFIX = 'fmdt:';
// Test backdoor identity must pass the ADMIN_EMAILS allowlist regardless of
// local .env drift (dotenv never overrides existing vars).
process.env.ADMIN_EMAILS = 'admin@findmydonor.online';
