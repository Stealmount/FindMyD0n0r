/**
 * Resend email provider adapter.
 *
 * Provider adapter — call ONLY via the Messaging Service queue
 * (src/lib/messaging.ts). No route/caller imports this directly.
 */

import { Resend } from "resend";
import { isUpstashConfigured, getUpstash, k } from "./upstash";

// ─── Test-mode gate ───────────────────────────────────────────────────────
function isTestMode(): boolean {
  return process.env.NODE_ENV === "test" || process.env.TEST_MODE === "1";
}

// ─── Daily Email Quota Counter (Resend free tier = 100/day) ────────────────
// Redis-backed when Upstash is available (survives restarts / multi-process);
// falls back to in-memory when Upstash env is absent.
const DAILY_EMAIL_LIMIT = 90; // 10 buffer below Resend's 100/day

let memDailyCount = 0;
let memDailyDate = new Date().toISOString().slice(0, 10);

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function getDailyCount(): Promise<number> {
  if (isUpstashConfigured()) {
    try {
      const raw = await getUpstash().get<string>(k(`email_quota:${todayKey()}`));
      return Number(raw) || 0;
    } catch { /* degrade to memory */ }
  }
  // In-memory fallback
  const today = todayKey();
  if (today !== memDailyDate) { memDailyCount = 0; memDailyDate = today; }
  return memDailyCount;
}

async function incrDailyCount(): Promise<number> {
  if (isUpstashConfigured()) {
    try {
      const key = k(`email_quota:${todayKey()}`);
      const count = await getUpstash().incr(key);
      // Set 48h expiry on first increment of the day (idempotent)
      if (count === 1) await getUpstash().expire(key, 172800);
      return count;
    } catch { /* degrade to memory */ }
  }
  // In-memory fallback
  const today = todayKey();
  if (today !== memDailyDate) { memDailyCount = 0; memDailyDate = today; }
  memDailyCount++;
  return memDailyCount;
}

export async function canSendEmail(): Promise<boolean> {
  const count = await getDailyCount();
  if (count >= DAILY_EMAIL_LIMIT) {
    console.warn(`[EmailQuota] Daily limit reached (${count}/${DAILY_EMAIL_LIMIT}). Email blocked.`);
    return false;
  }
  return true;
}

/** Helper: detect Gmail addresses (skip OTP for these) */
export function isGmailAddress(email: string): boolean {
  return email.trim().toLowerCase().endsWith('@gmail.com');
}

export async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string,
  options?: { idempotencyKey?: string; tags?: Array<{ name: string; value: string }> }
): Promise<boolean> {
  // ── Test / dry-run mode: never hit Resend ──────────────────────────────
  if (isTestMode()) {
    console.log(`[resend:dry] to=${to} subject=${subject}`);
    return true;
  }

  // Check daily quota before sending
  if (!(await canSendEmail())) {
    console.warn(`[Email] Daily quota exhausted — skipping email to ${to}`);
    return false;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY not set — skipped.");
    throw new Error("Email service not configured (RESEND_API_KEY missing).");
  }
  const resend = new Resend(apiKey);
  const sender = process.env.RESEND_SENDER_EMAIL || "FindMyDonor <official@findmydonor.online>";
  const fromAddress = sender.includes("<") ? sender : `FindMyDonor <${sender}>`;
  console.log(`[Email] Sending to=${to} from=${fromAddress} subject=${subject}`);
  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to: [to],
    subject,
    html,
    text,
    replyTo: "FindMyDonor <official@findmydonor.online>",
    ...(options?.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
    ...(options?.tags ? { tags: options.tags } : {}),
  });
  if (error) {
    const detail = (error as any).message || JSON.stringify(error);
    console.error(`[Email] Resend error sending to ${to}:`, error);
    throw new Error(`Resend API error: ${detail}`);
  }
  const count = await incrDailyCount();
  console.log(`[Email] Sent OK → ${to} (id: ${(data as any)?.id ?? 'n/a'}) [${count}/${DAILY_EMAIL_LIMIT} today]`);
  return true;
}
