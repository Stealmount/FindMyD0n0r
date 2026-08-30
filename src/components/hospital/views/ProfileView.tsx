// Profile & Verification — Part C. Shows verification status, immutable identity
// (as decided by the admin review) and editable contact fields. Saving calls
// PATCH /api/institutions/me (verified-only on the backend) then refreshes the
// session so AuthContext re-resolves /api/auth/me with the updated institution.
import React, { useState } from 'react';
import { AlertCircle, BadgeCheck, Clock, Loader2, Lock, Save, ShieldAlert, X } from 'lucide-react';
import { useAuth } from '../../../lib/AuthContext';
import { updateInstitution } from '../../../lib/rev3Auth';
import { HospitalUser } from '../../../types';

interface ProfileViewProps {
  hospital: HospitalUser;
  isHi: boolean;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function ProfileView({ hospital, isHi }: ProfileViewProps) {
  const auth = useAuth();

  const toDisplayPhone = (p: string) => {
    const digits = p.replace(/\D/g, '');
    return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  };

  const [contactPerson, setContactPerson] = useState(hospital.admin_name || '');
  const [phone, setPhone] = useState(toDisplayPhone(hospital.phone || ''));
  const [address, setAddress] = useState(hospital.address || '');
  const [city, setCity] = useState(hospital.city || '');
  const [pincode, setPincode] = useState(hospital.pincode || '');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState('');

  const typeLabel = () => {
    const t = hospital.institution_type;
    if (t === 'blood_bank') return isHi ? 'रक्त बैंक' : 'Blood Bank';
    if (t === 'ngo') return isHi ? 'एनजीओ' : 'NGO';
    if (t === 'other') return isHi ? 'अन्य' : 'Other';
    return isHi ? 'अस्पताल' : 'Hospital';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError(isHi ? 'मान्य 10-अंकीय मोबाइल नंबर दर्ज करें (6-9 से शुरू)।' : 'Enter a valid 10-digit mobile number (starting 6-9).');
      return;
    }
    if (!pincode || !/^\d{6}$/.test(pincode)) {
      setError(isHi ? 'मान्य 6-अंकीय पिनकोड दर्ज करें।' : 'Enter a valid 6-digit pincode.');
      return;
    }
    if (!city.trim()) {
      setError(isHi ? 'शहर आवश्यक है।' : 'City is required.');
      return;
    }

    setSaveState('saving');
    try {
      await updateInstitution({
        contactPerson: contactPerson.trim(),
        phone,
        address: address.trim() || undefined,
        city: city.trim(),
        pincode,
      });
      try { await auth.refreshSession(); } catch { /* AuthContext effect also resolves it */ }
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
    } catch (err: any) {
      setSaveState('error');
      setError(err?.message || (isHi ? 'सहेजना विफल। पुनः प्रयास करें।' : 'Failed to save. Please try again.'));
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  const statusBanner = () => {
    const s = hospital.status;
    if (s === 'verified') {
      return (
        <div className="flex items-start gap-3 border border-vital-500/30 bg-vital-500/10 p-4">
          <BadgeCheck className="h-5 w-5 shrink-0 text-vital-400" />
          <div>
            <div className="text-sm font-bold text-vital-400">{isHi ? 'सत्यापित' : 'Verified'}</div>
            <p className="text-[11px] text-ink-400 mt-0.5">
              {isHi ? 'यह संस्था सत्यापित है और पूरी कार्यक्षमता का उपयोग कर सकती है।' : 'This institution is verified and fully active.'}
            </p>
          </div>
        </div>
      );
    }
    if (s === 'pending') {
      return (
        <div className="flex items-start gap-3 border border-amber-500/30 bg-amber-500/10 p-4">
          <Clock className="h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <div className="text-sm font-bold text-amber-400">{isHi ? 'समीक्षाधीन' : 'Pending Review'}</div>
            <p className="text-[11px] text-ink-400 mt-0.5">
              {isHi ? 'आवेदन हमारी टीम द्वारा समीक्षा में है।' : 'Your application is under review by the admin team.'}
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-3 border border-blood-500/30 bg-blood-500/10 p-4">
        <ShieldAlert className="h-5 w-5 shrink-0 text-blood-400" />
        <div>
          <div className="text-sm font-bold text-blood-400">{isHi ? 'अस्वीकृत' : 'Rejected'}</div>
          <p className="text-[11px] text-ink-400 mt-0.5">
            {isHi ? 'आवेदन अनुमोदित नहीं हुआ। पुनः पंजीकरण करें या सहायता से संपर्क करें।' : 'Your application was not approved. Please re-register or contact support.'}
          </p>
        </div>
      </div>
    );
  };

  const readField = 'w-full border border-ink-700/50 bg-ink-800/50 px-3 py-2 text-sm text-white/70';
  const inputClass =
    'w-full h-11 border border-ink-700 bg-ink-800 px-3.5 text-sm font-medium text-white outline-none transition-colors duration-150 placeholder:text-ink-500 focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500';
  const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400 block';

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">
          {isHi ? 'प्रोफ़ाइल और सत्यापन' : 'Profile & Verification'}
        </h2>
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink-500">{typeLabel()}</span>
      </div>

      {statusBanner()}

      {/* Identity — locked after admin approval */}
      <div className="border border-ink-800 bg-ink-900 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-ink-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400">
            {isHi ? 'पहचान विवरण (बदलने योग्य नहीं)' : 'Identity Details (locked)'}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>{isHi ? 'संस्था का नाम' : 'Institution Name'}</label>
            <div className={readField}>{hospital.hospital_name || '—'}</div>
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>{isHi ? 'रजिस्ट्रेशन / लाइसेंस नंबर' : 'Registration / License Number'}</label>
            <div className={`${readField} font-mono`}>{hospital.registration_number || '—'}</div>
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>{isHi ? 'ईमेल' : 'Email'}</label>
            <div className={readField}>{hospital.email || '—'}</div>
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>{isHi ? 'प्रकार' : 'Type'}</label>
            <div className={readField}>{typeLabel()}</div>
          </div>
        </div>
      </div>

      {/* Contact — editable, saved against the institution */}
      <form onSubmit={handleSave} className="border border-ink-800 bg-ink-900 p-5 sm:p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400">
          {isHi ? 'संपर्क विवरण' : 'Contact Details'}
        </h3>

        {error && (
          <div role="alert" className="flex items-center gap-3 border border-blood-500/30 bg-blood-500/10 p-3 text-sm font-semibold text-blood-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>{isHi ? 'संपर्क व्यक्ति' : 'Contact Person'}</label>
            <input type="text" required value={contactPerson} onChange={e => setContactPerson(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>{isHi ? 'मोबाइल नंबर' : 'Mobile Number'}</label>
            <input type="tel" required inputMode="numeric" maxLength={10} value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              className={`${inputClass} font-mono`} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>{isHi ? 'शहर' : 'City'}</label>
            <input type="text" required value={city} onChange={e => setCity(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>{isHi ? 'पिनकोड' : 'Pincode'}</label>
            <input type="text" required inputMode="numeric" maxLength={6} value={pincode}
              onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`${inputClass} font-mono`} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className={labelClass}>{isHi ? 'पता' : 'Address'}</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder={isHi ? 'पते की पहली पंक्ति' : 'Street address'}
              className={inputClass} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-ink-500 max-w-xs leading-relaxed">
            {isHi
              ? 'संस्था का नाम, रजिस्ट्रेशन नंबर और ईमेल सत्यापन के बाद नहीं बदले जा सकते।'
              : 'Institution name, registration number and email are locked after verification.'}
          </p>
          <div className="flex items-center gap-3">
            {saveState === 'saved' && (
              <span className="flex items-center gap-1.5 text-vital-400 text-xs font-semibold">
                <BadgeCheck className="w-3.5 h-3.5" /> {isHi ? 'सहेजा गया' : 'Saved'}
              </span>
            )}
            {saveState === 'error' && (
              <span className="flex items-center gap-1.5 text-blood-400 text-xs font-semibold">
                <X className="w-3.5 h-3.5" /> {isHi ? 'त्रुटि' : 'Error'}
              </span>
            )}
            <button type="submit" disabled={saveState === 'saving'}
              className="inline-flex items-center gap-2 border border-blood-600 bg-blood-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-blood-700 disabled:opacity-50 cursor-pointer">
              <Save className="w-3.5 h-3.5" />
              {saveState === 'saving'
                ? (isHi ? 'सहेज रहे हैं...' : 'Saving...')
                : (isHi ? 'सहेजें' : 'Save Changes')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}