import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Building2, MapPin, Mail, Phone, ArrowRight, Clock, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../lib/LanguageContext';
import { registerInstitution } from '../../lib/rev3Auth';

interface HospitalRegistrationProps {
  onBack: () => void;
}

export function HospitalRegistration({ onBack }: HospitalRegistrationProps) {
  const { language, setLanguage } = useLanguage();
  const isHi = language === 'HI';
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    orgName: '',
    type: 'hospital' as 'hospital' | 'blood_bank' | 'ngo' | 'other',
    registrationNumber: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    pincode: '',
    password: '',
    confirmPassword: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, 10) }));
      return;
    }
    if (name === 'pincode') {
      setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, 6) }));
      return;
    }
    if (name === 'password' || name === 'confirmPassword') {
      setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, 10) }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    if (!/^\d{10}$/.test(formData.password)) {
      setIsSubmitting(false);
      setError(isHi ? '10-अंकीय साइन-इन पासवर्ड दर्ज करें (केवल संख्याएँ)।' : 'Enter a 10-digit sign-in password (numbers only).');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setIsSubmitting(false);
      setError(isHi ? 'पासवर्ड मेल नहीं खाते।' : 'Passwords do not match.');
      return;
    }

    try {
      await registerInstitution({
        type: formData.type,
        orgName: formData.orgName,
        registrationNumber: formData.registrationNumber,
        contactPerson: formData.contactPerson,
        phone: `91${formData.phone}`,
        email: formData.email,
        password: formData.password,
        address: formData.address.trim() ? formData.address.trim() : undefined,
        city: formData.city,
        pincode: formData.pincode,
      });
      setIsSubmitting(false);
      setSuccess(true);
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err?.message || (isHi ? 'पंजीकरण विफल। पुनः प्रयास करें।' : 'Registration failed. Please try again.'));
    }
  };

  const fieldClass =
    'w-full h-11 border border-ink-300 bg-white px-3.5 text-sm font-medium text-ink-900 outline-none transition-colors duration-150 placeholder:text-ink-400 focus:border-blood-600 focus:outline-1 focus:outline-offset-0 focus:outline-blood-600';
  const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-600 block';

  return (
    <div className="min-h-[85vh] py-12 px-4 sm:px-6 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-6 right-6 z-20 inline-flex items-center gap-1 border border-ink-200 bg-ink-100 p-1">
        <button onClick={() => setLanguage('EN')}
          className={`px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${!isHi ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900'}`}>
          EN
        </button>
        <button onClick={() => setLanguage('HI')}
          className={`px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${isHi ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900'}`}>
          HI
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg mx-auto relative z-10">
        <button onClick={onBack}
          className="mb-6 flex cursor-pointer items-center text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-ink-900">
          {isHi ? '← मुख्य पृष्ठ' : '← Back to home'}
        </button>

        <div className="border border-ink-200 bg-white p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-10 w-10 place-items-center border border-blood-200 bg-blood-50">
              <Shield className="w-5 h-5 text-blood-600" />
            </div>
            <div>
              <h1 className="font-display text-lg font-extrabold tracking-tight text-ink-900">
                {isHi ? 'संस्था पंजीकरण' : 'Register Institution'}
              </h1>
              <p className="text-[11px] text-ink-400 mt-0.5">
                {isHi ? 'अपनी संस्था को रक्तदान नेटवर्क से जोड़ें' : 'Join the FindMyDonor network'}
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
              {!success ? (
                <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-blood-50 text-blood-700 border border-blood-200 text-sm font-medium">
                      {error}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className={labelClass}>{isHi ? 'संस्था का नाम' : 'Institution Name'}</label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                      <input type="text" name="orgName" required value={formData.orgName} onChange={handleChange}
                        className={`${fieldClass} pl-10`} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>{isHi ? 'प्रकार' : 'Type'}</label>
                    <div className="relative">
                      <select name="type" value={formData.type} onChange={handleChange}
                        className={`${fieldClass} cursor-pointer appearance-none pr-9`}>
                        <option value="hospital">{isHi ? 'अस्पताल' : 'Hospital'}</option>
                        <option value="blood_bank">{isHi ? 'ब्लड बैंक' : 'Blood Bank'}</option>
                        <option value="ngo">{isHi ? 'एनजीओ' : 'NGO'}</option>
                        <option value="other">{isHi ? 'अन्य' : 'Other'}</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>{isHi ? 'पंजीकरण संख्या' : 'Registration Number'}</label>
                    <input type="text" name="registrationNumber" required value={formData.registrationNumber}
                      onChange={handleChange}
                      placeholder={isHi ? 'लाइसेंस / दरपन / पंजीकरण संख्या' : 'License / Darpan / reg. number'}
                      className={fieldClass} />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>{isHi ? 'संपर्क व्यक्ति' : 'Contact Person'}</label>
                    <input type="text" name="contactPerson" required value={formData.contactPerson}
                      onChange={handleChange}
                      className={fieldClass} />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>{isHi ? 'संपर्क फ़ोन' : 'Contact Phone'}</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                      <span className="absolute left-10 top-1/2 -translate-y-1/2 font-mono text-sm text-ink-500">+91</span>
                      <input type="tel" name="phone" required maxLength={10} placeholder="XXXXXXXXXX"
                        value={formData.phone} onChange={handleChange}
                        className="w-full h-11 border border-ink-300 bg-white pl-[4.5rem] pr-3.5 text-sm font-medium text-ink-900 outline-none transition-colors duration-150 focus:border-blood-600 focus:outline-1 focus:outline-offset-0 focus:outline-blood-600" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>{isHi ? 'ईमेल' : 'Email'}</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                      <input type="email" name="email" required value={formData.email} onChange={handleChange}
                        className={`${fieldClass} pl-10`} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className={labelClass}>{isHi ? 'शहर' : 'City'}</label>
                      <input type="text" name="city" required value={formData.city} onChange={handleChange}
                        className={fieldClass} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>{isHi ? 'पिनकोड' : 'Pincode'}</label>
                      <div className="relative">
                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                        <input type="text" name="pincode" required maxLength={6} value={formData.pincode}
                          onChange={handleChange}
                          className={`${fieldClass} pl-10`} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>{isHi ? '10-अंकीय साइन-इन पासवर्ड' : '10-digit Sign-in Password'}</label>
                    <input type="password" name="password" required inputMode="numeric" maxLength={10}
                      placeholder="XXXXXXXXXX" value={formData.password} onChange={handleChange}
                      autoComplete="new-password"
                      className={`${fieldClass} font-mono tracking-widest`} />
                    <p className="text-[11px] text-ink-400">
                      {isHi ? 'केवल संख्याएँ, ठीक 10 अंक। इससे आप अनुमोदन के बाद ईमेल + पासवर्ड से साइन इन करेंगे।' : 'Numbers only, exactly 10 digits. You will sign in with this plus your email once approved.'}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>{isHi ? 'पासवर्ड दोहराएं' : 'Confirm Password'}</label>
                    <input type="password" name="confirmPassword" required inputMode="numeric" maxLength={10}
                      placeholder="XXXXXXXXXX" value={formData.confirmPassword} onChange={handleChange}
                      autoComplete="new-password"
                      className={`${fieldClass} font-mono tracking-widest`} />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>{isHi ? 'पता (वैकल्पिक)' : 'Address (optional)'}</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange}
                      className={fieldClass} />
                  </div>

                  <button type="submit" disabled={isSubmitting}
                    className="mt-2 inline-flex h-12 w-full cursor-pointer select-none items-center justify-center gap-2 bg-blood-600 px-6 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blood-700 active:bg-blood-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600 disabled:cursor-not-allowed disabled:opacity-50">
                    {isSubmitting ? (
                      <span className="animate-pulse">{isHi ? 'जमा हो रहा है...' : 'Submitting...'}</span>
                    ) : (
                      <>
                        {isHi ? 'समीक्षा हेतु जमा करें' : 'Submit for Review'}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="mt-4 border-t border-ink-100 pt-4 text-center">
                    <p className="text-sm text-ink-500">
                      {isHi ? 'पहले से पंजीकृत? ' : 'Already registered? '}
                      <button onClick={() => navigate('/institution/login')}
                        className="font-bold text-blood-600 hover:text-blood-800 cursor-pointer transition-colors">
                        {isHi ? 'साइन इन करें' : 'Sign in to your institution'}
                      </button>
                    </p>
                  </div>
                </motion.form>
              ) : (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="py-8 text-center space-y-5">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-amber-200 bg-amber-50">
                    <Clock className="h-8 w-8 text-amber-700" />
                  </div>
                  <div>
                    <h3 className="mb-2 font-display text-xl font-extrabold tracking-tight text-ink-900">
                      {isHi ? 'पंजीकरण जमा हो गया' : 'Registration Submitted'}
                    </h3>
                    <p className="text-ink-500 text-sm leading-relaxed max-w-sm mx-auto">
                      {isHi
                        ? 'आपकी संस्था का पंजीकरण हमारी टीम द्वारा सत्यापित किया जाएगा। अनुमोदन के बाद आपको ईमेल पर साइन-इन लिंक मिलेगा और आप अपने ईमेल + 10-अंकीय पासवर्ड से साइन इन कर पाएँगे।'
                        : "Your institution will be reviewed by our admin team. Once approved, you'll get an email with a direct sign-in link — sign in with your email and 10-digit password."}
                    </p>
                  </div>
                  <button onClick={onBack}
                    className="text-sm font-bold text-ink-500 hover:text-ink-900 transition cursor-pointer">
                    {isHi ? '← मुख्य पृष्ठ पर वापस जाएं' : '← Return to home'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}