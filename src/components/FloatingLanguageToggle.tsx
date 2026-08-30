import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Check } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

export function FloatingLanguageToggle() {
 const { language, setLanguage } = useLanguage();
 const isHi = language === 'HI';

 return (
 <motion.div
 initial={{ opacity: 0, y: 20, scale: 0.9 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.3 }}
 className="fixed bottom-20 left-4 sm:bottom-6 sm:left-6 z-50 flex items-center gap-1 border border-ink-800 bg-ink-950 p-1"
>
 <div className="flex items-center gap-1 pl-1 pr-0.5 text-ink-400">
 <Globe className="h-4 w-4" />
 <span className="hidden sm:inline font-mono text-[10px] font-semibold uppercase tracking-[0.08em]">
 {isHi ? 'भाषा' : 'Language'}
 </span>
 </div>

 <div className="flex items-center gap-1">
 <button
 onClick={() => setLanguage('EN')}
 className={`relative px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors cursor-pointer flex items-center gap-1 ${
 !isHi
 ? 'bg-blood-600 text-white'
 : 'text-ink-300 hover:text-white'
 }`}
 title="Switch to English"
>
 <span>EN</span>
 {!isHi && <Check className="h-3 w-3 stroke-[3]" />}
 </button>

 <button
 onClick={() => setLanguage('HI')}
 className={`relative px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors cursor-pointer flex items-center gap-1 ${
 isHi
 ? 'bg-blood-600 text-white'
 : 'text-ink-300 hover:text-white'
 }`}
 title="हिंदी में बदलें (Switch to Hindi)"
>
 <span>हिंदी</span>
 {isHi && <Check className="h-3 w-3 stroke-[3]" />}
 </button>
 </div>
 </motion.div>
 );
}
