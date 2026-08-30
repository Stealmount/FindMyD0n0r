/**
 * Messaging Service — centralized outbound message queue.
 *
 * Every outbound message (WhatsApp via WAHA, email via Resend) must pass
 * through enqueueMessage(). No code path calls the provider adapters
 * (waha.ts / sendEmailViaResend) directly.
 *
 * Lifecycle: queued → processing → sent | failed
 * Retries:    on retryable failure → retry_count++, back to queued with
 *             scheduled_send_time = now + backoff(retry_count). After
 *             max_retries → failed.
 * At-most-once: claim marks a row processing; a crashed claim is reclaimed
 *               after MESSAGE_CLAIM_STALE_SECONDS.
 */

import { randomUUID } from "node:crypto";
import { getCollection as dbGetCollection, getDoc as dbGetDoc, saveDoc as dbSaveDoc } from "./serverDb";
import { getUpstash, k } from "./upstash";
import { sendWhatsApp, sendWhatsAppButtons } from "./waha";
import { sendEmailViaResend } from "./resend";

// Terminal request statuses — kept local to avoid a circular import with
// matchingEngine (which already imports this module). Must stay aligned with
// TERMINAL_REQUEST_STATUSES in services/matchingEngine.
const TERMINAL_REQUEST_STATUSES = new Set<string>(["cancelled", "fulfilled", "expired", "closed"]);

// Match-actionable donor-invitation message types. ONLY these get the live-state
// delivery-time guard — general transactional/system messages (OTP, SLA, etc.)
// are deliberately excluded, because for those the recipient is the requester or
// a system actor and re-reading a donor match is meaningless.
const MATCH_ACTIONABLE_TYPES = new Set(["donor_match", "match_sos_retry"]);

/** Whether a queued message type is a match-actionable donor invitation. */
export function isMatchActionableMessage(type: string): boolean {
  return MATCH_ACTIONABLE_TYPES.has(type);
}

export type MessageChannel = "whatsapp" | "email";
/**
 * Terminal states:
 *  - sent:       the provider confirmed delivery.
 *  - failed:     a provider/retryable failure exhausted max_retries.
 *  - suppressed: the message was deliberately NOT sent because its target
 *                (an actionable donor-match request) became terminal/resolved
 *                before the worker reached the provider. Not a failure, and
 *                never retried.
 */
export type MessageStatus = "queued" | "processing" | "sent" | "failed" | "suppressed";

export interface OutgoingMessage {
  id: string;
  channel: MessageChannel;
  recipient: string;
  type: string;
  payload: Record<string, unknown>;
  status: MessageStatus;
  created_at: string;
  scheduled_send_time: string;
  claimed_at: string | null;
  sent_at: string | null;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  /** Structured, human-readable reason when status === "suppressed". */
  suppressed_reason?: string;
}

export interface EnqueueInput {
  channel: MessageChannel;
  recipient: string;
  type: string;
  /** Provider payload. whatsapp: { text, buttons? } — email: { subject, html, text }. */
  payload: Record<string, unknown>;
  /** Override the delay (seconds). OTP uses 0. Defaults to MESSAGE_DELAY_SECONDS. */
  delaySeconds?: number;
}

function nowISO(): string {
  return new Date().toISOString();
}

