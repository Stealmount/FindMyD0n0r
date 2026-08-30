/**
 * WAHA — WhatsApp HTTP API Integration
 * Self-hosted WhatsApp messaging via WAHA Docker container.
 * Docs: https://waha.devlike.pro/docs/
 *
 * PROVIDER ADAPTER — call ONLY via the Messaging Service queue
 * (src/lib/messaging.ts). No route/caller imports these functions directly.
 */

import type { BloodRequest, User } from '../types';
import { getDistanceBetweenPincodes } from './geo';

function getWahaConfig() {
  return {
    url: process.env.WAHA_BASE_URL,
    key: process.env.WAHA_API_KEY || '',
    session: process.env.WAHA_SESSION || 'default',
  };
}

/** Normalize Indian phone → WhatsApp chatId format (91XXXXXXXXXX@c.us) */
function toChatId(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Only prepend 91 to bare 10-digit numbers — never trust startsWith('91'),
  // since valid Indian mobiles can begin with "91" (e.g. 9149556893).
  const normalized = /^[6-9]\d{9}$/.test(digits) ? `91${digits}` : digits;
  return `${normalized}@c.us`;
}

/**
 * Sends a standard WhatsApp text message via WAHA.
 * Returns true on success, false if WAHA is not configured or call fails.
 */
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const { url, key, session } = getWahaConfig();
  if (!url) {
    console.warn('[WAHA] WAHA_BASE_URL not set — WhatsApp delivery skipped.');
    return false;
  }

  const chatId = toChatId(phone);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${url}/api/sendText`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { 'X-Api-Key': key } : {}),
        },
        body: JSON.stringify({
          session,
          chatId,
          text: message,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (response.ok) {
        console.log(`[WAHA] ✅ Text delivered to ${phone}`);
        return true;
      }

      const retryable = response.status === 429 || response.status >= 500;
      console.error(`[WAHA] HTTP ${response.status} for ${phone}${retryable && attempt < 3 ? `; retry ${attempt}/3` : ''}`);
      if (!retryable) return false;
    } catch (error) {
      console.error(`[WAHA] Attempt ${attempt}/3 failed for ${phone}:`, error);
    }

    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }

  return false;
}

/**
 * Sends an interactive WhatsApp Button message via WAHA with zero-config fallback to text.
 */
export async function sendWhatsAppButtons(
  phone: string,
  title: string,
  text: string,
  footer: string,
  buttons: Array<{ id: string; text: string }>
): Promise<boolean> {
  const { url, key, session } = getWahaConfig();
  if (!url) {
    console.warn('[WAHA] WAHA_BASE_URL not set — WhatsApp delivery skipped.');
    return false;
  }

  const chatId = toChatId(phone);

  try {
    const response = await fetch(`${url}/api/sendButtons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'X-Api-Key': key } : {}),
      },
      body: JSON.stringify({
        session,
        chatId,
        title,
        body: text,
        footer,
        buttons: buttons.map(b => ({ id: b.id, text: b.text })),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (response.ok) {
      console.log(`[WAHA] ✅ Delivered Interactive Buttons to ${phone}`);
      return true;
    }
    console.warn(`[WAHA] sendButtons API returned HTTP ${response.status} — executing seamless text fallback.`);
  } catch (error: any) {
    console.warn(`[WAHA] sendButtons fallback to sendText: ${error?.message || error}`);
  }

  // Seamless fallback to standard text message with explicit reply guidance
  const buttonGuide = buttons.map(b => `👉 *${b.text}*`).join('\n');
  const fallbackMessage = `${title ? `*${title}*\n\n` : ''}${text}\n\n${footer ? `_${footer}_\n\n` : ''}${buttonGuide}\n\n_(Reply YES or NO directly in chat)_`;
  return sendWhatsApp(phone, fallbackMessage);
}

/**
 * Build the OTP WhatsApp message sent during registration.
 */
export function buildOtpMessage(otp: string): string {
  return `Your FindMyDonor™ verification code is: *${otp}*

This code is valid for 15 minutes. Do not share it with anyone.`;
}

function getPublicAppUrl(): string {
  const raw = process.env.APP_URL || '';
  if (!raw || raw.includes('localhost') || raw.includes('127.0.0.1')) {
    return 'https://findmydonor.online';
  }
  return raw.replace(/\/$/, '');
}

/**
 * Build interactive donor SOS message payload with native buttons and witty human warmth.
 */
