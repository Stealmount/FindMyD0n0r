import React, { useState } from 'react';
import { Heart, Copy, Check, ShieldCheck, Zap, Smartphone, ArrowRight, ArrowLeft, Info, QrCode } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface SupportPageProps {
 onNavigate: (view: string) => void;
}

export function SupportPage({ onNavigate }: SupportPageProps) {
 const { language } = useLanguage();
 const isHi = language === 'HI';
 const upiId = '8076971891@upi';
 const payeeName = 'FindMyDonor Community';
 const [copied, setCopied] = useState(false);
 const [selectedAmount, setSelectedAmount] = useState<number | null>(100);
 const [customAmount, setCustomAmount] = useState<string>('');
 const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

 const amounts = [50, 100, 250, 500, 1000];
 const currentAmount = selectedAmount !== null ? selectedAmount : (parseInt(customAmount, 10) || 100);

 const upiPayUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${currentAmount}&cu=INR&tn=${encodeURIComponent('Support Emergency Blood Network')}`;
 const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiPayUrl)}`;

 const handleCopyUpi = () => {
 navigator.clipboard.writeText(upiId);
 setCopied(true);
 setTimeout(() => setCopied(false), 2500);
 };

 const handlePayClick = (e: React.MouseEvent) => {
 e.preventDefault();
 const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
 
 if (isMobile) {
 window.location.href = upiPayUrl;
 } else {
 // Desktop Fallback
 handleCopyUpi();
 setNoticeMessage(
 isHi 
 ? "UPI ID (8076971891@upi) Copy ho gaya hai! Apne mobile phone par GPay/PhonePe khol kar paste karein ya daayein taraf wale QR Code ko scan karein."
 : "UPI ID (8076971891@upi) copied to clipboard! Please open GPay/PhonePe on your mobile phone or scan the QR Code."
 );
 setTimeout(() => setNoticeMessage(null), 8000);
 }
 };

 return (
 <div className="min-h-screen bg-[#FAFAFA] text-ink-900 pt-24 pb-20 px-4 sm:px-6 lg:px-8 font-sans">
 <div className="max-w-4xl mx-auto space-y-6">
 
 {/* Navigation Breadcrumb */}
 <div className="flex items-center justify-between border-b border-ink-200 pb-4">
 <button
 onClick={() => onNavigate('home')}
 className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-ink-900"
>
 <ArrowLeft className="w-4 h-4" />
 {isHi ? "Mukhya Prashth" : "Back to Home"}
 </button>
 <span className="inline-flex items-center gap-1.5 border border-vital-200 bg-vital-50 px-2.5 py-1 text-xs font-semibold text-vital-700">
 <ShieldCheck className="w-3.5 h-3.5" /> 100% Free Non-Profit Mission
 </span>
 </div>

 {/* Header Section */}
 <div className="space-y-3 text-center sm:text-left">
 <p className="flex items-center justify-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-blood-600 sm:justify-start">
 <Heart className="w-3.5 h-3.5 animate-pulse fill-blood-600 text-blood-600" />
 {isHi ? "Sahyog & Sewa" : "Support Our Non-Profit Mission"}
 </p>
 <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink-900">
 {isHi ? "Donors Khoon Dete Hain. Aap Network Chalate Hain." : "Donors Give Blood. You Power the Bridge."}
 </h1>
 <p className="max-w-2xl text-[17px] leading-relaxed text-ink-600">
 {isHi 
 ? "FindMyDonor 100% free aur non-profit hai. Aapka koi bhi sahyog emergency server hosting aur WhatsApp alerts ko zinda rakhne mein seedha madad karta hai." 
 : "FindMyDonor is 100% free and non-profit. Any contribution — big or small — directly helps keep emergency server hosting & WhatsApp alerts running for families in need."}
 </p>
 </div>

 {/* Short, Warm, Genuine Quote Banner */}
 <div className="space-y-2 border border-l-4 border-l-blood-600 border-ink-100 bg-ink-50 p-6">
 <p className="text-[17px] font-medium leading-relaxed text-ink-900">
 &ldquo;{isHi 
 ? "Khoon donor deta hai, par uski pukaar aage aap pahunchate hain. Aapka ek chhota sa sahyog kisi ki jaan bachane waala bridge zinda rakhta hai." 
 : "You don't need to be a doctor to save a life — keeping the bridge alive between a donor and a patient is the highest form of humanity."}&rdquo;
 </p>
 <p className="text-xs font-semibold text-blood-700">
 — FindMyDonor Community Infrastructure Initiative
 </p>
 </div>

 {/* Dynamic Desktop Notice Banner */}
 {noticeMessage && (
 <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 text-xs flex items-start gap-3 animate-fade-in">
 <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
 <div className="space-y-1">
 <p className="font-bold">{isHi ? "Mobile UPI Instructions" : "Desktop Notice"}</p>
 <p className="leading-relaxed">{noticeMessage}</p>
 </div>
 </div>
 )}

 {/* Contribution Card Grid */}
 <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
 
 {/* Left: Amount Selection */}
 <div className="md:col-span-7 bg-white border border-ink-200 p-6 space-y-5 flex flex-col justify-between">
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
 <Zap className="w-4 h-4 text-amber-500" />
 {isHi ? "Sahyog Rashi Chunein" : "Select Contribution Amount"}
 </h2>
 <span className="text-xs font-semibold text-ink-500">INR (₹)</span>
 </div>

 <div className="grid grid-cols-5 gap-2">
 {amounts.map((amt) => (
 <button
 key={amt}
 type="button"
 onClick={() => {
 setSelectedAmount(amt);
 setCustomAmount('');
 }}
 className={`cursor-pointer border py-2.5 font-mono text-sm font-bold tabular-nums transition-colors ${
 selectedAmount === amt
 ? 'border-blood-600 bg-blood-50/60 text-blood-700'
 : 'border-ink-200 bg-white text-ink-700 hover:border-ink-900'
 }`}
>
 ₹{amt}
 </button>
 ))}
 </div>

 <input
 type="number"
 placeholder={isHi ? "Custom rashi (e.g. 200)" : "Custom amount (e.g. 200)"}
 value={customAmount}
 onChange={(e) => {
 setCustomAmount(e.target.value);
 setSelectedAmount(null);
 }}
 className="w-full border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 transition-colors placeholder:text-ink-400 focus:border-blood-600 focus:outline-1 focus:outline-offset-0 focus:outline-blood-600"
 />

 {/* Warm Open Community Ask Note */}
 <div className="border border-blood-200 bg-blood-50 p-4 text-xs font-medium leading-relaxed text-blood-900">
 {isHi 
 ? "❤️ Koi bhi rashi chunein — har chhota sa sahyog emergency alerts aur server ko bina kisi swarth ke chalaye rakhne mein hamari madad karta hai."
 : "❤️ Choose any amount — every contribution directly supports server hosting and emergency WhatsApp alerts for families in distress."}
 </div>

 {/* Official UPI ID Box */}
 <div className="space-y-2 border border-ink-100 bg-ink-50 p-4">
 <div className="flex items-center justify-between text-xs text-ink-500">
 <span>Official BHIM / Universal UPI ID</span>
 <span className="font-semibold text-vital-700">Direct Bank Transfer</span>
 </div>
 <div className="flex flex-wrap items-center justify-between gap-2 border border-ink-200 bg-white p-3">
 <code className="font-mono text-sm font-bold tabular-nums text-ink-900">{upiId}</code>
 <button
 type="button"
 onClick={handleCopyUpi}
 className="inline-flex cursor-pointer items-center gap-1.5 border border-ink-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-900 transition-colors duration-200 hover:border-ink-900 hover:bg-ink-50"
>
 {copied ? <Check className="w-3.5 h-3.5 text-vital-600" /> : <Copy className="w-3.5 h-3.5" />}
 {copied ? "Copied" : "Copy UPI ID"}
 </button>
 </div>
 </div>
 </div>

 {/* Smart Pay Button */}
 <div className="mt-4 space-y-2">
 <button
 type="button"
 onClick={handlePayClick}
 className="flex w-full cursor-pointer items-center justify-center gap-2 bg-blood-600 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blood-700 active:bg-blood-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600"
>
 <Smartphone className="w-4 h-4" />
 {isHi ? `UPI App Se Pay Karein (₹${currentAmount})` : `Pay ₹${currentAmount} via UPI App (GPay/PhonePe)`}
 <ArrowRight className="w-4 h-4" />
 </button>
 <p className="text-[11px] text-ink-500 text-center">
 {isHi ? "📱 Mobile par seedha GPay/PhonePe khulega. 💻 Desktop par ID automatic copy ho jayegi." : "📱 On mobile, opens GPay/PhonePe directly. 💻 On desktop, copies UPI ID automatically."}
 </p>
 </div>
 </div>

 {/* Right: Official BHIM QR Code */}
 <div className="flex flex-col items-center justify-center space-y-4 border border-ink-200 bg-white p-6 text-center md:col-span-5">
 <div className="space-y-1">
 <h3 className="flex items-center justify-center gap-1.5 text-sm font-bold text-ink-900">
 <QrCode className="w-4 h-4 text-blood-600" />
 Scan & Pay via Any UPI App
 </h3>
 <p className="text-xs text-ink-500">BHIM • GPay • PhonePe • Paytm • CRED</p>
 </div>

 <div className="border border-ink-200 bg-white p-4">
 <img
 src="/bhim-qr.png"
 onError={(e) => {
 (e.target as HTMLImageElement).src = qrCodeUrl;
 }}
 alt="FindMyDonor BHIM UPI QR Code"
 className="h-48 w-48 object-contain"
 />
 </div>
 <p className="font-mono text-xs tabular-nums text-ink-600">UPI ID: <span className="font-bold text-ink-900">{upiId}</span></p>
 </div>
 </div>

 {/* Transparency Strip — 3 KPI mini-tiles */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <div className="border border-ink-200 bg-white p-4 sm:p-5">
 <div className="mb-2 grid h-10 w-10 place-items-center border border-vital-200 bg-vital-50">
 <ShieldCheck className="w-5 h-5 text-vital-700" />
 </div>
 <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">Financial Integrity</p>
 <p className="mt-0.5 font-display text-2xl font-extrabold tracking-tight tabular-nums text-ink-900">100%</p>
 <p className="mt-1 text-xs leading-relaxed text-ink-600">
 {isHi ? "Har rupaya seedha server hosting aur emergency WhatsApp alerts mein jata hai." : "Every rupee directly funds server hosting & emergency WhatsApp alerts."}
 </p>
 </div>
 <div className="border border-ink-200 bg-white p-4 sm:p-5">
 <div className="mb-2 grid h-10 w-10 place-items-center border border-ink-200 bg-ink-100">
 <Zap className="w-5 h-5 text-ink-700" />
 </div>
 <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">Platform Fees</p>
 <p className="mt-0.5 font-display text-2xl font-extrabold tracking-tight tabular-nums text-ink-900">₹0</p>
 <p className="mt-1 text-xs leading-relaxed text-ink-600">
 {isHi ? "Koi commission nahi — sahyog seedha mission ko chalata hai." : "No commissions or charges — contributions run the mission itself."}
 </p>
 </div>
 <div className="border border-ink-200 bg-white p-4 sm:p-5">
 <div className="mb-2 grid h-10 w-10 place-items-center border border-blood-200 bg-blood-50">
 <Heart className="w-5 h-5 fill-blood-600 text-blood-600" />
 </div>
 <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">Emergency Support</p>
 <p className="mt-0.5 font-display text-2xl font-extrabold tracking-tight tabular-nums text-ink-900">24×7</p>
 <p className="mt-1 text-xs leading-relaxed text-ink-600">
 {isHi ? "Emergency alerts muskurahat ke bina, har waqt chalte rehte hain." : "WhatsApp alerts keep running around the clock for families in need."}
 </p>
 </div>
 </div>

 <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border border-ink-200 bg-white px-4 py-3">
 <span className="inline-flex items-center gap-2 text-xs font-medium text-ink-700">
 <ShieldCheck className="w-4 h-4 shrink-0 text-vital-600" />
 {isHi ? "100% Financial Integrity: Every rupee directly funds server hosting & emergency WhatsApp alerts." : "100% Financial Integrity: Every rupee directly funds server hosting & emergency WhatsApp alerts."}
 </span>
 <button
 onClick={() => onNavigate('request')}
 className="flex shrink-0 cursor-pointer items-center gap-1 font-bold text-blood-600 transition-colors hover:text-blood-700"
>
 {isHi ? "Need Emergency Blood? Request Here →" : "Need Emergency Blood? Request Here →"}
 </button>
 </div>

 </div>
 </div>
 );
}
