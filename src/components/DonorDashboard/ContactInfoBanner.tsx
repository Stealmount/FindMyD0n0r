/**
 * ContactInfoBanner — shown when the authenticated user has no phone/WhatsApp set.
 *
 * Design rules (per project rules AGENTS.md):
 * - Glassmorphic aesthetic (.glass tokens from index.css / Tailwind utilities)
 * - Dismissible per session (sessionStorage), reappears on next load
 * - NOT a blocking gate — dashboard is fully accessible
 * - Wires to PATCH /api/profile/contact
 */
import React, { useState } from 'react';
import { authenticatedApi } from '../../lib/api';

interface ContactInfoBannerProps {
 /** Current phone on the profile (null = not set). */
 phone: string | null;
 /** Current WhatsApp phone on the profile (null = not set). */
 whatsappPhone: string | null;
 /** Called with updated values after a successful save. */
 onSaved: (phone: string, whatsappPhone: string) => void;
}

/** Returns true when the banner has been dismissed this session. */
const BANNER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BANNER_KEY = 'contact_banner_dismissed';
function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(BANNER_KEY);
    if (!raw) {
      const legacy = sessionStorage.getItem(BANNER_KEY);
      if (legacy === '1') {
        localStorage.setItem(BANNER_KEY, JSON.stringify({ dismissedAt: Date.now(), until: Date.now() + BANNER_TTL_MS }));
        try { sessionStorage.removeItem(BANNER_KEY); } catch {}
        return true;
      }
      return false;
    }
    if (raw === '1') {
      localStorage.setItem(BANNER_KEY, JSON.stringify({ dismissedAt: Date.now(), until: Date.now() + BANNER_TTL_MS }));
      return true;
    }
    const parsed = JSON.parse(raw);
    const until = parsed?.until;
    if (typeof until === 'number' && Date.now() < until) return true;
    localStorage.removeItem(BANNER_KEY);
    return false;
  } catch { return false; }
}
function dismiss() {
  try { localStorage.setItem(BANNER_KEY, JSON.stringify({ dismissedAt: Date.now(), until: Date.now() + BANNER_TTL_MS })); } catch {}
  try { sessionStorage.removeItem(BANNER_KEY); } catch {}
}

/**
 * Strips non-digits, prepends 91 if not present, for display as a 10-digit
 * number (the server stores 91XXXXXXXXXX; we show the 10-digit form).
 */
function toDisplay(stored: string | null): string {
 if (!stored) return '';
 const digits = stored.replace(/\D/g, '');
 return digits.startsWith('91') ? digits.slice(2) : digits;
}

