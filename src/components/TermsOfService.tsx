import React from 'react';
import { ShieldAlert, Heart, FileText, CheckCircle2, ArrowLeft, AlertCircle } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface TermsOfServiceProps {
 onNavigate?: (view: string) => void;
}

export function TermsOfService({ onNavigate }: TermsOfServiceProps) {
 const { language } = useLanguage();
 const isHi = language === 'HI';

 return (
 <div className="min-h-screen bg-ink-50 text-ink-900 pt-24 pb-20 px-4 sm:px-6 lg:px-8 font-sans">
 <div className="max-w-4xl mx-auto space-y-6">
 
 {/* Navigation Breadcrumb */}
 <div className="flex items-center justify-between border-b border-ink-200 pb-4">
 <button
 onClick={() => onNavigate ? onNavigate('home') : (window.location.href = '/')}
 className="text-xs font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-900 transition-colors flex items-center gap-1.5"
>
 <ArrowLeft className="w-4 h-4" />
 {isHi ? "Mukhya Prashth" : "Back to Home"}
 </button>
 <span className="text-xs font-medium text-blood-700 bg-blood-50 px-3 py-1 ring-1 ring-blood-200 flex items-center gap-1.5">
 <Heart className="w-3.5 h-3.5 fill-blood-600 text-blood-600" />
 {isHi ? "100% Nishulk Voluntary Network" : "Non-Commercial Community Network"}
 </span>
 </div>

 {/* Page Header */}
 <div className="space-y-3">
 <p className="text-xs font-semibold uppercase tracking-widest text-blood-600 flex items-center gap-1.5">
 <FileText className="w-3.5 h-3.5" />
 {isHi ? "Niyam Aur Shartein" : "Terms of Service"}
 </p>
 <h1 className="text-2xl sm:text-4xl font-bold text-ink-900 tracking-tight">
 {isHi ? "Sewa Ke Niyam. Insaniyat Ke Liye 100% Nishulk." : "Terms of Service. Built for Community, Free for All."}
 </h1>
 <p className="text-sm text-ink-600 max-w-3xl leading-relaxed">
 {isHi
 ? "FindMyDonor ek swaichhik (voluntary) emergency network hai. Hum kisi bhi patient, parivaar ya donor se commercial fees nahi lete."
 : "FindMyDonor operates as a voluntary emergency matching network. We bridge the gap between families in urgent medical need and registered voluntary donors without commercial charges."}
 </p>
 </div>

 {/* 3 Core Pillars Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-white border border-ink-200 p-5 space-y-2">
 <div className="w-8 h-8 bg-vital-50 text-vital-600 ring-1 ring-vital-200 flex items-center justify-center font-bold">
 <Heart className="w-4 h-4" />
 </div>
 <h3 className="text-sm font-bold text-ink-900">
 {isHi ? "100% Free Mission" : "100% Free Mission"}
 </h3>
 <p className="text-xs text-ink-600 leading-relaxed">
 {isHi ? "Koi paid membership ya pricing tiers nahi hain. Har patient ke liye platform 100% free hai." : "No membership tiers or hospital pricing packages. Free for every patient and family."}
 </p>
 </div>

 <div className="bg-white border border-ink-200 p-5 space-y-2">
 <div className="w-8 h-8 bg-blood-50 text-blood-600 ring-1 ring-blood-200 flex items-center justify-center font-bold">
 <AlertCircle className="w-4 h-4" />
 </div>
 <h3 className="text-sm font-bold text-ink-900">
 {isHi ? "Khoon Ka Vyapar Sakht Mana Hai" : "Strictly Non-Monetary Blood Donation"}
 </h3>
 <p className="text-xs text-ink-600 leading-relaxed">
 {isHi ? "Khoon ke badle kisi bhi tarah ke paise ka len-den Sakht Gair-Kanooni hai." : "Blood donation is voluntary. Paying or demanding money for blood is strictly illegal under Indian law."}
 </p>
 </div>

 <div className="bg-white border border-ink-200 p-5 space-y-2">
 <div className="w-8 h-8 bg-amber-50 text-amber-600 ring-1 ring-amber-200 flex items-center justify-center font-bold">
 <ShieldAlert className="w-4 h-4" />
 </div>
 <h3 className="text-sm font-bold text-ink-900">
 {isHi ? "Emergency Technology Bridge" : "Emergency Matching Bridge"}
 </h3>
 <p className="text-xs text-ink-600 leading-relaxed">
 {isHi ? "Hum technology dwara donors ko inform karte hain. Doctor ki salah aur hospital testing zaroori hai." : "We connect voluntary donors to urgent requests. Hospital medical verification remains mandatory."}
 </p>
 </div>
 </div>

 {/* Detailed Sections */}
 <div className="bg-white border border-ink-200 p-6 sm:p-8 space-y-6 text-sm text-ink-700 leading-relaxed">
 
 <section className="space-y-2">
 <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
 <CheckCircle2 className="w-4 h-4 text-blood-600" />
 1. {isHi ? "Voluntary Nature & Zero Charges" : "Voluntary Platform & Zero Fees"}
 </h2>
 <p className="text-xs sm:text-sm text-ink-600">
 {isHi
 ? "FindMyDonor par sabhi services voluntary basis par di jati hain. Hum kisi bhi patient, hospital ya donor se direct ya indirect fees charge nahi karte."
 : "FindMyDonor is operated strictly as a non-commercial, non-profit emergency coordination platform. No subscription, registration, or matching fees are ever charged to users."}
 </p>
 </section>

 <section className="space-y-2 pt-4 border-t border-ink-100">
 <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
 <CheckCircle2 className="w-4 h-4 text-blood-600" />
 2. {isHi ? "Patient aur Parivaar Ki Zimmedari" : "Patient & Requester Guidelines"}
 </h2>
 <ul className="text-xs sm:text-sm space-y-2 text-ink-600 list-disc pl-5">
 <li>{isHi ? "Emergency request mein hospital ka naam aur exact blood group sahi bharein." : "Provide accurate medical information including the exact hospital name, ward, and required blood component."}</li>
 <li>{isHi ? "Donors ko aane ka samay aur hospital ki location WhatsApp/Call par clear batayein." : "Coordinate arrival timing and hospital location clearly with confirming donors via phone or WhatsApp."}</li>
 <li>{isHi ? "Khoon milne ke baad request status ko 'Fulfilled' mark karein taaki baaki donors pareshan na hon." : "Mark requests as 'Fulfilled' once required units are arranged so additional donors are not disturbed."}</li>
 </ul>
 </section>

 <section className="space-y-2 pt-4 border-t border-ink-100">
 <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
 <CheckCircle2 className="w-4 h-4 text-blood-600" />
 3. {isHi ? "Donor Safety & Cooldown Rules" : "Donor Eligibility & Safety Cooldowns"}
 </h2>
 <p className="text-xs sm:text-sm text-ink-600">
 {isHi
 ? "Donor ki umar 18-65 saal aur weight 45kg+ hona zaroori hai. Whole blood donation ke baad 90-day cooldown period lagoo hota hai taaki donor ki sehat surakshit rahe."
 : "Voluntary donors must meet NBTC eligibility guidelines (age 18-65, weight 45kg+). The system automatically enforces a 90-day cooldown period after a confirmed blood donation before matching again."}
 </p>
 </section>

 <section className="space-y-2 pt-4 border-t border-ink-100">
 <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
 <CheckCircle2 className="w-4 h-4 text-blood-600" />
 4. {isHi ? "Disclaimers & Medical Advice" : "Limitation of Liability & Medical Advice Disclaimer"}
 </h2>
 <p className="text-xs sm:text-sm text-ink-600">
 {isHi
 ? "FindMyDonor blood bank ya hospital nahi hai. Hum khoon ki testing ya storage nahi karte. Sabhi blood testing aur cross-matching hospital ke certified doctor dwara ki jani zaroori hai."
 : "FindMyDonor is an emergency communication bridge and does not provide medical services, blood testing, or storage. Hospital blood bank medical screening and mandatory cross-matching remain the sole responsibility of treating healthcare facilities."}
 </p>
 </section>

 </div>

 </div>
 </div>
 );
}
