import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../lib/LanguageContext';
import { authenticatedApi } from '../../lib/api';
import { BloodType, AvailabilityStatus, lookupPincode, User } from '../../types';
import { Save, Heart, ChevronDown, MapPin, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

interface DonorProfileSettingsProps {
  currentUser: User | null;
  onLoginSuccess: (user: User) => void;
  onNavigate?: (view: string) => void;
}

const BLOOD_GROUPS: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

function toDisplay(stored: string | null): string {
  if (!stored) return '';
  const digits = stored.replace(/\D/g, '');
  return digits.startsWith('91') ? digits.slice(2) : digits;
}

export default function DonorProfileSettings({ currentUser, onLoginSuccess, onNavigate }: DonorProfileSettingsProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';

  if (!currentUser) {
    return (
      <div className="max-w-3xl mx-auto w-full py-12 text-center px-4">
        <p className="text-sm text-ink-600">{isHi ? 'कृपया साइन इन करें।' : 'Please sign in to manage your profile.'}</p>
        <button onClick={() => onNavigate?.('auth-signin')} className="mt-4 inline-flex h-11 items-center justify-center gap-2 bg-blood-600 text-white px-6 text-sm font-semibold hover:bg-blood-700">
          {isHi ? 'साइन इन करें' : 'Sign In'}
        </button>
      </div>
    );
  }

  // ── Step 1: Blood Group + Pincode (matching-critical) ──
  const [editBloodGroup, setEditBloodGroup] = useState<BloodType>(currentUser.blood_type || 'A+');
  const [editPincode, setEditPincode] = useState(currentUser.pincode || '');
  const [editArea, setEditArea] = useState(currentUser.area || '');
  const [editCity, setEditCity] = useState(currentUser.city || '');
  const [locationDerived, setLocationDerived] = useState<boolean>(() => {
    const pin = currentUser.pincode || '';
    return pin.length === 6 && !!lookupPincode(pin);
  });
  const [healthDeclaration, setHealthDeclaration] = useState(true);
  const [savingStep1, setSavingStep1] = useState(false);

  // ── Step 2: Phone / WhatsApp (optional) ──
  const [waInput, setWaInput] = useState(toDisplay((currentUser as any).whatsapp_number || null));
  const [contactSaving, setContactSaving] = useState(false);
  const [contactFeedback, setContactFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Step 3: Eligibility extras (optional) ──
  const [editWeightKg, setEditWeightKg] = useState<string>(currentUser.weight_kg != null ? String(currentUser.weight_kg) : '');
  const [weightError, setWeightError] = useState<string | null>(null);
  const [editAvail, setEditAvail] = useState<AvailabilityStatus>(currentUser.availability_status || 'available');
  const [editEmergency, setEditEmergency] = useState(Boolean(currentUser.emergency_only));
  const [savingStep3, setSavingStep3] = useState(false);

  // ── Progressive reveal state ──
  const step1Done = Boolean(currentUser.profile_complete);
  const [showStep3, setShowStep3] = useState(step1Done && Boolean((currentUser as any).phone || (currentUser as any).whatsapp_number));

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    setEditBloodGroup(currentUser.blood_type || 'A+');
    setEditPincode(currentUser.pincode || '');
    setEditArea(currentUser.area || '');
    setEditCity(currentUser.city || '');
    const pin = currentUser.pincode || '';
    setLocationDerived(pin.length === 6 && !!lookupPincode(pin));
    setEditWeightKg(currentUser.weight_kg != null ? String(currentUser.weight_kg) : '');
    setEditAvail(currentUser.availability_status || 'available');
    setEditEmergency(Boolean(currentUser.emergency_only));
    setWaInput(toDisplay((currentUser as any).whatsapp_number || null));
  }, [currentUser]);

  const handlePincodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pin = e.target.value.trim();
    setEditPincode(pin);
    if (pin.length === 6 && /^\d{6}$/.test(pin)) {
      const suggest = lookupPincode(pin);
      if (suggest) {
        setEditArea(suggest.area);
        setEditCity(suggest.city);
        setLocationDerived(true);
        return;
      }
    }
    setLocationDerived(false);
  };

  // Step 1 — Blood Group + Pincode → activate matching immediately
  const handleSaveStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!/^\d{6}$/.test(editPincode)) { showToast(isHi ? 'मान्य 6-अंकीय पिनकोड दर्ज करें।' : 'Enter a valid 6-digit pincode.', 'error'); return; }
    if (!editArea || !editCity) { showToast(isHi ? 'क्षेत्र और शहर आवश्यक हैं।' : 'Area and city are required.', 'error'); return; }
    if (!healthDeclaration) { showToast(isHi ? 'रक्तदान स्वास्थ्य घोषणा आवश्यक है।' : 'Health declaration is required.', 'error'); return; }
    setSavingStep1(true);
    try {
      await authenticatedApi('/api/donor-profile/complete', {
        blood_group: editBloodGroup,
        pincode: editPincode,
        area: editArea,
        city: editCity,
        last_donation_date: currentUser.last_donation_date ?? null,
        health_self_declaration: healthDeclaration,
        emergency_only: false,
        number_sharing_pref: currentUser.number_sharing_pref ?? 'on_approval',
      }, 'PATCH');
      const updatedUser: User = { ...currentUser, blood_type: editBloodGroup, pincode: editPincode, area: editArea, city: editCity, profile_complete: true, emergency_only: false, updated_at: new Date().toISOString() };
      onLoginSuccess(updatedUser);
      if (!showStep3) setShowStep3(true);
      showToast(isHi ? 'मिलान सक्रिय! अपनी प्रोफ़ाइल पूरी करते रहें।' : 'Matching active! Keep completing your profile.', 'success');
    } catch (err) {
      console.error(err);
      showToast(isHi ? 'सहेजने में विफल।' : 'Failed to save.', 'error');
    } finally {
      setSavingStep1(false);
    }
  };

  // Step 2 — Phone / WhatsApp (optional)
  const handleContactSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setContactFeedback(null);
    const waTrimmed = waInput.trim();
    if (!waTrimmed) { setContactFeedback({ msg: isHi ? 'WhatsApp नंबर दर्ज करें।' : 'Enter your WhatsApp number.', ok: false }); return; }
    if (waTrimmed.length < 10) { setContactFeedback({ msg: isHi ? 'वैध 10-अंकीय WhatsApp नंबर दर्ज करें।' : 'Enter a valid 10-digit WhatsApp number.', ok: false }); return; }
    const payload: { phone?: string; whatsappPhone?: string } = { phone: waTrimmed, whatsappPhone: waTrimmed };
    setContactSaving(true);
    try {
      const result = await authenticatedApi<{ success: boolean; phone: string | null; whatsapp_phone: string | null }>('/api/profile/contact', payload, 'PATCH');
      const updatedUser: User = { ...currentUser, phone: (result.phone as any) ?? waTrimmed, whatsapp_number: (result.whatsapp_phone as any) ?? waTrimmed, updated_at: new Date().toISOString() } as any;
      onLoginSuccess(updatedUser);
      setContactFeedback({ msg: isHi ? 'संपर्क जानकारी सहेजी गई!' : 'Contact info saved!', ok: true });
      setShowStep3(true);
      showToast(isHi ? 'संपर्क जानकारी अपडेट हुई।' : 'Contact info updated.', 'success');
    } catch (err: any) { setContactFeedback({ msg: err.message || (isHi ? 'सहेजना विफल।' : 'Save failed. Try again.'), ok: false }); }
    finally { setContactSaving(false); }
  };

  // Step 3 — Eligibility extras (optional)
  const validateWeight = (val: string): boolean => {
    if (!val || val.trim() === '') { setWeightError(null); return true; }
    const n = Number(val);
    if (val.trim() === '' || Number.isNaN(n)) { setWeightError(isHi ? 'वैध वज़न दर्ज करें।' : 'Enter a valid weight.'); return false; }
    if (!Number.isInteger(n)) { setWeightError(isHi ? 'वज़न पूर्ण संख्या में दर्ज करें (जैसे 68)।' : 'Enter a whole-number weight (e.g. 68).'); return false; }
    if (n < 45) { setWeightError(isHi ? 'वज़न कम से कम 45 किग्रा होना चाहिए।' : 'Weight must be at least 45 kg.'); return false; }
    if (n > 300) { setWeightError(isHi ? 'वज़न 300 किग्रा से अधिक नहीं हो सकता।' : 'Weight cannot exceed 300 kg.'); return false; }
    setWeightError(null); return true;
  };
  const handleWeightChange = (val: string) => {
    setEditWeightKg(val);
    if (val !== '') validateWeight(val); else setWeightError(null);
  };

  const handleSaveStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!validateWeight(editWeightKg)) { showToast(weightError || (isHi ? 'वज़न कम से कम 45 किग्रा होना चाहिए।' : 'Weight must be at least 45 kg.'), 'error'); return; }
    setSavingStep3(true);
    try {
      const weightNum = editWeightKg.trim() !== '' ? Number(editWeightKg) : undefined;
      const updatedUser: User = { ...currentUser, weight_kg: weightNum, availability_status: editAvail, emergency_only: editEmergency, profile_complete: true, updated_at: new Date().toISOString() };
      await authenticatedApi('/api/donor-profile/complete', {
        blood_group: editBloodGroup, pincode: editPincode, area: editArea, city: editCity, weight_kg: weightNum,
        last_donation_date: currentUser.last_donation_date ?? null,
        health_self_declaration: true,
        emergency_only: editEmergency,
        number_sharing_pref: currentUser.number_sharing_pref ?? 'on_approval',
      }, 'PATCH');
      try { await authenticatedApi('/api/donor-profile/availability', { isAvailable: editAvail === 'available' }, 'PATCH'); } catch (availErr) { console.error('Availability sync failed:', availErr); }
      onLoginSuccess(updatedUser);
      showToast(isHi ? 'प्रोफ़ाइल और सेटिंग्स सहेजी गईं।' : 'Profile and settings saved.', 'success');
    } catch (err) { console.error(err); showToast(isHi ? 'सहेजने में विफल।' : 'Failed to save.', 'error'); }
    finally { setSavingStep3(false); }
  };

  const finishLater = () => { if (onNavigate) onNavigate('donor-dashboard'); };

  const inputCls = "h-10 w-full border bg-white px-3 text-sm font-medium tabular-nums text-ink-900 placeholder:text-ink-400 outline-none transition-colors duration-150 focus:border-blood-600 border-ink-300";
  const labelCls = "block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500";

  return (
    <div id="donor-profile-settings" className="max-w-3xl mx-auto w-full min-w-0 space-y-4 animate-fade-in overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center bg-blood-600 text-white"><Heart className="w-4 h-4" /></div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-ink-900 leading-tight">{isHi ? 'प्रोफ़ाइल सेटिंग्स' : 'Profile Settings'}</h1>
          <p className="text-[11px] leading-snug text-ink-500 truncate">{isHi ? 'एक बार में एक कदम — मिलान जल्दी सक्रिय करें।' : 'One step at a time — get matching active fast.'}</p>
        </div>
      </div>

      {/* Role — plain inline label, not a form card */}
      <p className="flex items-center gap-1.5 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1 rounded bg-blood-50 px-2 py-0.5 text-[11px] font-bold text-blood-700">
          <Heart className="w-3 h-3" />{isHi ? 'डोनर' : 'Donor'}
        </span>
        <span className="text-ink-400">{isHi ? '· निश्चित भूमिका' : '· fixed role'}</span>
        <span className="mx-1 text-ink-300">|</span>
        <span className="truncate text-ink-500">{currentUser.full_name || currentUser.email}</span>
      </p>

      {/* ── Step 1: Blood Group + Pincode ── */}
      <div className="border border-ink-200 bg-white p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-[13px] tracking-wide text-ink-900">1. {isHi ? 'ब्लड ग्रुप और लोकेशन' : 'Blood Group & Location'}</h3>
          {step1Done && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blood-600"><CheckCircle2 className="w-3.5 h-3.5" />{isHi ? 'पूर्ण' : 'Done'}</span>}
        </div>
        <form onSubmit={handleSaveStep1} className="space-y-3 text-xs">
          <div className="space-y-1.5">
            <label className={labelCls}>Blood Group</label>
            {step1Done ? (
              <div className="h-10 w-full flex items-center border border-ink-200 bg-ink-50 px-3 text-sm font-semibold text-ink-900">{editBloodGroup || '—'}</div>
            ) : (
              <div className="relative">
                <select value={editBloodGroup} onChange={e => setEditBloodGroup(e.target.value as BloodType)} className="h-10 w-full appearance-none border border-ink-300 bg-white px-3 pr-9 text-sm font-semibold text-ink-900 outline-none transition-colors duration-150 focus:border-blood-600">
                  {BLOOD_GROUPS.map(bg => <option key={bg} value={bg} className="text-ink-900">{bg}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>{isHi ? 'पिनकोड *' : 'Pincode *'}</label>
            <input type="text" inputMode="numeric" maxLength={6} required value={editPincode} onChange={handlePincodeChange} className={inputCls} placeholder="110001" />
          </div>

          {locationDerived ? (
            <div className="space-y-1.5">
              <label className={labelCls}>City</label>
              <div className="h-10 w-full flex items-center gap-2 border border-ink-200 bg-ink-50 px-3 text-sm font-semibold text-ink-900">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-blood-600" />
                <span className="truncate">{editCity}</span>
                <span className="ml-auto text-[10px] font-medium text-ink-400 shrink-0">{isHi ? '(पिनकोड से)' : '(from pincode)'}</span>
              </div>
              <div className="mt-1.5">
                <label className={labelCls}>Area</label>
                <input type="text" value={editArea} onChange={e => setEditArea(e.target.value)} className={`${inputCls} mt-1.5`} placeholder="e.g. Connaught Place" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 min-w-0">
                <label className={labelCls}>Area</label>
                <input type="text" value={editArea} onChange={e => setEditArea(e.target.value)} className={inputCls} placeholder="e.g. Connaught Place" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <label className={labelCls}>City</label>
                <input type="text" value={editCity} onChange={e => setEditCity(e.target.value)} className={inputCls} placeholder="New Delhi" />
              </div>
            </div>
          )}

          <label className="flex gap-2.5 border border-ink-100 bg-ink-50 p-3 text-xs font-medium leading-relaxed text-ink-700 cursor-pointer">
            <input required type="checkbox" checked={healthDeclaration} onChange={e => setHealthDeclaration(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-blood-600 cursor-pointer" />
            <span className="min-w-0 text-[11px] leading-relaxed">{isHi ? 'मैं पुष्टि करता/करती हूँ कि मेरा वज़न कम से कम 45 किग्रा है, मैं 18-65 वर्ष का/की हूँ, और मैं रक्तदान के लिए पूर्णतः स्वस्थ हूँ।' : 'I confirm I am healthy to donate blood (weigh at least 45 kg, aged 18–65).'}</span></label>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button type="submit" disabled={savingStep1} className="flex min-h-[44px] flex-1 items-center justify-center gap-2 bg-blood-600 text-[13px] font-bold text-white transition-colors hover:bg-blood-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
              <Save className="w-4 h-4 shrink-0" />{savingStep1 ? (isHi ? 'सहेजा जा रहा है...' : 'Saving...') : (isHi ? 'सहेजें और मिलान सक्रिय करें →' : 'Save & Start Matching →')}
            </button>
            {!step1Done && (
              <button type="button" onClick={finishLater} className="flex min-h-[44px] items-center justify-center gap-1.5 border border-ink-300 bg-white px-4 text-xs font-bold text-ink-700 transition-colors hover:border-ink-900 hover:bg-ink-50 cursor-pointer">
                {isHi ? 'बाद में करें' : 'Finish later'}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Step 2: Phone / WhatsApp (optional) ── */}
      {step1Done && (
        <div className="border border-ink-200 bg-white p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-[13px] tracking-wide text-ink-900">2. {isHi ? 'संपर्क जानकारी' : 'Contact (Phone / WhatsApp)'}</h3>
            {contactFeedback?.ok && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blood-600"><CheckCircle2 className="w-3.5 h-3.5" />{isHi ? 'पूर्ण' : 'Done'}</span>}
          </div>
          <p className="-mt-1 text-[11px] leading-snug text-ink-500">{isHi ? 'मैच अलर्ट के लिए अनुशंसित। बाद में भी जोड़ सकते हैं।' : 'Recommended for match alerts. You can add this later.'}</p>
          <form onSubmit={handleContactSave} className="space-y-3 text-xs" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="settings-whatsapp" className={labelCls}>{isHi ? 'WhatsApp नंबर' : 'WhatsApp Number'}</label>
              <div className="flex h-10 items-center gap-2 border border-ink-300 bg-white px-3 transition-colors duration-150 focus-within:border-blood-600 min-w-0">
                <span className="border-r border-ink-200 pr-2 font-mono text-xs text-ink-500 shrink-0">+91</span>
                <input id="settings-whatsapp" type="tel" inputMode="numeric" maxLength={10} value={waInput} onChange={e => setWaInput(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit WhatsApp number" className="flex-1 min-w-0 bg-transparent font-mono text-sm font-medium tabular-nums text-ink-900 placeholder:text-ink-400 outline-none" />
              </div>
            </div>
            {contactFeedback && (<p className={`text-[11px] font-semibold leading-snug break-words ${contactFeedback.ok ? 'text-blood-600' : 'text-blood-600'}`}>{contactFeedback.ok ? '✓ ' : '⚠ '}{contactFeedback.msg}</p>)}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button type="submit" disabled={contactSaving || !waInput || (waInput.length > 0 && waInput.length < 10)} className="flex min-h-[44px] flex-1 items-center justify-center gap-2 bg-blood-600 text-[13px] font-semibold text-white transition-colors hover:bg-blood-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
                <Save className="w-4 h-4 shrink-0" />{contactSaving ? 'Saving...' : 'Save Contact Info'}
              </button>
              <button type="button" onClick={finishLater} className="flex min-h-[44px] items-center justify-center gap-1.5 border border-ink-300 bg-white px-4 text-xs font-bold text-ink-700 transition-colors hover:border-ink-900 hover:bg-ink-50 cursor-pointer">
                {isHi ? 'बाद में करें' : 'Finish later'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Step 3: Eligibility extras (optional) ── */}
      {showStep3 && (
        <div className="border border-ink-200 bg-white p-4 sm:p-5 space-y-3">
          <h3 className="font-semibold text-[13px] tracking-wide text-ink-900">3. {isHi ? 'पात्रता (स्वैच्छिक)' : 'Eligibility (optional)'}</h3>
          <form onSubmit={handleSaveStep3} className="space-y-3 text-xs" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="inp-edit-weight" className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                <span>Weight (KG) <span className="normal-case font-medium tracking-normal text-ink-400">· Min 45 KG</span></span>
                <span className="inline-flex shrink-0 items-center border border-blood-500/30 bg-blood-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-blood-600 leading-none">NBTC</span>
              </label>
              <div className="relative">
                <input id="inp-edit-weight" type="number" inputMode="numeric" min={45} max={300} step={1} placeholder="e.g. 68" value={editWeightKg} onChange={e => handleWeightChange(e.target.value)} onBlur={e => validateWeight(e.target.value)} aria-invalid={!!weightError} className={`h-10 w-full border bg-white pl-3 pr-12 text-sm font-medium tabular-nums outline-none transition-colors duration-150 placeholder:text-ink-400 ${weightError ? 'border-blood-500 focus:border-blood-600 bg-blood-50/50 text-ink-900' : 'border-ink-300 text-ink-900 focus:border-blood-600'}`} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold tracking-wide text-ink-500">KG</span>
              </div>
              {weightError ? (<p className="flex items-start gap-1.5 text-[11px] font-medium leading-snug text-blood-600"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{weightError}</span></p>) : (<p className="text-[10px] leading-snug text-ink-500">Must be 45 KG or above for eligibility.</p>)}
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Availability Status</label>
              <div className="relative">
                <select value={editAvail} onChange={e => setEditAvail(e.target.value as AvailabilityStatus)} className="h-10 w-full appearance-none border border-ink-300 bg-white px-3 pr-9 text-sm font-semibold text-ink-900 outline-none transition-colors duration-150 focus:border-blood-600">
                  <option value="available" className="text-ink-900">Available Now</option><option value="available_with_notice" className="text-ink-900">Available with Notice</option><option value="unavailable" className="text-ink-900">Temporarily Unavailable</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border border-ink-200 bg-ink-50 p-3">
              <div className="space-y-0.5 min-w-0"><span className="text-[12px] font-semibold text-ink-900">Emergency Only</span><p className="text-[10px] leading-snug text-ink-500">Only notify on critical requests</p></div>
              <input type="checkbox" checked={editEmergency} onChange={e => setEditEmergency(e.target.checked)} className="h-4 w-4 shrink-0 accent-blood-600 cursor-pointer" />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button type="submit" disabled={savingStep3} className="flex min-h-[44px] flex-1 items-center justify-center gap-2 bg-blood-600 text-[13px] font-semibold text-white transition-colors hover:bg-blood-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
                <Save className="w-4 h-4 shrink-0" />{savingStep3 ? 'Saving...' : 'Save Settings'}
              </button>
              <button type="button" onClick={finishLater} className="flex min-h-[44px] items-center justify-center gap-1.5 border border-ink-300 bg-white px-4 text-xs font-bold text-ink-700 transition-colors hover:border-ink-900 hover:bg-ink-50 cursor-pointer">
                <ArrowRight className="w-3.5 h-3.5" />{isHi ? 'डैशबोर्ड' : 'Dashboard'}
              </button>
            </div>
          </form>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 left-4 sm:left-auto z-[100] border-l-[3px] bg-ink-950 p-3 pr-4 text-[13px] font-medium text-white flex items-center gap-2.5 animate-fade-in shadow-lg max-w-[calc(100vw-2rem)] sm:max-w-md ${toast.type === 'error' ? 'border-blood-500' : 'border-blood-500'}`}>
          <span className="break-words">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