export default function ContactInfoBanner({ phone, whatsappPhone, onSaved }: ContactInfoBannerProps) {
 const [visible, setVisible] = useState(!isDismissed() && (!phone || !whatsappPhone));
 const [phoneInput, setPhoneInput] = useState(toDisplay(phone));
 const [waInput, setWaInput] = useState(toDisplay(whatsappPhone));
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [saved, setSaved] = useState(false);

 if (!visible) return null;

 const handleDismiss = () => {
 dismiss();
 setVisible(false);
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError(null);

 const phoneTrimmed = phoneInput.trim();
 const waTrimmed = waInput.trim();

 const payload: { phone?: string; whatsappPhone?: string } = {};

 if (phoneTrimmed) {
 if (phoneTrimmed.length < 10) {
 setError('Enter a valid 10-digit Indian mobile number.');
 return;
 }
 payload.phone = phoneTrimmed;
 }

 if (waTrimmed) {
 if (waTrimmed.length < 10) {
 setError('Enter a valid 10-digit WhatsApp number.');
 return;
 }
 payload.whatsappPhone = waTrimmed;
 }

 if (!payload.phone && !payload.whatsappPhone) {
 setError('Enter at least one contact number (phone or WhatsApp).');
 return;
 }

 setSaving(true);
 try {
 const result = await authenticatedApi<{ success: boolean; phone: string | null; whatsapp_phone: string | null }>(
 '/api/profile/contact',
 payload,
 'PATCH'
 );
 setSaved(true);
 onSaved(
 result.phone ?? (phoneTrimmed || phone || ''),
 result.whatsapp_phone ?? (waTrimmed || whatsappPhone || '')
 );
 // Auto-dismiss after a brief success flash
 setTimeout(() => {
 dismiss();
 setVisible(false);
 }, 1800);
 } catch (err: any) {
 setError(err.message || 'Failed to save contact info. Try again.');
 } finally {
 setSaving(false);
 }
 };

  return (
  <div
  id="contact-info-banner"
  className="relative bg-ink-50/80 border border-ink-200 px-3.5 py-3 mb-4 animate-fade-in"
  role="region"
  aria-label="Add contact information"
  >
  {/* Dismiss button */}
  <button
  type="button"
  onClick={handleDismiss}
  aria-label="Dismiss"
  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full p-1 text-ink-500 transition-colors hover:bg-ink-100 text-xs font-bold cursor-pointer"
  >
  &#x2715;
  </button>

  {/* Icon + headline */}
  <div className="mb-4 flex items-start gap-3">
  <div className="grid h-7 w-7 flex-shrink-0 place-items-center border border-ink-200 bg-ink-100 text-[15px]">
  &#x1F4F2;
  </div>
  <div>
  <p className="text-[13px] font-semibold text-ink-900">Add your phone &amp; WhatsApp number</p>
  <p className="mt-0.5 text-[11px] text-ink-500">
  Required for WhatsApp match alerts. You can update this any time from Settings.
  </p>
  </div>
  </div>

  {saved ? (
  <div className="flex items-center gap-2 py-1 text-xs font-semibold text-blood-700">
  <span>&#x2705;</span> Contact info saved!
  </div>
  ) : (
  <form onSubmit={handleSubmit} className="space-y-3">
  {/* Phone row */}
  <div className="flex items-center gap-2">
  <span className="w-16 flex-shrink-0 text-right text-xs font-semibold text-ink-600">Phone</span>
  <div className="flex h-9 flex-1 items-center gap-1.5 border border-ink-300 bg-white px-3 transition-colors focus-within:border-blood-600">
  <span className="font-mono text-xs text-ink-500">+91</span>
  <input
  id="contact-phone-input"
  type="tel"
  inputMode="numeric"
  maxLength={10}
  value={phoneInput}
  onChange={e => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
  placeholder="10-digit phone"
  className="min-w-0 flex-1 bg-transparent font-mono text-xs tabular-nums text-ink-900 placeholder:text-ink-400 outline-none"
  />
  </div>
  </div>

  {/* WhatsApp row */}
  <div className="flex items-center gap-2">
  <span className="w-16 flex-shrink-0 text-right text-xs font-semibold text-ink-600">WhatsApp</span>
  <div className="flex h-9 flex-1 items-center gap-1.5 border border-ink-300 bg-white px-3 transition-colors focus-within:border-blood-600">
  <span className="font-mono text-xs text-ink-500">+91</span>
  <input
  id="contact-whatsapp-input"
  type="tel"
  inputMode="numeric"
  maxLength={10}
  value={waInput}
  onChange={e => setWaInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
  placeholder="10-digit WhatsApp"
  className="min-w-0 flex-1 bg-transparent font-mono text-xs tabular-nums text-ink-900 placeholder:text-ink-400 outline-none"
  />
  </div>
  </div>

  {error && (
  <p id="contact-banner-error" className="pl-[4.5rem] text-xs font-semibold text-blood-600">{error}</p>
  )}

  <div className="flex justify-end gap-2 pt-1">
  <button
  type="button"
  onClick={handleDismiss}
  className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-ink-600 transition-colors hover:text-ink-900"
  >
  Remind me later
  </button>
  <button
  id="contact-banner-save"
  type="submit"
  disabled={
  saving ||
  (!phoneInput && !waInput) ||
  (phoneInput.length > 0 && phoneInput.length < 10) ||
  (waInput.length > 0 && waInput.length < 10)
  }
  className="inline-flex h-8 cursor-pointer items-center gap-1.5 border border-ink-300 bg-white px-4 text-xs font-bold text-ink-900 transition-colors hover:border-ink-900 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
  >
  {saving ? (
  <>
  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-200 border-t-ink-900" />
  Saving...
  </>
  ) : (
  'Save'
  )}
  </button>
  </div>
  </form>
  )}
 </div>
 );
}
