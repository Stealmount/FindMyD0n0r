/**
 * Notification service — unified façade over outbound messaging
 * (Phase 3 decomposition, Task 3.8).
 *
 * Two send modes:
 *  - sendWhatsApp / sendEmailViaResend  → IMMEDIATE (boolean result).
 *    Preserves the original server.ts semantics; used by OTP flows and
 *    by callers that branch on delivery success (matchingEngine.notifyDonor).
 *  - enqueueWhatsApp / enqueueEmail    → ASYNC via the messaging queue
 *    (src/lib/messaging.ts), drained by messageWorker.
 *
 * The duplicate sendEmailViaResend that lived here is gone — the single
 * implementation is src/lib/resend.ts (with daily quota tracking).
 * Message builders are re-exported so callers import from ONE place.
 */
import { enqueueMessage } from "../src/lib/messaging";
import { getDoc as storeGet, updateDoc as storeUpdate } from "../src/lib/store";
import { sendWhatsApp as sendWhatsAppDirect } from "../src/lib/waha";
import { sendEmailViaResend as sendEmailViaResendDirect } from "../src/lib/resend";
import { buildWelcomeMessage } from "../src/lib/waha";
import { buildWelcomeEmailHTML } from "../src/lib/email";

// ─── Immediate sends (boolean result — original semantics) ───────────────────
export function sendWhatsApp(phone: string, text: string): Promise<boolean> {
  return sendWhatsAppDirect(phone, text);
}

export function sendEmailViaResend(to: string, subject: string, html: string, text: string, options?: { idempotencyKey?: string; tags?: Array<{ name: string; value: string }> }): Promise<boolean> {
  return sendEmailViaResendDirect(to, subject, html, text, options);
}

// ─── Queue-based sends (async, scheduled by messaging.ts) ────────────────────
export function enqueueWhatsApp(phone: string, text: string) {
  return enqueueMessage({
    channel: "whatsapp",
    recipient: phone,
    type: "text",
    payload: { text },
  });
}

export function enqueueEmail(to: string, subject: string, html: string, text: string, options?: { idempotencyKey?: string; tags?: Array<{ name: string; value: string }>; delaySeconds?: number }) {
  return enqueueMessage({
    channel: "email",
    recipient: to,
    type: "email",
    payload: {
      subject,
      html,
      text,
      ...(options?.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
      ...(options?.tags ? { tags: options.tags } : {}),
    },
    ...(options?.delaySeconds !== undefined ? { delaySeconds: options.delaySeconds } : {}),
  });
}

// ─── Welcome notification — delayed, queued, idempotent (Rev 3 §5) ───────────
const welcomeDelaySeconds = (): number => {
  const raw = Number(process.env.WELCOME_DELAY_SECONDS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 30;
};

/**
 * Enqueue the welcome notification for a profile, honoring notification_channel.
 * Idempotent: sets welcome_sent_at as a guard — a profile only ever gets ONE
 * welcome. Returns { enqueued } — never throws; queue failures are logged.
 * ponytail: WhatsApp welcome text is donor-flavored; keep generic for now.
 */
export async function enqueueWelcome(profileId: string): Promise<{ enqueued: boolean; channel: string | null }> {
  try {
    const profile = await storeGet<any>("profiles", profileId);
    if (!profile) {
      console.warn(`[Welcome] profile ${profileId} not found — welcome skipped`);
      return { enqueued: false, channel: null };
    }
    if (profile.welcome_sent_at) {
      console.log(`[Welcome] profile ${profileId} already welcomed at ${profile.welcome_sent_at} — skipped`);
      return { enqueued: false, channel: profile.notification_channel || null };
    }

    const channel = profile.notification_channel || process.env.NOTIFICATION_DEFAULT_CHANNEL || "both";
    const name = String(profile.full_name || "there").trim() || "there";
    const type = profile.intent === "donor" ? "donor" : "requester";
    const waRecipient = String(profile.whatsapp_phone || profile.phone || "").trim();
    const emailRecipient = String(profile.email || "").trim();

    let enqueued = false;
    if ((channel === "whatsapp" || channel === "both") && waRecipient) {
      await enqueueMessage({
        channel: "whatsapp",
        recipient: waRecipient,
        type: "welcome",
        payload: { text: buildWelcomeMessage(name) },
        delaySeconds: welcomeDelaySeconds(),
      });
      enqueued = true;
    }
    if ((channel === "email" || channel === "both") && emailRecipient) {
      const mail = buildWelcomeEmailHTML({ name, type });
      await enqueueMessage({
        channel: "email",
        recipient: emailRecipient,
        type: "welcome",
        payload: { subject: mail.subject, html: mail.html, text: mail.text },
        delaySeconds: welcomeDelaySeconds(),
      });
      enqueued = true;
    }

    // Idempotency guard: the queue owns delivery; we only guarantee
    // enqueue-once semantics, so mark welcome_sent_at once we've enqueued.
    if (enqueued) {
      await storeUpdate("profiles", profileId, { welcome_sent_at: new Date().toISOString() });
    } else {
      console.warn(`[Welcome] profile ${profileId} has no reachable channel — welcome skipped`);
    }
    return { enqueued, channel };
  } catch (error) {
    console.error(`[Welcome] enqueue failed for profile ${profileId}:`, (error as Error)?.message || error);
    return { enqueued: false, channel: null };
  }
}

// ─── Message builders (re-exported for a single import point) ─────────────────
export {
  buildOtpMessage,
  buildDonorSosMessage,
  buildDonorSosInteractivePayload,
  buildDonorConfirmedDetailsMessage,
  buildRequesterConfirmMessage,
  buildDonorThankYouMessage,
  buildWelcomeMessage,
  buildRequesterSystemAlertMessage,
  buildNoDonorsFoundAlertMessage,
  buildDonorDeclineAckMessage,
  buildDonorReferralMessage,
  buildRequesterAckMessage,
  buildRequestCancelledDonorNotice,
} from "../src/lib/waha";
export {
  buildDonorSosEmailHTML,
  buildRequesterConfirmEmailHTML,
  buildEmailOtpHTML,
  buildWelcomeEmailHTML,
  buildRequesterEmpathyEmailHTML,
  buildDonorsMatchedEmailHTML,
  buildNoDonorsYetEmailHTML,
  buildDonorConfirmedDetailsEmailHTML,
} from "../src/lib/email";
