// Shared onboarding Step 1 — Basic Profile — used by both the Donor and
// Requester wizards so contact/location/communication capture stays identical.
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ArrowRight, Bell, Loader2, MapPin, Phone, User } from 'lucide-react';
import { lookupPincode } from '../../types';
import { fetchMe, submitBasic } from '../../lib/rev3Auth';

interface OnboardingBasicStepProps {
  step: 1 | 2;
  totalSteps: 2;
  onNext: () => void;
}

export function OnboardingBasicStep({ step, totalSteps, onNext }: OnboardingBasicStepProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [pincode, setPincode] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [notificationChannel, setNotificationChannel] = useState<'whatsapp' | 'email' | 'both'>('both');

  const loadProfile = useCallback(async () => {
    try {
      const me = await fetchMe();
      const profile = me?.profile;
      if (!profile) return;
      setFullName(profile.full_name || '');
      setWhatsappPhone(profile.whatsapp_phone || profile.phone || '');
      if ((profile as any).notification_channel) {
        setNotificationChannel((profile as any).notification_channel);
      }
      if ((profile as any).pincode) setPincode((profile as any).pincode);
      if ((profile as any).area) setArea((profile as any).area);
      if ((profile as any).city) setCity((profile as any).city);
      if ((profile as any).district) setDistrict((profile as any).district);
      if ((profile as any).state) setState((profile as any).state);
    } catch { /* not signed in — form proceeds with blank fields */ }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await loadProfile();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [loadProfile]);

  const handlePincodeChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setPincode(cleaned);
    if (cleaned.length === 6) {
      const match = lookupPincode(cleaned);
      if (match) {
        if (match.area) setArea(match.area);
        if (match.city) setCity(match.city);
        if (match.district) setDistrict(match.district);
        setState('Delhi');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (whatsappPhone.trim()) {
      const cleanPhone = whatsappPhone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0+/, '');
      if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
        setError('Please enter a valid 10-digit Indian mobile number (starts with 6-9).');
        return;
      }
    }

    if (pincode.trim() && pincode.trim().length !== 6) {
      setError('PIN code must be exactly 6 digits.');
      return;
    }

    setSubmitting(true);
    try {
      await submitBasic({
        fullName: fullName.trim(),
        whatsappPhone: whatsappPhone.trim()
          ? whatsappPhone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0+/, '')
          : undefined,
        pincode: pincode.trim() || undefined,
        city: city.trim() || undefined,
        district: district.trim() || undefined,
        state: state.trim() || undefined,
        area: area.trim() || undefined,
        notificationChannel,
        verifyLater: true,
      });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save basic profile.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-ink-600">
          <Loader2 className="h-6 w-6 animate-spin text-blood-600" />
          <span className="font-medium text-sm">Preparing onboarding...</span>
        </div>
      </div>
    );
  }

  const progress = Math.round((step / totalSteps) * 100);

  return (
    <div className="min-h-[85vh] bg-[#FAFAFA] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md">
        {/* Progress Header */}
        <div className="mb-6 text-center">
          <div className="mb-2 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700">
          Step {step} of {totalSteps}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink-900 tracking-tight">
          Complete Your Profile
          </h1>
          <p className="text-sm text-ink-500 mt-1">
          Tell us a bit about yourself so emergency matches can reach you accurately.
          </p>
          <div className="mt-4 h-1.5 w-full bg-ink-100 overflow-hidden">
          <motion.div
          className="h-full bg-blood-600"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
          />
          </div>
        </div>

        {error && (
          <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-start gap-2.5 border border-blood-200 bg-blood-50 p-4 text-sm font-semibold text-blood-700"
          >
          <AlertCircle className="h-4 w-4 shrink-0 text-blood-600 mt-0.5" />
          <span>{error}</span>
          </motion.div>
        )}

        <motion.form
        key="step-basic"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-md border border-ink-200 bg-white p-6 sm:p-8 space-y-5"
        >
        {/* Full Name */}
        <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-700 mb-1.5 flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 text-blood-600" />
        Full Name <span className="text-blood-600">*</span>
        </label>
        <input
        type="text"
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="e.g. Rahul Sharma"
        className="h-11 w-full border border-ink-300 bg-white px-3 text-sm font-medium text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus:border-blood-600 focus:outline-none"
        />
        </div>

        {/* WhatsApp Number */}
        <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-700 mb-1.5 flex items-center gap-1.5">
        <Phone className="h-3.5 w-3.5 text-vital-600" />
        WhatsApp Phone Number
        </label>
        <input
        type="tel"
        value={whatsappPhone}
        onChange={(e) => setWhatsappPhone(e.target.value)}
        placeholder="10-digit mobile number"
        className="h-11 w-full border border-ink-300 bg-white px-3 text-sm font-medium text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus:border-blood-600 focus:outline-none"
        />
        <p className="text-[11px] text-ink-400 mt-1">
        Used for urgent donation and request notifications.
        </p>
        </div>

        {/* PIN Code & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-700 mb-1.5 flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 text-blood-600" />
        PIN Code
        </label>
        <input
        type="text"
        maxLength={6}
        value={pincode}
        onChange={(e) => handlePincodeChange(e.target.value)}
        placeholder="6-digit PIN"
        className="h-11 w-full border border-ink-300 bg-white px-3 text-sm font-medium text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus:border-blood-600 focus:outline-none"
        />
        </div>
        <div>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-700 mb-1.5">
        City / Region
        </label>
        <input
        type="text"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="Auto-resolved or type city"
        className="h-11 w-full border border-ink-300 bg-white px-3 text-sm font-medium text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus:border-blood-600 focus:outline-none"
        />
        </div>
        </div>

        {/* Notification Channel */}
        <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-700 mb-1.5 flex items-center gap-1.5">
        <Bell className="h-3.5 w-3.5 text-blood-600" />
        Preferred Communication Channel
        </label>
        <div className="grid grid-cols-3 gap-2">
        {(
        [
        { id: 'both', label: 'Both' },
        { id: 'whatsapp', label: 'WhatsApp' },
        { id: 'email', label: 'Email' },
        ] as const
        ).map((opt) => (
        <button
        key={opt.id}
        type="button"
        onClick={() => setNotificationChannel(opt.id)}
        className={`h-10 border text-xs font-bold transition-colors ${
        notificationChannel === opt.id
        ? 'border-blood-600 bg-blood-600 text-white'
        : 'border-ink-300 bg-white text-ink-600 hover:border-ink-900'
        }`}
        >
        {opt.label}
        </button>
        ))}
        </div>
        </div>

        <div className="pt-2">
        <button
        type="submit"
        disabled={submitting}
        className="w-full h-12 bg-blood-600 hover:bg-blood-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600 disabled:opacity-50 disabled:cursor-not-allowed select-none"
        >
        {submitting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
        <>
        <span>Continue</span>
        <ArrowRight className="h-4 w-4" />
        </>
        )}
        </button>
        </div>
        </motion.form>
      </div>
    </div>
  );
}