export function buildDonorSosInteractivePayload(
  request: BloodRequest,
  donor: User,
  matchId: string,
  matchToken?: string | null
) {
  const firstName = donor.full_name.split(' ')[0];
  const distance = getDistanceBetweenPincodes(donor.pincode, request.hospital_pincode);
  const appUrl = getPublicAppUrl();
  // Use the opaque capability token in the public link (S-1 fix).
  // Fall back to matchId only for legacy matches without a token (should not occur post-deploy).
  const tokenParam = matchToken ? `matchToken=${matchToken}` : `matchId=${matchId}`;
  const link = `${appUrl}/track/${request.tracking_code}?role=donor&${tokenParam}`;
  const mapsQuery = encodeURIComponent(`${request.hospital_name}, ${request.hospital_area || ''}, ${request.hospital_city || ''}, ${request.hospital_pincode || ''}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const urgencyTitle = request.urgency_level === 'critical' ? '🚨 CRITICAL EMERGENCY SOS' : '🩸 URGENT BLOOD MATCH';

  const bodyText = `Hi *${firstName}* 👋, someone near you urgently needs your help!

🩸 *Blood Needed:* *${request.blood_type_needed}* (1 unit requested from you)
🏥 *Hospital:* ${request.hospital_name}
📍 *Location:* ${request.hospital_area ? request.hospital_area + ', ' : ''}${request.hospital_city} (${request.hospital_pincode})
🗺️ *Distance:* ~${distance} km away
🧭 *Directions:* ${mapsUrl}
🆔 *Ticket ID:* \`${request.tracking_code}\`

Someone's family is counting on a hero today. Can you donate?

🔗 *Track Live details:* ${link}`;

  return {
    title: urgencyTitle,
    text: bodyText,
    footer: 'FindMyDonor™ Emergency Network 🩸',
    buttons: [
      { id: `ACCEPT_${matchId}`, text: '🟢 YES - I CAN DONATE' },
      { id: `DECLINE_${matchId}`, text: '🔴 NOT AVAILABLE TODAY' }
    ]
  };
}

/**
 * Legacy builder for backward compatibility.
 */
export function buildDonorSosMessage(
  request: BloodRequest,
  donor: User,
  matchId: string,
  matchToken?: string | null
): string {
  const payload = buildDonorSosInteractivePayload(request, donor, matchId, matchToken);
  return `${payload.title}\n\n${payload.text}\n\n👉 Reply *YES* to confirm or *NO* to decline.`;
}

/**
 * Build the full details message sent to a donor after they reply YES.
 */
export function buildDonorConfirmedDetailsMessage(request: BloodRequest, donor: User): string {
  const firstName = donor.full_name.split(' ')[0];
  const mapsQuery = encodeURIComponent(`${request.hospital_name}, ${request.hospital_area || ''}, ${request.hospital_city || ''}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return `Thank you for accepting, *${firstName}*! You're a hero! 🙏 🩸

📋 *PATIENT & HOSPITAL DETAILS:*
• Patient Name: ${request.patient_name || 'N/A'}
• Blood Type: *${request.blood_type_needed}* (1 unit from you)
• Hospital: ${request.hospital_name}, ${request.hospital_area || ''}, ${request.hospital_city}
${request.attending_doctor ? `• Attending Doctor: ${request.attending_doctor}\n` : ''}• Requester Contact: ${request.requester_name} (📞 ${request.requester_phone})

🧭 *Google Maps Directions:* ${mapsUrl}

Please call or message the requester directly to coordinate your visit. Thank you for stepping up to save a life! ❤️`;
}

/**
 * WhatsApp message confirming a donor match to the requester.
 */
export function buildRequesterConfirmMessage(request: BloodRequest, donorName: string): string {
  const firstName = request.requester_name.split(' ')[0];
  const trackingUrl = `${getPublicAppUrl()}/track/${request.tracking_code}`;

  return `🎉 *GOOD NEWS, ${firstName.toUpperCase()}!*

A verified voluntary donor (*${donorName}*) has accepted your request and pledged 1 unit of *${request.blood_type_needed}* blood!

🏥 *Hospital:* ${request.hospital_name}
🆔 *Ticket Code:* \`${request.tracking_code}\`

🔗 *Track Live Progress & Contact Info:*
${trackingUrl}`;
}

/**
 * WhatsApp message to donor after they confirm donation.
 */
export function buildDonorThankYouMessage(donor: User, trackingCode: string, cooldownUntil: string): string {
  const firstName = donor.full_name.split(' ')[0];
  return `Thank you, *${firstName}*. Your decision to donate 1 unit of blood for ticket \`${trackingCode}\` is making a life-saving impact today. 🩸

Your 90-day safety cooldown is now active. You won't receive new requests until ${cooldownUntil}.

We appreciate you! ❤️`;
}

/**
 * WhatsApp message for new donor registration welcome.
 */
export function buildWelcomeMessage(donorName: string): string {
  const firstName = donorName.split(' ')[0];
  return `🎉 *WELCOME TO FINDMYDONOR™!* 🎉

Hi *${firstName}*! Thank you for stepping forward as a volunteer blood donor. 🩸

You are now registered in our emergency response network. When a patient nearby needs your blood type, you'll receive a WhatsApp alert with 1-tap buttons to accept or decline.

_Together, let me & you save lives!_ ❤️`;
}

/**
 * WhatsApp alert sent to requester right after their request goes live.
 */
export function buildRequesterSystemAlertMessage(request: BloodRequest, alertedCount: number): string {
  const firstName = request.requester_name.split(' ')[0];
  const trackingUrl = `${getPublicAppUrl()}/track/${request.tracking_code}`;
  return `🎉 *REQUEST BROADCAST ACTIVE, ${firstName.toUpperCase()}!*

We found *${alertedCount}* matching donor(s) nearby for your request (\`${request.tracking_code}\`).

Emergency alerts with 1-tap WhatsApp response buttons have been sent to eligible donors (1 unit per donor). Track responses live here:
${trackingUrl}

FindMyDonor™ Emergency Network 🩸`;
}

/**
 * WhatsApp alert sent to requester when no matching donors are available on initial search.
 */
export function buildNoDonorsFoundAlertMessage(request: BloodRequest): string {
  const firstName = request.requester_name.split(' ')[0];
  const trackingUrl = `${getPublicAppUrl()}/track/${request.tracking_code}`;
  return `🩸 *FINDMYDONOR™ EMERGENCY BROADCAST LIVE* 🩸

Hi *${firstName}*, your request (\`${request.tracking_code}\`) for ${request.units_required} unit(s) of *${request.blood_type_needed}* is active.

We are continuously monitoring nearby voluntary donors. As soon as a donor becomes available, we will alert them immediately.

🔗 *Track Live Status:*
${trackingUrl}`;
}

/**
 * WhatsApp acknowledgement sent to a requester immediately after their request is received
 * (extracted verbatim from routes/requester.ts — Phase 4).
 */
export function buildRequesterAckMessage(request: BloodRequest): string {
  return `🩸 *FindMyDonor* — Your blood request (${request.tracking_code}) has been received.\n` +
    `We are searching for the nearest matching ${request.blood_type_needed} donor near ` +
    `${request.hospital_name}, ${request.hospital_city}.\n` +
    `We'll notify you as soon as we find one.\n\n` +
    `Track: https://findmydonor.online/tracking?code=${request.tracking_code}`;
}

/**
 * Courtesy WhatsApp sent to donors who already ACCEPTED a unit when the
 * requester cancels the request (Phase 6 — user-approved trust gesture).
 */
export function buildRequestCancelledDonorNotice(trackingCode: string): string {
  return `📢 *Update from FindMyDonor* 🩸\n\nThe blood request you generously accepted (\`${trackingCode}\`) has been cancelled by the requester — your donation is no longer needed.\n\nNo action is required from you. Your 90-day cooldown was NOT activated, so you remain eligible for future emergency alerts. Thank you for stepping up! ❤️`;
}

/**
 * WhatsApp acknowledgement sent to a donor when they reply NO or decline a match.
 */
export function buildDonorDeclineAckMessage(): string {
  return `Understood. We've updated your status and alerted the next eligible donor. Thank you for responding quickly! 🙏`;
}

/**
 * WhatsApp referral message template auto-sent after a donation is logged.
 */
export function buildDonorReferralMessage(donorName: string): string {
  const firstName = donorName.split(' ')[0];
  return `Hi *${firstName}*! Thank you for donating blood and saving a life today on FindMyDonor™! ❤️

Help us reach more patients in emergency by sharing FindMyDonor with your friends & family:

"I just donated blood via FindMyDonor™! Join our emergency volunteer donor network here: https://findmydonor.online" 🩸`;
}

/**
 * PRODUCT RULE: Only the explicitly stored WhatsApp number (donor.whatsapp_number /
 * profiles.whatsapp_phone) may ever be used as a WhatsApp destination. Phone
 * numbers are NEVER used for WhatsApp delivery. If no WhatsApp number exists,
 * this logs a structured warning and returns false — it never crashes and never
 * falls back to donor.phone.
 */
export async function sendDonorWhatsApp(
  donor: { id: string; full_name?: string; whatsapp_number?: string },
  message: string
): Promise<boolean> {
  const whatsappNumber = donor && donor.whatsapp_number;
  if (!whatsappNumber) {
    console.warn(
      `[WAHA] Skipping WhatsApp notification: donor ${donor?.id} (${donor?.full_name || "unknown"}) has no WhatsApp number. Phone is never used as a WhatsApp destination.`
    );
    return false;
  }
  return sendWhatsApp(whatsappNumber, message);
}

