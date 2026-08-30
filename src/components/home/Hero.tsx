import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
 Droplet,
 Search,
 Shield,
 ArrowRight,
 Activity,
 Check,
 Sparkles,
 Heart,
} from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

interface HeroProps {
 onNavigate: (view: 'home' | 'request' | 'tracking' | 'donor-register' | 'donor-dashboard' | 'requester-portal' | 'admin') => void;
}

export function Hero({ onNavigate }: HeroProps) {
 const { t } = useLanguage();

 return (
 <section
 id="top"
 className="relative overflow-hidden pt-28 sm:pt-36 pb-20 sm:pb-28"
 >
  {/* Ambient background layers */}
  <div className="absolute inset-x-0 top-0 h-[420px] sm:h-[560px] grid-pattern opacity-30" aria-hidden />
 <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
 <motion.div
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5 }}
  className="inline-flex items-center gap-2 border border-ink-200 bg-white px-2.5 py-1"
 >
  <span className="grid h-4 w-4 place-items-center bg-ink-100 text-ink-600">
  <Activity className="h-3 w-3" />
  </span>
  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-600">
  {t.hero.badge}
  </span>
 </motion.div>

 <div className="mt-7 grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
 {/* Copy */}
 <div className="lg:col-span-7">
 <motion.h1
 initial={{ opacity: 0, y: 14 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.7, delay: 0.1 }}
  className="font-display text-[clamp(2.75rem,6vw,4.25rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-ink-900"
 >
  {t.hero.titleLine1}{" "}
  <span className="text-blood-600">{t.hero.titleHighlight}</span>{" "}
  {t.hero.titleLine2}
 </motion.h1>

 <motion.p
 initial={{ opacity: 0, y: 14 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.7, delay: 0.2 }}
 className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-600"
 >
 {t.hero.subtitle}
 </motion.p>

 <motion.div
 initial={{ opacity: 0, y: 14 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.7, delay: 0.3 }}
 className="mt-8 flex flex-col sm:flex-row gap-3"
 >
 <button
  onClick={() => onNavigate('request')}
  className="group inline-flex h-12 items-center justify-center gap-2 bg-blood-600 px-6 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blood-700 active:bg-blood-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600 select-none cursor-pointer"
 >
  <Search className="h-4 w-4" />
  {t.hero.requestBloodNow}
  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
 </button>
 <button
  onClick={() => onNavigate('auth-signup' as any)}
  className="group inline-flex h-12 items-center justify-center gap-2 border border-ink-300 bg-white px-6 text-sm font-semibold text-ink-900 transition-colors duration-200 hover:border-ink-900 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600 select-none cursor-pointer"
 >
  <Heart className="h-4 w-4 text-blood-600 fill-blood-600" />
  {t.hero.joinNetwork}
 </button>
 <button
  onClick={() => onNavigate('tracking')}
  className="group inline-flex h-12 items-center justify-center gap-2 px-5 text-sm font-semibold text-ink-600 transition-colors duration-200 hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600 select-none cursor-pointer"
 >
  {t.hero.trackLiveRequest}
 </button>
 </motion.div>

 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ duration: 0.7, delay: 0.45 }}
 className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-ink-600"
 >
 {[
 t.hero.safetyVerification,
 t.hero.safetyCooldown,
 t.hero.privacyConsent,
 ].map((text) => (
 <div key={text} className="flex items-center gap-1.5">
 <Check className="h-3.5 w-3.5 text-vital-600" strokeWidth={3} />
 <span>{text}</span>
 </div>
 ))}
 </motion.div>
 </div>

 {/* Interactive card */}
 <div className="lg:col-span-5">
 <HeroCard onNavigate={onNavigate} />
 </div>
 </div>

 {/* Community strapline */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ duration: 0.7, delay: 0.3 }}
  className="mt-20 sm:mt-28"
 >
  <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
 {useLanguage().language === 'HI'
 ? 'स्वास्थ्य सेवा समुदाय के साथ साझेदारियाँ बनाना'
 : 'Building partnerships within the healthcare community'}
 </p>
 </motion.div>
 </div>
 </section>
 );
}

