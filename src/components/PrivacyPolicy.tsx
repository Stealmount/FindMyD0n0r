import React from 'react';
import { ShieldCheck, Lock, Eye, Key, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface PrivacyPolicyProps {
 onNavigate?: (view: string) => void;
}

export function PrivacyPolicy({ onNavigate }: PrivacyPolicyProps) {
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
 <span className="text-xs font-medium text-vital-700 bg-vital-50 px-3 py-1 ring-1 ring-vital-200 flex items-center gap-1.5">
 <ShieldCheck className="w-3.5 h-3.5" />
 {isHi ? "Pura Data Surakshit Hai" : "Privacy Preserved & Encrypted"}
 </span>
 </div>

 {/* Page Header */}
 <div className="space-y-3">
 <p className="text-xs font-semibold uppercase tracking-widest text-blood-600 flex items-center gap-1.5">
 <Lock className="w-3.5 h-3.5" />
 {isHi ? "Gopniyata Niti" : "Privacy Policy & Trust"}
 </p>
 <h1 className="text-2xl sm:text-4xl font-bold text-ink-900 tracking-tight">
 {isHi ? "Aapka Data Aapka Hai. Humari Suraksha Sabse Pehle." : "Your Privacy Belongs to You. Built on Trust & Respect."}
 </h1>
 <p className="text-sm text-ink-600 max-w-3xl leading-relaxed">
 {isHi
 ? "Jab koi parivaar sankat mein hota hai, tab vishwas sabse zaroori hota hai. Hum sirf utna hi data lete hain jitna emergency blood matching ke liye zaroori hai — kisi commercial company ko bechne ke liye nahi."
 : "When a family is in medical distress, trust is non-negotiable. We collect only what is essential to connect willing blood donors in emergency moments — never to monetize, track, or sell."}
 </p>
 </div>

 {/* 3 Core Guarantees Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-white border border-ink-200 p-5 space-y-2">
 <div className="w-8 h-8 bg-blood-50 text-blood-600 ring-1 ring-blood-200 flex items-center justify-center font-bold">
 <Eye className="w-4 h-4" />
 </div>
 <h3 className="text-sm font-bold text-ink-900">
 {isHi ? "0% Commercial Data Selling" : "Zero Commercial Data Selling"}
 </h3>
 <p className="text-xs text-ink-600 leading-relaxed">
 {isHi ? "Hum kisi bhi advertiser, broker ya third party ko donor ka mobile number nahi bechte." : "We never sell, rent, or trade phone numbers or medical data to advertisers or brokers."}
 </p>
 </div>

 <div className="bg-white border border-ink-200 p-5 space-y-2">
 <div className="w-8 h-8 bg-vital-50 text-vital-600 ring-1 ring-vital-200 flex items-center justify-center font-bold">
 <ShieldCheck className="w-4 h-4" />
 </div>
 <h3 className="text-sm font-bold text-ink-900">
 {isHi ? "Masked Contact Sharing" : "Masked Contact Sharing"}
 </h3>
 <p className="text-xs text-ink-600 leading-relaxed">
 {isHi ? "Donor ka phone number tabhi share hota hai jab donor khud WhatsApp par YES reply karta hai." : "Donor contact info is only shared after the donor explicitly confirms YES via WhatsApp."}
 </p>
 </div>

 <div className="bg-white border border-ink-200 p-5 space-y-2">
 <div className="w-8 h-8 bg-amber-50 text-amber-600 ring-1 ring-amber-200 flex items-center justify-center font-bold">
 <Key className="w-4 h-4" />
 </div>
 <h3 className="text-sm font-bold text-ink-900">
 {isHi ? "Right to Erasure (Delete Anytime)" : "Full Control & Right to Erasure"}
 </h3>
 <p className="text-xs text-ink-600 leading-relaxed">
 {isHi ? "Aap kisi bhi samay apna donor profile aur mobile number system se permanently delete kar sakte hain." : "You can pause availability or delete your profile permanently at any time with 1 click."}
 </p>
 </div>
 </div>

 {/* Main Privacy Body */}
 <div className="bg-white border border-ink-200 p-6 sm:p-8 space-y-6 text-sm text-ink-700 leading-relaxed">
 
 <section className="space-y-2">
 <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
 <CheckCircle2 className="w-4 h-4 text-blood-600" />
 1. {isHi ? "Hum Kaun Sa Information Collect Karte Hain?" : "What Information We Collect"}
 </h2>
 <p className="text-xs sm:text-sm text-ink-600">
 {isHi
 ? "Hum sirf wahi jankari lete hain jo khoon ki kami ko poora karne ke liye zaroori hai: Naum, Mobile Number, Blood Group, Pincode/Area, aur Last Donation Date (60-day safety cooldown ke liye)."
 : "To match donors safely during emergency blood requests, we collect minimal data: Full Name, Mobile Number, Blood Group, Pincode/Locality, and Last Donation Date (to enforce 56-90 day safety cooldowns)."}
 </p>
 </section>

 <section className="space-y-2 pt-4 border-t border-ink-100">
 <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
 <CheckCircle2 className="w-4 h-4 text-blood-600" />
 2. {isHi ? "Aapke Data Ka Upyog Kaise Hota Hai?" : "How We Use Your Data"}
 </h2>
 <ul className="text-xs sm:text-sm space-y-2 text-ink-600 list-disc pl-5">
 <li>{isHi ? "Jaise hi kisi hospital se emergency request aati hai, aapke pincode ke aaspas WhatsApp SOS alert bhejna." : "To match nearby voluntary donors when an urgent request is created in your area."}</li>
 <li>{isHi ? "Marez ke parivaar aur donor ke beech direct coordination karwana." : "To connect the hospital/patient family with accepting donors directly."}</li>
 <li>{isHi ? "Safety cooldown calculate karna taaki donor ki sehat surakshit rahe." : "To calculate mandatory safety cooldowns so donors donate safely without risk to health."}</li>
 </ul>
 </section>

 <section className="space-y-2 pt-4 border-t border-ink-100">
 <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
 <CheckCircle2 className="w-4 h-4 text-blood-600" />
 3. {isHi ? "WhatsApp Emergency Alert Broadcasts" : "WhatsApp Emergency Alerts"}
 </h2>
 <p className="text-xs sm:text-sm text-ink-600">
 {isHi
 ? "FindMyDonor aapko WhatsApp message bhejne ke liye WAHA API use karta hai. Messages mein bas hospital naam, blood group aur doori hoti hai. Donor ka naam public nahi kiya jata jab tak donor sweekrit na de."
 : "Emergency alerts are broadcast via automated WhatsApp messages detailing the blood group required, hospital name, and approximate distance. Your personal profile remains anonymous until you reply YES."}
 </p>
 </section>

 <section className="space-y-2 pt-4 border-t border-ink-100">
 <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
 <CheckCircle2 className="w-4 h-4 text-blood-600" />
 4. {isHi ? "Data Security & Storage Standards" : "Data Security & Storage Standards"}
 </h2>
 <p className="text-xs sm:text-sm text-ink-600">
 {isHi
 ? "Hum encrypted cloud data store (Upstash Redis) aur HTTPS encryption use karte hain. Sabhi network transfers SSL-encrypted hote hain."
 : "All records are stored in an access-controlled, encrypted cloud datastore (Upstash Redis) and transferred over encrypted HTTPS SSL connections."}
 </p>
 </section>

 </div>

 {/* Contact Footer */}
 <div className="bg-white border border-ink-200 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
 <div>
 <h3 className="text-sm font-bold text-ink-900">
 {isHi ? "Gopniyata Ya Profile Delete Karne Ke Liye Sampark Karein" : "Have Privacy Questions or Want Profile Deleted?"}
 </h3>
 <p className="text-xs text-ink-500">
 {isHi ? "Hamari support team 24 ghante ke andar aapka data clear kar sakti hai." : "Our support team will process data deletion or account pause requests within 24 hours."}
 </p>
 </div>
 <a
 href="mailto:privacy@findmydonor.online"
 className="px-4 py-2 bg-blood-50 text-blood-700 hover:bg-blood-100 ring-1 ring-blood-200 font-bold text-xs flex items-center gap-2 transition-all shrink-0"
>
 <Mail className="w-4 h-4" />
 privacy@findmydonor.online
 </a>
 </div>

 </div>
 </div>
 );
}
