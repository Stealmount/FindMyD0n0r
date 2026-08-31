import React, { useState, useEffect } from 'react';
import { BloodType, UrgencyLevel, lookupPincode, Requester } from '../types';
import { authenticatedApi } from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import { Megaphone, Save, ShieldAlert } from 'lucide-react';

interface RequestFormProps {
  onSuccess: (trackingCode: string) => void;
  loggedInRequester?: Requester | null;
  onNavigate?: (view: any) => void;
}

const BLOOD_TYPES: (BloodType | 'ANY')[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'ANY'];

export default function RequestForm({ onSuccess, loggedInRequester, onNavigate }: RequestFormProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';

  const [formData, setFormData] = useState({
    patient_name: '',
    patient_age: '' as unknown as number,
    blood_type_needed: '' as BloodType | 'ANY',
    units_required: 1 as unknown as number,
    hospital_name: '',
    hospital_pincode: '',
    hospital_area: '',
    hospital_city: '',
    urgency_level: 'urgent' as UrgencyLevel,
    requester_phone: '',
    additional_notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (loggedInRequester) {
      setFormData(prev => ({
        ...prev,
        requester_phone: prev.requester_phone || loggedInRequester.phone || '',
      }));
    }
  }, [loggedInRequester]);

  const setFieldError = (field: string, msg: string) => {
    setFieldErrors(prev => ({ ...prev, [field]: msg }));
  };

  const clearErrors = () => {
    setError('');
    setFieldErrors({});
  };

  const handlePincodeChange = (pin: string) => {
    setFormData(prev => ({ ...prev, hospital_pincode: pin }));
    if (pin.length === 6 && /^\d{6}$/.test(pin)) {
      const suggest = lookupPincode(pin);
      if (suggest) {
        setFormData(prev => ({
          ...prev,
          hospital_area: suggest.area,
          hospital_city: suggest.city,
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (!loggedInRequester) {
      if (onNavigate) {
        onNavigate('requester-register');
      } else {
        setError(isHi ? 'कृपया अनुरोध भेजने के लिए साइन इन करें।' : 'Please sign in to broadcast requests.');
      }
      return;
    }

    let hasError = false;

    if (!formData.blood_type_needed) {
      setFieldError('blood_type_needed', isHi ? 'रक्त समूह चुनें' : 'Select a blood group');
      hasError = true;
    }
    if (!formData.units_required || formData.units_required < 1 || formData.units_required > 5) {
      setFieldError('units_required', isHi ? '1-5 यूनिट दर्ज करें' : 'Enter 1-5 units');
      hasError = true;
    }
    if (!formData.patient_name.trim()) {
      setFieldError('patient_name', isHi ? 'मरीज का नाम दर्ज करें' : 'Enter patient name');
      hasError = true;
    }
    if (!formData.patient_age || Number(formData.patient_age) < 1 || Number(formData.patient_age) >= 120) {
      setFieldError('patient_age', isHi ? 'वैध आयु दर्ज करें (1-119)' : 'Enter valid age (1-119)');
      hasError = true;
    }
    if (!formData.hospital_name.trim()) {
      setFieldError('hospital_name', isHi ? 'अस्पताल का नाम दर्ज करें' : 'Enter hospital name');
      hasError = true;
    }
    if (!formData.hospital_area.trim()) {
      setFieldError('hospital_area', isHi ? 'इलाका दर्ज करें' : 'Enter area / locality');
      hasError = true;
    }
    if (!formData.hospital_pincode || !/^\d{6}$/.test(formData.hospital_pincode)) {
      setFieldError('hospital_pincode', isHi ? '6 अंकों का पिनकोड दर्ज करें' : 'Pincode must be 6 digits');
      hasError = true;
    }
    if (!formData.hospital_city.trim()) {
      setFieldError('hospital_city', isHi ? 'शहर दर्ज करें' : 'Enter city');
      hasError = true;
    }
    if (!formData.requester_phone || formData.requester_phone.replace(/\D/g, '').length !== 10) {
      setFieldError('requester_phone', isHi ? '10 अंकों का फोन नंबर दर्ज करें' : 'Enter a valid 10-digit phone number');
      hasError = true;
    }

    if (hasError) {
      const firstErrorField = Object.keys(fieldErrors)[0] || Object.keys(formData).find(k => {
        const v = formData[k as keyof typeof formData];
        return !v || (typeof v === 'string' && !v.trim());
      });
      if (firstErrorField) {
        const el = document.getElementById(`field-${firstErrorField}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setLoading(true);
    try {
      const response = await authenticatedApi<{ trackingCode: string }>('/api/requests', {
        ...formData,
        patient_gender: 'Other',
        component_needed: 'Whole Blood (WB)',
        hospital_uhid: '',
        attending_doctor: '',
        requester_name: loggedInRequester?.full_name || '',
        requester_email: loggedInRequester?.email || '',
        status: 'broadcasting',
        showcase_opt_in: false,
        share_contact_immediately: false,
      });
      onSuccess(response.trackingCode);
    } catch (err: any) {
      console.error(err);
      setError(err.message || (isHi ? 'अनुरोध भेजने में विफल। कृपया पुनः प्रयास करें।' : 'Failed to broadcast request. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    clearErrors();
    setLoading(true);
    try {
      const response = await authenticatedApi<{ trackingCode: string }>('/api/requests', {
        ...formData,
        patient_gender: 'Other',
        component_needed: 'Whole Blood (WB)',
        hospital_uhid: '',
        attending_doctor: '',
        requester_name: loggedInRequester?.full_name || '',
        requester_email: loggedInRequester?.email || '',
        status: 'draft',
        showcase_opt_in: false,
        share_contact_immediately: false,
      });
      onSuccess(response.trackingCode);
    } catch (err: any) {
      console.error(err);
      setError(err.message || (isHi ? 'ड्राफ्ट सहेजने में विफल।' : 'Failed to save draft.'));
    } finally {
      setLoading(false);
    }
  };

  const inp = "w-full h-10 sm:h-11 px-3 sm:px-3.5 border border-ink-300 bg-white text-sm font-medium text-ink-900 placeholder:text-ink-400 placeholder:font-normal outline-none transition-colors duration-150 focus:border-blood-600 focus:outline-1 focus:outline-offset-0 focus:outline-blood-600 min-w-0";
  const inpErr = "border-blood-600";

  return (
    <div className="max-w-2xl mx-auto w-full min-w-0 bg-white border border-ink-200 p-4 sm:p-6 my-4 sm:my-6 overflow-hidden">
      <div className="text-center mb-6">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-ink-900">
          {isHi ? 'रक्त अनुरोध भेजें' : 'Broadcast Blood Request'}
        </h2>
        <p className="text-xs text-ink-500 mt-1">
          {isHi ? 'नीचे दी गई जानकारी भरें और अनुरोध भेजें।' : 'Fill in the details below to broadcast a request to nearby donors.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && (
          <div className="p-3 bg-blood-50 text-blood-700 border border-blood-200 text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Blood Group */}
        <div id="field-blood_type_needed" className="bg-ink-50 border border-ink-100 p-4">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-3">
            {isHi ? 'रक्त समूह *' : 'Blood Group *'}
          </label>
          <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 gap-2">
            {BLOOD_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => { setFormData(prev => ({ ...prev, blood_type_needed: type as BloodType | 'ANY' })); setFieldErrors(prev => { const n = { ...prev }; delete n.blood_type_needed; return n; }); }}
                className={`py-2.5 border text-sm font-bold font-mono transition-all cursor-pointer ${
                  formData.blood_type_needed === type
                    ? 'bg-blood-600 text-white border-blood-600'
                    : 'bg-white text-ink-700 border-ink-200 hover:border-ink-900'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          {fieldErrors.blood_type_needed && <p className="text-blood-600 text-[11px] mt-1.5 font-medium">{fieldErrors.blood_type_needed}</p>}
        </div>

        {/* 2. Units Required */}
        <div id="field-units_required" className="bg-ink-50 border border-ink-100 p-4">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-3">
            {isHi ? 'यूनिट आवश्यक *' : 'Units Required *'}
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => { setFormData(prev => ({ ...prev, units_required: n as any })); setFieldErrors(prev => { const k = { ...prev }; delete k.units_required; return k; }); }}
                className={`flex-1 py-2.5 border text-sm font-bold transition-all cursor-pointer ${
                  formData.units_required === n
                    ? 'bg-blood-600 text-white border-blood-600'
                    : 'bg-white text-ink-700 border-ink-200 hover:border-ink-900'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {fieldErrors.units_required && <p className="text-blood-600 text-[11px] mt-1.5 font-medium">{fieldErrors.units_required}</p>}
        </div>

        {/* 3. Patient Details */}
        <div className="bg-ink-50 border border-ink-100 p-4">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-3">
            {isHi ? 'मरीज की जानकारी' : 'Patient Details'}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div id="field-patient_name">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-1">
                {isHi ? 'मरीज का नाम *' : 'Patient Name *'}
              </label>
              <input
                type="text"
                value={formData.patient_name}
                onChange={e => setFormData(prev => ({ ...prev, patient_name: e.target.value }))}
                className={`${inp} ${fieldErrors.patient_name ? inpErr : ''}`}
                placeholder={isHi ? 'नाम दर्ज करें' : 'Enter patient name'}
              />
              {fieldErrors.patient_name && <p className="text-blood-600 text-[11px] mt-1 font-medium">{fieldErrors.patient_name}</p>}
            </div>
            <div id="field-patient_age">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-1">
                {isHi ? 'आयु *' : 'Age *'}
              </label>
              <input
                type="number"
                min="1"
                max="119"
                value={formData.patient_age === ('' as any) ? '' : formData.patient_age}
                onChange={e => setFormData(prev => ({ ...prev, patient_age: e.target.value === '' ? ('' as any) : parseInt(e.target.value) }))}
                className={`${inp} ${fieldErrors.patient_age ? inpErr : ''}`}
                placeholder={isHi ? 'आयु' : 'Age'}
              />
              {fieldErrors.patient_age && <p className="text-blood-600 text-[11px] mt-1 font-medium">{fieldErrors.patient_age}</p>}
            </div>
          </div>
        </div>

        {/* 4. Hospital Location */}
        <div className="bg-ink-50 border border-ink-100 p-4">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-3">
            {isHi ? 'अस्पताल स्थान' : 'Hospital Location'}
          </label>
          <div className="space-y-3">
            <div id="field-hospital_name">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-1">
                {isHi ? 'अस्पताल का नाम *' : 'Hospital Name *'}
              </label>
              <input
                type="text"
                value={formData.hospital_name}
                onChange={e => setFormData(prev => ({ ...prev, hospital_name: e.target.value }))}
                className={`${inp} ${fieldErrors.hospital_name ? inpErr : ''}`}
                placeholder={isHi ? 'अस्पताल का नाम' : 'e.g. Apollo Hospital'}
              />
              {fieldErrors.hospital_name && <p className="text-blood-600 text-[11px] mt-1 font-medium">{fieldErrors.hospital_name}</p>}
            </div>
            <div id="field-hospital_area">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-1">
                {isHi ? 'इलाका / पता *' : 'Area / Address *'}
              </label>
              <input
                type="text"
                value={formData.hospital_area}
                onChange={e => setFormData(prev => ({ ...prev, hospital_area: e.target.value }))}
                className={`${inp} ${fieldErrors.hospital_area ? inpErr : ''}`}
                placeholder={isHi ? 'इलाका' : 'e.g. Sector 62'}
              />
              {fieldErrors.hospital_area && <p className="text-blood-600 text-[11px] mt-1 font-medium">{fieldErrors.hospital_area}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div id="field-hospital_pincode">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-1">
                  {isHi ? 'पिनकोड *' : 'Pincode *'}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={formData.hospital_pincode}
                  onChange={e => handlePincodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`${inp} font-mono ${fieldErrors.hospital_pincode ? inpErr : ''}`}
                  placeholder="110058"
                />
                {fieldErrors.hospital_pincode && <p className="text-blood-600 text-[11px] mt-1 font-medium">{fieldErrors.hospital_pincode}</p>}
              </div>
              <div id="field-hospital_city">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-1">
                  {isHi ? 'शहर *' : 'City *'}
                </label>
                <input
                  type="text"
                  value={formData.hospital_city}
                  onChange={e => setFormData(prev => ({ ...prev, hospital_city: e.target.value }))}
                  className={`${inp} ${fieldErrors.hospital_city ? inpErr : ''}`}
                  placeholder={isHi ? 'शहर' : 'e.g. Delhi'}
                />
                {fieldErrors.hospital_city && <p className="text-blood-600 text-[11px] mt-1 font-medium">{fieldErrors.hospital_city}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* 5. Urgency */}
        <div id="field-urgency_level" className="bg-ink-50 border border-ink-100 p-4">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-3">
            {isHi ? 'आपातकाल *' : 'Urgency *'}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { value: 'critical', label: isHi ? 'आपातकालीन' : 'Emergency', sub: isHi ? '< 6 घंटे' : '< 6 Hrs', active: 'bg-blood-600 text-white border-blood-600' },
              { value: 'urgent', label: isHi ? 'जरूरी' : 'Urgent', sub: isHi ? '< 24 घंटे' : '< 24 Hrs', active: 'bg-amber-500 text-white border-amber-500' },
              { value: 'planned', label: isHi ? 'नियोजित' : 'Planned', sub: isHi ? 'अनुसूचित' : 'Scheduled', active: 'bg-ink-700 text-white border-ink-700' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, urgency_level: opt.value as UrgencyLevel }))}
                className={`py-3 border text-center transition-all cursor-pointer ${
                  formData.urgency_level === opt.value
                    ? opt.active
                    : 'bg-white text-ink-700 border-ink-200 hover:border-ink-300'
                }`}
              >
                <span className="block text-sm font-bold">{opt.label}</span>
                <span className="block text-[10px] font-semibold opacity-70 mt-0.5">{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 6. Contact */}
        <div className="bg-ink-50 border border-ink-100 p-4">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-3">
            {isHi ? 'संपर्क' : 'Contact'}
          </label>
          <div className="space-y-3">
            <div id="field-requester_phone">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-1">
                {isHi ? 'फोन नंबर *' : 'Phone Number *'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-400 select-none">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={formData.requester_phone}
                  onChange={e => setFormData(prev => ({ ...prev, requester_phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  className={`${inp} pl-11 font-mono ${fieldErrors.requester_phone ? inpErr : ''}`}
                  placeholder="9876543210"
                />
              </div>
              {fieldErrors.requester_phone && <p className="text-blood-600 text-[11px] mt-1 font-medium">{fieldErrors.requester_phone}</p>}
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-1">
                {isHi ? 'अतिरिक्त नोट्स' : 'Notes (optional)'}
              </label>
              <textarea
                rows={2}
                value={formData.additional_notes}
                onChange={e => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
                className="w-full px-4 py-2.5 border border-ink-300 bg-white text-sm font-medium text-ink-900 placeholder:text-ink-400 placeholder:font-normal outline-none transition-colors duration-150 resize-none focus:border-blood-600 focus:outline-1 focus:outline-offset-0 focus:outline-blood-600"
                placeholder={isHi ? 'कोई अतिरिक्त निर्देश...' : 'Any additional instructions...'}
              />
            </div>
          </div>
        </div>

        {/* Auth gate inline message */}
        {!loggedInRequester && (
          <div className="p-3 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium text-center">
            {isHi ? 'अनुरोध भेजने के लिए पहले साइन इन करें।' : 'Sign in first to broadcast a request.'}
          </div>
        )}

        {/* 7. Submit */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            id="btn-broadcast-now"
            type="submit"
            disabled={loading}
            className="flex-1 py-3.5 px-6 bg-blood-600 hover:bg-blood-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isHi ? 'भेजा जा रहा है...' : 'Broadcasting...'}
              </span>
            ) : (
              <>
                <Megaphone className="w-4 h-4" />
                <span>{isHi ? 'अनुरोध भेजें' : 'Broadcast Request'}</span>
              </>
            )}
          </button>
          <button
            id="btn-save-draft"
            type="button"
            onClick={() => {
              if (loggedInRequester) {
                handleSaveDraft();
              } else if (onNavigate) {
                onNavigate('requester-register');
              }
            }}
            disabled={loading}
            className="sm:w-auto py-3.5 px-6 border border-ink-200 bg-white hover:bg-ink-50 text-ink-700 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isHi ? 'ड्राफ्ट सहेजें' : 'Save Draft'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