function messageDelaySeconds(): number {
  const raw = Number(process.env.MESSAGE_DELAY_SECONDS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 60;
}

function maxRetries(): number {
  const raw = Number(process.env.MESSAGE_MAX_RETRIES);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 5;
}

function claimStaleSeconds(): number {
  const raw = Number(process.env.MESSAGE_CLAIM_STALE_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw : 120;
}

/** Insert a message into the queue. Never sends immediately. */
export async function enqueueMessage(input: EnqueueInput): Promise<OutgoingMessage> {
  const id = randomUUID();
  const now = new Date();
  const delay = input.delaySeconds ?? messageDelaySeconds();
  const scheduled = new Date(now.getTime() + delay * 1000).toISOString();

  const row: OutgoingMessage = {
    id,
    channel: input.channel,
    recipient: input.recipient,
    type: input.type,
    payload: input.payload || {},
    status: "queued",
    created_at: nowISO(),
    scheduled_send_time: scheduled,
    claimed_at: null,
    sent_at: null,
    retry_count: 0,
    max_retries: maxRetries(),
    last_error: null,
  };

  await dbSaveDoc("message_queue", id, row as unknown as Record<string, unknown>);

  console.log(
    `[MsgQueue] queued ${id} ${input.channel} → ${input.recipient} ` +
      `(${input.type}) scheduled ${scheduled}`
  );
  return row;
}

/**
 * Claim due rows (queued + scheduled_send_time <= now, or stale processing
 * rows older than MESSAGE_CLAIM_STALE_SECONDS).
 *
 * Discovery is a plain scan (queue volumes are small), but OWNERSHIP is atomic:
 *  - queued rows: ZREM from the z:msgq schedule — only one worker can remove it.
 *  - stale processing rows (already removed from z:msgq at claim time):
 *    ZADD NX with score=now — only one worker can re-insert it.
 * A crashed claim becomes visible again via its claimed_at timestamp.
 * ZSET-optimized discovery via ZRANGEBYSCORE on z:msgq is preferred when
 * Upstash is ready (uses store.ts zrangeByScore helper); full scan remains
 * as fallback for local dev and for stale processing rows not in the ZSET.
 * Full ZSET migration for prune/discovery is deferred — scan still covers
 * terminal rows and ensures k() prefix is applied via store helpers.
 */
export async function claimDueMessages(limit = 25): Promise<OutgoingMessage[]> {
  const now = new Date();
  const nowMs = now.getTime();
  const staleBefore = new Date(nowMs - claimStaleSeconds() * 1000);

  // ── Optimized discovery: try ZRANGEBYSCORE first when Upstash is ready ──
  let all: OutgoingMessage[] | null = null;
  if (isUpstashReady()) {
    try {
      const { zrangeByScore, mgetDocs } = await import("./store");
      const dueIds = await zrangeByScore("z:msgq", 0, nowMs, { offset: 0, count: limit * 4 });
      if (dueIds.length > 0) {
        const docs = await mgetDocs<OutgoingMessage>("message_queue", dueIds);
        const fromZSet = docs.filter(Boolean) as OutgoingMessage[];
        // Merge with stale processing rows which are not in the ZSET — fetch via scan for those only
        const staleCandidates = (await dbGetCollection<OutgoingMessage>("message_queue")).filter(
          (m) => m?.status === "processing" && m.claimed_at && new Date(m.claimed_at) < staleBefore
        );
        const seen = new Set(fromZSet.map((m) => m.id));
        for (const s of staleCandidates) if (!seen.has(s.id)) fromZSet.push(s);
        all = fromZSet;
      }
    } catch {
      // ZSET path unavailable — fallback to full scan
      all = null;
    }
  }
  if (all === null) {
    all = await dbGetCollection<OutgoingMessage>("message_queue");
  }

  const due = all
    .filter((m) => {
      if (!m || !m.id) return false;
      if (m.status === "queued") return new Date(m.scheduled_send_time) <= now;
      if (m.status === "processing" && m.claimed_at) {
        // Reclaim crashed claims after the stale window.
        return new Date(m.claimed_at) < staleBefore;
      }
      return false;
    })
    .sort((a, b) => new Date(a.scheduled_send_time).getTime() - new Date(b.scheduled_send_time).getTime())
    .slice(0, limit);

  const claimed: OutgoingMessage[] = [];
  for (const m of due) {
    if (isUpstashReady()) {
      try {
        if (m.status === "queued") {
          const owned = await getUpstash().zrem(k("z:msgq"), m.id);
          if (!owned) continue; // another worker won the race
        } else {
          const owned = await getUpstash().zadd(k("z:msgq"), { nx: true }, { score: nowMs, member: m.id });
          if (!owned) continue;
        }
      } catch { /* gate unavailable — degrade to old behavior */ }
    }
    const updated: OutgoingMessage = {
      ...m,
      status: "processing",
      claimed_at: nowISO(),
    };
    await dbSaveDoc("message_queue", m.id, updated as unknown as Record<string, unknown>);
    claimed.push(updated);
  }

  if (claimed.length) {
    console.log(`[MsgQueue] claimed ${claimed.length} message(s) for delivery`);
  }
  return claimed;
}

function isUpstashReady(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function backoffSeconds(retryCount: number): number {
  return Math.min(30 * 2 ** retryCount, 3600); // 30, 60, 120, 240, ... capped 1h
}

/**
 * Delivery-time live-state guard for match-actionable donor invitations
 * (donor_match / match_sos_retry).
 *
 * The request was created while live; by the time the worker runs the request
 * may have closed and the donor match may have been resolved/retired. Sending
 * then would contact a donor for a request that is no longer actionable. This
 * re-reads the authoritative live request + match immediately before dispatch
 * and reports suppression when the invite is no longer legitimate.
 *
 * Non-match messages (OTP, SLA, requester notifications, etc.) are never
 * guarded — they are the project's normal transactional/system traffic.
 */
async function resolveStaleSuppression(
  row: OutgoingMessage
): Promise<{ suppressed: boolean; reason?: string }> {
  if (!isMatchActionableMessage(row.type)) return { suppressed: false };

  const requestId =
    typeof row.payload?.request_id === "string" ? row.payload.request_id : undefined;
  const matchId = typeof row.payload?.match_id === "string" ? row.payload.match_id : undefined;

  if (!requestId || !matchId) {
    // Cannot verify the live state — never send an unverifiable donor invite.
    return { suppressed: true, reason: "unresolvable_match_identifiers" };
  }

  const liveReq = await dbGetDoc<{ status?: string }>("blood_requests", requestId);
  if (!liveReq) return { suppressed: true, reason: "request_not_found" };
  if (TERMINAL_REQUEST_STATUSES.has(liveReq.status ?? "")) {
    return { suppressed: true, reason: `request_terminal_${liveReq.status}` };
  }

  const liveMatch = await dbGetDoc<{ donor_response?: string }>("matches", matchId);
  if (!liveMatch) return { suppressed: true, reason: "match_not_found" };
  if (liveMatch.donor_response !== "pending") {
    return { suppressed: true, reason: `match_resolved_${liveMatch.donor_response}` };
  }

  return { suppressed: false };
}

/** Mark a row suppressed (terminal, non-retryable) with a structured reason. */
async function markSuppressed(row: OutgoingMessage, reason: string): Promise<OutgoingMessage> {
  const updated: OutgoingMessage = {
    ...row,
    status: "suppressed",
    sent_at: nowISO(),
    last_error: null,
    suppressed_reason: reason,
  };
  await dbSaveDoc("message_queue", row.id, updated as unknown as Record<string, unknown>);
  if (isUpstashReady()) {
    try { await getUpstash().zrem(k("z:msgq"), row.id); } catch { /* degrade gracefully */ }
  }
  console.warn(
    `[MsgQueue] suppressed ${row.id} ${row.channel} → ${row.recipient} (${row.type}): ${reason} — not sent, not retried`
  );
  return updated;
}

/**
 * Deliver a single message through the provider adapter.
 * Returns the updated row. Throws nothing — failures are recorded on the row.
 */
export async function processMessage(row: OutgoingMessage): Promise<OutgoingMessage> {
  // Delivery-time live-state guard for match-actionable donor invitations.
  const guard = await resolveStaleSuppression(row);
  if (guard.suppressed) {
    return markSuppressed(row, guard.reason || "not_actionable");
  }

  let ok = false;
  let error: string | null = null;

  try {
    if (row.channel === "whatsapp") {
      const text = String(row.payload?.text ?? "");
      const buttons = Array.isArray(row.payload?.buttons)
        ? (row.payload.buttons as Array<{ id: string; text: string }>)
        : null;
      ok = buttons && buttons.length > 0
        ? await sendWhatsAppButtons(
            row.recipient,
            String(row.payload?.title ?? ""),
            text,
            String(row.payload?.footer ?? ""),
            buttons
          )
        : await sendWhatsApp(row.recipient, text);
    } else if (row.channel === "email") {
      const subject = String(row.payload?.subject ?? "");
      const html = String(row.payload?.html ?? "");
      const text = String(row.payload?.text ?? "");
      const idempotencyKey = typeof row.payload?.idempotencyKey === "string" ? row.payload.idempotencyKey : undefined;
      const tags = Array.isArray(row.payload?.tags) ? row.payload.tags as Array<{ name: string; value: string }> : undefined;
      ok = await sendEmailViaResend(row.recipient, subject, html, text, { idempotencyKey, tags });
    } else {
      error = `Unknown channel: ${row.channel}`;
    }
  } catch (e: any) {
    error = e?.message || String(e);
  }

  if (ok) {
    const updated: OutgoingMessage = { ...row, status: "sent", sent_at: nowISO(), last_error: null };
    await dbSaveDoc("message_queue", row.id, updated as unknown as Record<string, unknown>);
    if (isUpstashReady()) {
      try { await getUpstash().zrem(k("z:msgq"), row.id); } catch { /* degrade gracefully */ }
    }
    console.log(`[MsgQueue] sent ${row.id} ${row.channel} → ${row.recipient} (${row.type})`);
    return updated;
  }

  // A corrupt/legacy row with a non-finite retry_count would make backoffSeconds
  // return NaN and toISOString() throw — violating the "processMessage never
  // throws" contract. Normalize once; the queue worker must never crash on one
  // malformed row (it would strand the row in processing forever).
  const retries = Number.isFinite(Number(row.retry_count)) ? Number(row.retry_count) : 0;
  const nextRetry = retries + 1;
  if (nextRetry > row.max_retries) {
    const updated: OutgoingMessage = {
      ...row,
      status: "failed",
      retry_count: nextRetry,
      last_error: error || "Delivery failed",
    };
    await dbSaveDoc("message_queue", row.id, updated as unknown as Record<string, unknown>);
    if (isUpstashReady()) {
      try { await getUpstash().zrem(k("z:msgq"), row.id); } catch { /* degrade gracefully */ }
    }
    console.error(
      `[MsgQueue] failed ${row.id} ${row.channel} → ${row.recipient} (${row.type}) ` +
        `after ${nextRetry} attempts: ${error || "unknown"}`
    );
    return updated;
  }

  const retryIn = backoffSeconds(retries);
  const updated: OutgoingMessage = {
    ...row,
    status: "queued",
    retry_count: nextRetry,
    scheduled_send_time: new Date(Date.now() + retryIn * 1000).toISOString(),
    claimed_at: null,
    last_error: error || "Delivery failed",
  };
  await dbSaveDoc("message_queue", row.id, updated as unknown as Record<string, unknown>);
  console.warn(
    `[MsgQueue] retrying ${row.id} ${row.channel} → ${row.recipient} (${row.type}) ` +
      `attempt ${nextRetry}/${row.max_retries} in ${retryIn}s: ${error || "unknown"}`
  );
  return updated;
}

export interface QueueStats {
  queued: number;
  processing: number;
  sent: number;
  failed: number;
  suppressed: number;
  total: number;
}

export async function getQueueStats(): Promise<QueueStats> {
  const all = await dbGetCollection<OutgoingMessage>("message_queue");
  const stats: QueueStats = { queued: 0, processing: 0, sent: 0, failed: 0, suppressed: 0, total: all.length };
  for (const m of all) {
    if (m?.status === "queued") stats.queued++;
    else if (m?.status === "processing") stats.processing++;
    else if (m?.status === "sent") stats.sent++;
    else if (m?.status === "failed") stats.failed++;
    else if (m?.status === "suppressed") stats.suppressed++;
  }
  return stats;
}

export async function pruneTerminalMessages(): Promise<number> {
  const all = await dbGetCollection<OutgoingMessage>("message_queue");
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let pruned = 0;
  for (const m of all) {
    if (!m || !m.id) continue;
    if (m.status !== "sent" && m.status !== "failed" && m.status !== "suppressed") continue;
    const ts = m.status === "sent" ? m.sent_at : m.created_at;
    if (!ts || new Date(ts) >= cutoff) continue;
    const { deleteDoc } = await import("./serverDb");
    await deleteDoc("message_queue", m.id);
    pruned++;
  }
  if (pruned > 0) {
    console.log(`[MsgQueue] pruned ${pruned} terminal message(s) older than 7 days`);
  }
  return pruned;
}

/** Test hook: reset the local queue store (no-op in production). */
export async function clearMessageQueueForTest(): Promise<void> {
  const all = await dbGetCollection<OutgoingMessage>("message_queue");
  for (const m of all) {
    // serverDb has no raw remove besides deleteDoc — import lazily to avoid cycle
    const { deleteDoc } = await import("./serverDb");
    await deleteDoc("message_queue", m.id);
  }
}
