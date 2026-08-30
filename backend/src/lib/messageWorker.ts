/**
 * Message delivery worker — the ONLY place that touches provider adapters.
 *
 * Polls the queue every MESSAGE_POLL_INTERVAL_MS (default 5s), claims due
 * messages, and delivers each through the Messaging Service. Started from
 * server.ts bootstrap. Disabled in test mode — tests drive the queue
 * synchronously.
 */

import { claimDueMessages, processMessage, pruneTerminalMessages } from "./messaging";

let started = false;
let timer: NodeJS.Timeout | null = null;
let sweepCount = 0;

function isTestMode(): boolean {
  return process.env.NODE_ENV === "test" || process.env.TEST_MODE === "1";
}

function pollIntervalMs(): number {
  const raw = Number(process.env.MESSAGE_POLL_INTERVAL_MS);
  return Number.isFinite(raw) && raw >= 1000 ? Math.floor(raw) : 5000;
}

async function runOnce(): Promise<void> {
  try {
    const batch = await claimDueMessages(25);
    for (const msg of batch) {
      try {
        await processMessage(msg);
      } catch (e: any) {
        // processMessage never throws, but guard against adapter surprises.
        console.error(`[MsgQueue] worker error on ${msg.id}:`, e?.message || e);
      }
    }
    sweepCount++;
    if (sweepCount >= 100) {
      sweepCount = 0;
      try { await pruneTerminalMessages(); } catch { /* non-critical */ }
    }
  } catch (e: any) {
    console.error("[MsgQueue] worker sweep failed:", e?.message || e);
  }
}

/** Idempotent — safe to call from server.ts and admin-server.ts bootstrap. */
export function startMessageWorker(): void {
  if (started) return;
  if (isTestMode()) {
    console.log("[MsgQueue] Worker disabled in test mode — tests drive the queue synchronously.");
    return;
  }
  started = true;
  // First sweep after a short settle, then on the poll interval.
  timer = setTimeout(() => {
    void runOnce();
    timer = setInterval(() => void runOnce(), pollIntervalMs());
  }, Math.min(pollIntervalMs(), 5000));
}

export function stopMessageWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

/** Test hook: run one sweep synchronously. */
export async function runMessageWorkerOnce(): Promise<void> {
  await runOnce();
}
