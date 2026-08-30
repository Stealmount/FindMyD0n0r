import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../lib/LanguageContext';
import { authenticatedApi } from '../../lib/api';
import { lookupPincode } from '../../types';
import { Save, MapPin, Bell, User, Mail, UserCheck } from 'lucide-react';

interface RequesterSettingsPanelProps {
  currentRequester: {
    full_name: string;
    email: string;
    phone?: string | null;
    whatsapp_number?: string | null;
  };
  savedLocation?: { pincode?: string | null; area?: string | null; city?: string | null } | null;
  onSaved?: () => void;
}

const NOTIFICATION_OPTIONS = [
  { id: 'both' as const, label: 'Both', hi: 'दोनों' },
  { id: 'whatsapp' as const, label: 'WhatsApp', hi: 'WhatsApp' },
  { id: 'email' as const, label: 'Email', hi: 'ईमेल' },
] as const;

function toDisplay(stored: string | null | undefined): string {
  if (!stored) return '';
  const digits = stored.replace(/\D/g, '');
  return digits.startsWith('91') ? digits.slice(2) : digits;
}

export default function RequesterSettingsPanel({ currentRequester, savedLocation, onSaved }: RequesterSettingsPanelProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';

  // ── Contact state ──
  const [waInput, setWaInput] = useState(toDisplay(currentRequester.whatsapp_number || currentRequester.phone));
  const [contactSaving, setContactSaving] = useState(false);
  const [contactFeedback, setContactFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Location state ──
  const [pincode, setPincode] = useState(savedLocation?.pincode ?? '');
  const [area, setArea] = useState(savedLocation?.area ?? '');
  const [city, setCity] = useState(savedLocation?.city ?? '');
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Notification state ──
  const [notificationChannel, setNotificationChannel] = useState<'whatsapp' | 'email' | 'both'>('both');
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifFeedback, setNotifFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  // Sync prop changes
  useEffect(() => {
    setWaInput(toDisplay(currentRequester.whatsapp_number || currentRequester.phone));
  }, [currentRequester.phone, currentRequester.whatsapp_number]);

  // ── Pincode auto-resolve ──
  const handlePincodeChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setPincode(cleaned);
    if (cleaned.length === 6) {
      const match = lookupPincode(cleaned);
      if (match) {
        setArea(match.area);
        setCity(match.city);
      }
    }
  };

  // ── Save Contact (single WhatsApp field → dual-writes phone + whatsappPhone) ──
  const handleContactSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactFeedback(null);
    const waTrimmed = waInput.trim();

    if (!waTrimmed) {
      setContactFeedback({ msg: isHi ? 'WhatsApp नंबर दर्ज करें।' : 'Enter a WhatsApp number.', ok: false });
      return;
    }
    if (waTrimmed.length < 10) {
      setContactFeedback({ msg: isHi ? 'वैध 10-अंकीय WhatsApp नंबर दर्ज करें।' : 'Enter a valid 10-digit WhatsApp number.', ok: false });
      return;
    }

    setContactSaving(true);
    try {
      await authenticatedApi('/api/profile/contact', { phone: waTrimmed, whatsappPhone: waTrimmed }, 'PATCH');
      setContactFeedback({ msg: isHi ? 'संपर्क जानकारी सहेजी गई!' : 'Contact info saved!', ok: true });
      onSaved?.();
    } catch (err: any) {
      setContactFeedback({ msg: err.message || (isHi ? 'सहेजना विफल।' : 'Save failed. Try again.'), ok: false });
    } finally {
      setContactSaving(false);
    }
  };

  // ── Save Location ──
  const handleLocationSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocationFeedback(null);
    if (!pincode || pincode.length < 6) {
      setLocationFeedback({ msg: isHi ? 'वैध 6-अंकीय पिनकोड दर्ज करें।' : 'Enter a valid 6-digit pincode.', ok: false });
      return;
    }

    setLocationSaving(true);
    try {
      await authenticatedApi('/api/onboarding/basic', {
        pincode,
        area,
        city,
      }, 'POST');
      setLocationFeedback({ msg: isHi ? 'स्थान अपडेट किया गया!' : 'Location updated!', ok: true });
      onSaved?.();
    } catch (err: any) {
      setLocationFeedback({ msg: err.message || (isHi ? 'सहेजना विफल।' : 'Save failed. Try again.'), ok: false });
    } finally {
      setLocationSaving(false);
    }
  };

  // ── Save Notification Preference ──
  const handleNotifSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifFeedback(null);
    setNotifSaving(true);
    try {
      await authenticatedApi('/api/onboarding/basic', {
        notificationChannel,
      }, 'POST');
      setNotifFeedback({ msg: isHi ? 'सूचना सेटिंग सहेजी गई!' : 'Notification preference saved!', ok: true });
      onSaved?.();
    } catch (err: any) {
      setNotifFeedback({ msg: err.message || (isHi ? 'सहेजना विफल।' : 'Save failed. Try again.'), ok: false });
    } finally {
      setNotifSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Role identity (read-only) ── */}
      <div className="border border-ink-200 bg-white p-6 sm:p-7 space-y-3">
        <h3 className="border-b border-ink-100 pb-4 font-semibold text-[14px] tracking-wide text-ink-900">
          {isHi ? 'आपकी भूमिका' : 'Your Role'}
        </h3>
        <div className="space-y-3 text-xs">
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              <UserCheck className="w-3.5 h-3.5 text-blood-400" />
              {isHi ? 'भूमिका' : 'Role'}
            </label>
            <div className="h-11 w-full border border-ink-200 bg-ink-50 px-3.5 flex items-center gap-2 text-sm font-bold text-ink-900">
              <span className="text-blood-400">{isHi ? 'अनुरोधकर्ता' : 'Requester'}</span>
              <span className="text-[10px] font-medium text-ink-500">{isHi ? '(निश्चित भूमिका)' : '(fixed role)'}</span>
            </div>
          </div>
          <div className="rounded border border-ink-100 bg-ink-50 p-3 text-[11px] leading-relaxed text-ink-500">
            {isHi
              ? 'आपके खाते की भूमिका निर्धारित है और इसे डोनर में नहीं बदला जा सकता। अनुरोधकर्ता एवं डोनर अलग-अलग भूमिकाएँ हैं।'
              : 'Your account role is fixed and cannot be changed to Donor. Requester and Donor are separate, exclusive roles.'}
          </div>
        </div>
      </div>

      {/* ── Profile Info (read-only) ── */}
      <div className="border border-ink-200 bg-white p-6 sm:p-7 space-y-4">
        <h3 className="border-b border-ink-100 pb-4 font-semibold text-[14px] tracking-wide text-ink-900">
          {isHi ? 'प्रोफ़ाइल जानकारी' : 'Profile Info'}
        </h3>
        <div className="space-y-3 text-xs">
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              <User className="w-3.5 h-3.5" />
              {isHi ? 'पूरा नाम' : 'Full Name'}
            </label>
            <div className="h-11 w-full border border-ink-200 bg-ink-50 px-3.5 flex items-center text-sm font-medium text-ink-600">
              {currentRequester.full_name || '—'}
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              <Mail className="w-3.5 h-3.5" />
              {isHi ? 'ईमेल' : 'Email'}
            </label>
            <div className="h-11 w-full border border-ink-200 bg-ink-50 px-3.5 flex items-center text-sm font-medium text-ink-600">
              {currentRequester.email || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Contact Info (editable) ── */}
      <div className="border border-ink-200 bg-white p-6 sm:p-7 space-y-4">
        <h3 className="border-b border-ink-100 pb-4 font-semibold text-[14px] tracking-wide text-ink-900">
          {isHi ? 'WhatsApp नंबर' : 'WhatsApp Number'}
        </h3>
        <p className="-mt-2 text-[11px] text-ink-500">
          {isHi ? 'WhatsApp मैच अलर्ट के लिए उपयोग किया जाता है।' : 'Used for WhatsApp match alerts. Keep this up to date.'}
        </p>
        <form onSubmit={handleContactSave} className="space-y-4 text-xs">
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              WhatsApp {isHi ? 'नंबर' : 'Number'}
            </label>
            <div className="flex h-12 items-center gap-2 border border-ink-300 bg-white text-ink-900 px-3.5 transition-colors duration-150 focus-within:border-blood-600">
              <span className="border-r border-ink-200 px-2 font-mono text-xs text-ink-500">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={waInput}
                onChange={e => setWaInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder={isHi ? '10-अंकीय WhatsApp नंबर' : '10-digit WhatsApp number'}
                className="flex-1 bg-transparent font-mono text-sm font-medium tabular-nums text-ink-900 placeholder:text-ink-400 outline-none"
              />
            </div>
          </div>

          {contactFeedback && (
            <p className={`text-[11px] font-semibold ${contactFeedback.ok ? 'text-blood-600' : 'text-blood-400'}`}>
              {contactFeedback.ok ? '\u2713 ' : '\u26a0 '}{contactFeedback.msg}
            </p>
          )}

          <button
            type="submit"
            disabled={
              contactSaving ||
              !waInput ||
              (waInput.length > 0 && waInput.length < 10)
            }
            className="flex h-12 w-full items-center justify-center gap-2 bg-blood-600 text-[13px] font-semibold text-white transition-colors hover:bg-blood-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {contactSaving
              ? (isHi ? 'सहेजा जा रहा है...' : 'Saving...')
              : (isHi ? 'संपर्क जानकारी सहेजें' : 'Save Contact Info')}
          </button>
        </form>
      </div>

      {/* ── Location (editable) ── */}
      <div className="border border-ink-200 bg-white p-6 sm:p-7 space-y-4">
        <h3 className="flex items-center gap-2 border-b border-ink-100 pb-4 font-semibold text-[14px] tracking-wide text-ink-900">
          <MapPin className="w-4 h-4 text-blood-400" />
          {isHi ? 'स्थान' : 'Location'}
        </h3>
        <form onSubmit={handleLocationSave} className="space-y-4 text-xs">
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              {isHi ? 'पिनकोड (6-अंकीय)' : 'Pincode (6-digit)'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={e => handlePincodeChange(e.target.value)}
              placeholder="e.g. 110001"
              className="h-11 w-full border border-ink-300 bg-white px-3.5 font-mono text-sm font-medium tabular-nums text-ink-900 placeholder:text-ink-400 outline-none transition-colors duration-150 focus:border-blood-600 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                {isHi ? 'क्षेत्र' : 'Area'}
              </label>
              <input
                type="text"
                value={area}
                onChange={e => setArea(e.target.value)}
                className="h-11 w-full border border-ink-300 bg-white px-3.5 text-sm font-medium text-ink-900 outline-none transition-colors duration-150 focus:border-blood-600 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                {isHi ? 'शहर' : 'City'}
              </label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="h-11 w-full border border-ink-300 bg-white px-3.5 text-sm font-medium text-ink-900 outline-none transition-colors duration-150 focus:border-blood-600 focus:outline-none"
              />
            </div>
          </div>

          {locationFeedback && (
            <p className={`text-[11px] font-semibold ${locationFeedback.ok ? 'text-blood-600' : 'text-blood-400'}`}>
              {locationFeedback.ok ? '\u2713 ' : '\u26a0 '}{locationFeedback.msg}
            </p>
          )}

          <button
            type="submit"
            disabled={locationSaving || !pincode || pincode.length < 6}
            className="flex h-12 w-full items-center justify-center gap-2 bg-blood-600 text-[13px] font-semibold text-white transition-colors hover:bg-blood-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {locationSaving
              ? (isHi ? 'सहेजा जा रहा है...' : 'Saving...')
              : (isHi ? 'स्थान सहेजें' : 'Save Location')}
          </button>
        </form>
      </div>

      {/* ── Notification Preferences ── */}
      <div className="border border-ink-200 bg-white p-6 sm:p-7 space-y-4">
        <h3 className="flex items-center gap-2 border-b border-ink-100 pb-4 font-semibold text-[14px] tracking-wide text-ink-900">
          <Bell className="w-4 h-4 text-blood-400" />
          {isHi ? 'सूचना प्राथमिकताएँ' : 'Notification Preferences'}
        </h3>
        <form onSubmit={handleNotifSave} className="space-y-4 text-xs">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              {isHi ? 'पसंदीदा संचार चैनल' : 'Preferred Communication Channel'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {NOTIFICATION_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setNotificationChannel(opt.id)}
                  className={`h-10 border text-xs font-bold transition-colors ${
                    notificationChannel === opt.id
                      ? 'border-blood-500 bg-blood-600 text-white'
                      : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900'
                  }`}
                >
                  {isHi ? opt.hi : opt.label}
                </button>
              ))}
            </div>
          </div>

          {notifFeedback && (
            <p className={`text-[11px] font-semibold ${notifFeedback.ok ? 'text-blood-600' : 'text-blood-400'}`}>
              {notifFeedback.ok ? '\u2713 ' : '\u26a0 '}{notifFeedback.msg}
            </p>
          )}

          <button
            type="submit"
            disabled={notifSaving}
            className="flex h-12 w-full items-center justify-center gap-2 bg-blood-600 text-[13px] font-semibold text-white transition-colors hover:bg-blood-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {notifSaving
              ? (isHi ? 'सहेजा जा रहा है...' : 'Saving...')
              : (isHi ? 'सूचना सेटिंग सहेजें' : 'Save Notification Preference')}
          </button>
        </form>
      </div>
    </div>
  );
}