function HeroCard({
 onNavigate,
}: {
 onNavigate: (view: 'home' | 'request' | 'tracking' | 'donor-register' | 'donor-dashboard' | 'requester-portal' | 'admin') => void;
}) {
 const [quickBlood, setQuickBlood] = useState('O+');
 const [stats, setStats] = useState<{ bloodGroupCounts: Record<string, number> }>({ bloodGroupCounts: {} });
 const { language } = useLanguage();
 const isHi = language === 'HI';

 useEffect(() => {
 fetch('/api/stats')
 .then((res) => res.json())
 .then((data) => setStats(data || { bloodGroupCounts: {} }))
 .catch(() => {});
 }, []);

 const compatibilityMap: Record<string, { canReceiveFrom: string[]; canDonateTo: string[]; avgTime: string }> = {
 'O+': { canReceiveFrom: ['O+', 'O-'], canDonateTo: ['O+', 'A+', 'B+', 'AB+'], avgTime: '< 3 mins' },
 'A+': { canReceiveFrom: ['A+', 'A-', 'O+', 'O-'], canDonateTo: ['A+', 'AB+'], avgTime: '< 4 mins' },
 'B+': { canReceiveFrom: ['B+', 'B-', 'O+', 'O-'], canDonateTo: ['B+', 'AB+'], avgTime: '< 4 mins' },
 'AB+': { canReceiveFrom: ['All 8 Types (Universal Recipient)'], canDonateTo: ['AB+ Only'], avgTime: '< 5 mins' },
 'O-': { canReceiveFrom: ['O- Only'], canDonateTo: ['All 8 Types (Universal Donor)'], avgTime: '< 6 mins' },
 'A-': { canReceiveFrom: ['A-', 'O-'], canDonateTo: ['A-', 'A+', 'AB-', 'AB+'], avgTime: '< 7 mins' },
 'B-': { canReceiveFrom: ['B-', 'O-'], canDonateTo: ['B-', 'B+', 'AB-', 'AB+'], avgTime: '< 7 mins' },
 'AB-': { canReceiveFrom: ['AB-', 'A-', 'B-', 'O-'], canDonateTo: ['AB-', 'AB+'], avgTime: '< 8 mins' },
 };

 const currentCompat = compatibilityMap[quickBlood] || compatibilityMap['O+'];

 return (
 <motion.div
 initial={{ opacity: 0, y: 30, rotate: 1 }}
 animate={{ opacity: 1, y: 0, rotate: 0 }}
 transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
 className="relative"
 >

 <div className="relative border border-ink-200 bg-white p-5 sm:p-6">
  {/* Header */}
  <div className="flex items-center justify-between">
  <div className="flex items-center gap-2.5">
  <div className="relative grid h-10 w-10 place-items-center bg-blood-600">
  <Droplet className="h-5 w-5 text-white fill-white" />
  </div>
  <div>
  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-blood-600">
  {isHi ? 'इंटरएक्टिव रक्त संगतता केंद्र' : 'Interactive Blood Group Compatibility Hub'}
  </p>
  <p className="text-[13px] font-bold text-ink-900">
  {isHi ? 'रक्त समूह चुनें और जानें किसे रक्तदान कर सकते हैं' : 'Tap any blood group to view exact donor & recipient matches'}
  </p>
  </div>
  </div>
  <span className="inline-flex shrink-0 items-center gap-1.5 border border-vital-200 bg-vital-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-vital-700">
  <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
  {isHi ? 'लाइव 24/7' : 'Live 24/7'}
  </span>
  </div>

  {/* Quick Requisition & Compatibility Box */}
  <div className="mt-4 border border-ink-100 bg-ink-50 p-4 sm:p-5 space-y-4">
  <div className="flex items-center justify-between">
  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-700">
  <span className="h-2 w-2 rounded-full bg-blood-600 inline-block" />
  {isHi ? 'अपना / आवश्यक रक्त समूह चुनें:' : 'Select Blood Group To Check:'}
  </span>
  <span className="border border-ink-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-600">
  {isHi ? 'संदर्भ गाइड' : 'Reference Guide'}
  </span>
  </div>

 {/* Blood Group Buttons */}
 <div className="grid grid-cols-4 gap-2">
 {['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'].map((type) => {
 const isActive = quickBlood === type;
 return (
 <motion.button
 key={type}
 type="button"
 whileHover={{ scale: 1.05 }}
 whileTap={{ scale: 0.94 }}
 onClick={() => setQuickBlood(type)}
  className={`relative h-11 border text-sm font-bold font-mono transition-colors cursor-pointer flex items-center justify-center gap-1 overflow-hidden ${
  isActive
  ? 'border-blood-600 text-white'
  : 'border-ink-200 bg-white text-ink-600 hover:border-ink-900'
  }`}
 >
 {isActive && (
 <motion.div
 layoutId="activeBloodGroupIndicator"
 className="absolute inset-0 bg-blood-600 z-0 "
 transition={{ type: 'spring', stiffness: 380, damping: 28 }}
 />
 )}
 <span className="relative z-10">{type}</span>
 </motion.button>
 );
 })}
 </div>

 {/* Dynamic Compatibility Display Matrix */}
 <AnimatePresence mode="wait">
 <motion.div
 key={quickBlood}
 initial={{ opacity: 0, y: 12, scale: 0.97 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: -8, scale: 0.97 }}
 transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
 className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1"
 >
  {/* Box 1: Can Receive From */}
  <div className="p-3.5 bg-white border border-blue-200 space-y-2.5 transition-colors hover:border-ink-300">
  <div className="flex items-center gap-1.5 text-blue-700 font-bold text-[11px] uppercase tracking-[0.14em]">
  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
  <span>{isHi ? 'किससे रक्त ले सकते हैं (Recipients)' : 'Can Receive Blood From:'}</span>
  </div>
  <div className="flex flex-wrap gap-1.5 min-h-[28px] items-center">
  {currentCompat.canReceiveFrom.map((badge, i) => (
  <motion.span
  key={`${quickBlood}-rx-${badge}`}
  initial={{ opacity: 0, scale: 0.8, y: 4 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  transition={{ delay: i * 0.04, type: 'spring', stiffness: 450, damping: 25 }}
  whileHover={{ scale: 1.08, y: -1 }}
  className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 font-mono font-bold text-xs cursor-default"
  >
  {badge}
  </motion.span>
  ))}
  </div>
  </div>

  {/* Box 2: Can Donate To */}
  <div className="p-3.5 bg-white border border-vital-200 space-y-2.5 transition-colors hover:border-ink-300">
  <div className="flex items-center gap-1.5 text-vital-700 font-bold text-[11px] uppercase tracking-[0.14em]">
  <span className="h-1.5 w-1.5 rounded-full bg-vital-500 animate-pulse" />
  <span>{isHi ? 'किसे रक्त दे सकते हैं (Donors)' : 'Can Donate Blood To:'}</span>
  </div>
  <div className="flex flex-wrap gap-1.5 min-h-[28px] items-center">
  {currentCompat.canDonateTo.map((badge, i) => (
  <motion.span
  key={`${quickBlood}-tx-${badge}`}
  initial={{ opacity: 0, scale: 0.8, y: 4 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  transition={{ delay: i * 0.04, type: 'spring', stiffness: 450, damping: 25 }}
  whileHover={{ scale: 1.08, y: -1 }}
  className="px-2.5 py-1 bg-vital-50 border border-vital-200 text-vital-700 font-mono font-bold text-xs cursor-default"
  >
  {badge}
  </motion.span>
  ))}
  </div>
  </div>
 </motion.div>
 </AnimatePresence>

 {/* Action CTAs */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
 <motion.button
 type="button"
 whileHover={{ scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 onClick={() => {
 onNavigate('request');
 window.scrollTo({ top: 0, behavior: 'smooth' });
 }}
  className="w-full flex items-center justify-center gap-2 bg-blood-600 hover:bg-blood-700 active:bg-blood-800 py-3.5 px-4 text-xs font-bold text-white transition-colors cursor-pointer group"
  >
  <Heart className="w-4 h-4 text-white fill-white animate-pulse shrink-0" />
 <AnimatePresence mode="wait">
 <motion.span
 key={`cta-req-${quickBlood}`}
 initial={{ opacity: 0, y: 5 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -5 }}
 transition={{ duration: 0.15 }}
 >
 {isHi ? `${quickBlood} रक्त का अनुरोध करें →` : `Request ${quickBlood} Blood →`}
 </motion.span>
 </AnimatePresence>
 </motion.button>

 <motion.button
 type="button"
 whileHover={{ scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 onClick={() => {
 onNavigate('donor-register');
 window.scrollTo({ top: 0, behavior: 'smooth' });
 }}
  className="w-full flex items-center justify-center gap-2 bg-white border border-ink-300 hover:border-ink-900 py-3.5 px-4 text-xs font-bold text-ink-900 transition-colors cursor-pointer group"
  >
  <Droplet className="w-4 h-4 text-blood-600 fill-blood-600 shrink-0" />
 <AnimatePresence mode="wait">
 <motion.span
 key={`cta-don-${quickBlood}`}
 initial={{ opacity: 0, y: 5 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -5 }}
 transition={{ duration: 0.15 }}
 >
 {isHi ? `${quickBlood} रक्तदाता बनें →` : `Register as ${quickBlood} Donor →`}
 </motion.span>
 </AnimatePresence>
 </motion.button>
 </div>
 </div>

 {/* Request details simulation */}
 <AnimatePresence mode="wait">
 <motion.div
 key={`stats-${quickBlood}`}
 initial={{ opacity: 0, y: 6 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -6 }}
 transition={{ duration: 0.2 }}
 className="mt-4 grid grid-cols-2 gap-2.5"
 >
 {[
 { label: isHi ? 'चयनित समूह' : 'Selected Group', value: quickBlood, color: 'blood' },
 {
 label: isHi ? 'तैयार रक्तदाता' : 'Verified Donors',
 value: stats.bloodGroupCounts[quickBlood] ? `${stats.bloodGroupCounts[quickBlood]} ${isHi ? 'पंजीकृत' : 'Registered'}` : isHi ? 'सक्रिय नेटवर्क' : 'Active Network',
 color: 'ink'
 },
 ].map((s) => (
  <div
  key={s.label}
  className="border border-ink-200 bg-white p-4 transition-colors hover:border-ink-300"
  >
  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
  {s.label}
  </p>
  <p
  className={`mt-1 text-base sm:text-lg font-display font-extrabold tracking-tight tabular-nums ${
  s.color === "blood" ? "text-blood-600" : "text-ink-900"
  }`}
  >
  {s.value}
  </p>
  </div>
 ))}
 </motion.div>
 </AnimatePresence>


 </div>

 {/* Floating stat */}
 <motion.div
 initial={{ opacity: 0, y: 10, x: 10 }}
 animate={{ opacity: 1, y: 0, x: 0 }}
 transition={{ delay: 0.8, duration: 0.6 }}
  className="absolute -top-4 -right-3 sm:-right-6 hidden sm:flex items-center gap-2.5 border border-vital-200 bg-vital-50 px-3 py-2"
  >
  <span className="h-1.5 w-1.5 rounded-full bg-vital-600 animate-pulse" />
  <div>
  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-vital-700">{isHi ? 'तुरंत अलर्ट' : 'Instant Alerting'}</p>
 <p className="text-[12.5px] font-semibold text-ink-900">
 {isHi ? 'रीयल-टाइम SMS व WhatsApp' : 'Real-time SMS & WhatsApp'}
 </p>
 </div>
 </motion.div>
 </motion.div>
 );
}
