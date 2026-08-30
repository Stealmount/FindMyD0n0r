import React from 'react';
import { useLanguage } from '../../lib/LanguageContext';
import { ArrowRight, Lock } from 'lucide-react';

interface LoginViewProps {
 onNavigate?: (view: string) => void;
}

/** Not-signed-in placeholder card for the donor dashboard route. */
export default function LoginView({ onNavigate }: LoginViewProps) {
 const { language } = useLanguage();
 const isHi = language === 'HI';

 return (
 <div id="donor-login-container" className="max-w-md mx-auto border border-ink-200 bg-white overflow-hidden my-8">
 <div className="bg-ink-950 p-8 text-white text-center relative overflow-hidden">
 <div className="mx-auto mb-3 grid h-12 w-12 place-items-center bg-blood-600">
 <Lock className="w-6 h-6 text-white" />
 </div>
 <h2 className="font-display text-xl font-bold tracking-tight text-white">
 {isHi ? 'डोनर डैशबोर्ड' : 'Donor Dashboard'}
 </h2>
 <p className="text-ink-300 text-xs mt-1">
 {isHi ? 'अपनी उपलब्धता प्रबंधित करें, रक्त अनुरोध देखें या रक्तदान दर्ज करें।' : 'Manage availability, view match requests, or log external donations.'}
 </p>
 </div>

 <div className="p-8 space-y-4">
 <p className="text-center text-sm text-ink-600">
 {isHi
 ? 'डैशबोर्ड एक्सेस करने के लिए कृपया साइन इन करें।'
 : 'Please sign in to access your donor dashboard.'}
 </p>
 <button
 id="btn-goto-signin"
 type="button"
 onClick={() => onNavigate?.('auth-signin')}
  className="inline-flex h-12 w-full items-center justify-center gap-2 bg-blood-600 font-semibold text-sm text-white transition-colors duration-200 hover:bg-blood-700 active:bg-blood-800 cursor-pointer"
 >
 <ArrowRight className="w-4 h-4" />
 {isHi ? 'साइन इन / रजिस्टर करें' : 'Sign In / Register'}
 </button>
 </div>
 </div>
 );
}
