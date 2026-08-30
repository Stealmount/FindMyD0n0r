import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Droplet, ShieldCheck, ArrowUpRight, Menu, X, Globe, User, LogOut, LayoutDashboard, ChevronDown, Settings } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { useAuth } from '../../lib/AuthContext';

interface NavbarProps {
 onNavigate: (view: 'home' | 'request' | 'tracking' | 'donor-register' | 'requester-register' | 'donor-dashboard' | 'requester-portal' | 'donor-profile' | 'institution-signup' | 'auth-signin' | 'hospital-register' | 'admin') => void;
}

export function Navbar({ onNavigate }: NavbarProps) {
 const { loggedInUser, loggedInRequester, logout } = useAuth();
 const identity = loggedInUser ?? loggedInRequester;
 const identityEmail = identity?.email || '';
 const avatarInitial = (identity?.full_name?.charAt(0) || 'U').toUpperCase();
 const [scrolled, setScrolled] = useState(false);
 const [open, setOpen] = useState(false);
 const [profileOpen, setProfileOpen] = useState(false);
 const profileRef = useRef<HTMLDivElement>(null);
 const { language, setLanguage } = useLanguage();

 useEffect(() => {
  const onScroll = () => setScrolled(window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
 }, []);

 // Close profile dropdown on outside click
 useEffect(() => {
  const handler = (e: MouseEvent) => {
   if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
  };
  if (profileOpen) document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
 }, [profileOpen]);

 const handleLogout = async () => {
  setProfileOpen(false);
  try { await logout(); } catch { /* ignore */ }
  onNavigate('home');
 };

  return (
   <>
    <motion.header
     initial={{ y: -24, opacity: 0 }}
     animate={{ y: 0, opacity: 1 }}
     transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
     className={`fixed inset-x-0 top-0 z-40 border-b bg-white transition-colors duration-300 ${
      scrolled
       ? "border-ink-200"
       : "border-transparent"
     }`}
    >
      <nav
       className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-3 sm:px-4 lg:px-8 min-w-0"
      >
    {/* Logo */}
     <button
      onClick={() => { onNavigate('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      className="flex items-center gap-2 group cursor-pointer shrink-0 min-w-0"
     >
     <div className="relative grid h-9 w-9 place-items-center bg-blood-600">
      <Droplet className="h-4 w-4 text-white fill-white" strokeWidth={2.2} />
      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-vital-400" />
     </div>
      <span className="text-[15px] sm:text-[17px] font-display font-extrabold tracking-tight text-ink-900 flex items-center min-w-0">
       FindMy<span className="text-blood-600">Donor</span><span className="hidden xs:inline text-[10px] font-bold text-ink-400 ml-0.5 -translate-y-1">™</span>
      </span>
    </button>

    {/* Desktop nav: Home → Donor → Requester → Institutional (Beta) → Track Match */}
     <div className="hidden lg:flex items-center gap-1 xl:gap-1.5">
      <button
       onClick={() => onNavigate('home')}
       className="px-3 py-1.5 text-[13px] font-semibold text-ink-600 hover:text-ink-900 transition-colors cursor-pointer whitespace-nowrap"
      >
       {language === 'HI' ? 'होम' : 'Home'}
      </button>
      <button
       onClick={() => onNavigate('donor-register')}
       className="px-3 py-1.5 text-[13px] font-semibold text-ink-600 hover:text-ink-900 transition-colors cursor-pointer whitespace-nowrap"
      >
       {language === 'HI' ? 'डोनर' : 'Donor'}
      </button>
      <button
       onClick={() => onNavigate('requester-register')}
       className="px-3 py-1.5 text-[13px] font-semibold text-ink-600 hover:text-ink-900 transition-colors cursor-pointer whitespace-nowrap"
      >
       {language === 'HI' ? 'अनुरोधकर्ता' : 'Requester'}
      </button>
      <button
       onClick={() => onNavigate('institution-signup')}
       className="px-3 py-1.5 text-[13px] font-semibold text-ink-600 hover:text-ink-900 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
      >
       <span>{language === 'HI' ? 'संस्थागत (बीटा)' : 'Institutional (Beta)'}</span>
      </button>
      <button
       onClick={() => onNavigate('tracking')}
       className="px-3 py-1.5 text-[13px] font-semibold text-ink-600 hover:text-ink-900 transition-colors cursor-pointer whitespace-nowrap"
      >
       {language === 'HI' ? 'ट्रैक मैच' : 'Track Match'}
      </button>
     </div>

    {/* Right: Auth + Language */}
    <div className="flex items-center gap-2 sm:gap-3">
     <div className="hidden lg:flex items-center gap-2">
      {!loggedInUser && !loggedInRequester ? (
       <button
        onClick={() => onNavigate('auth-signin')}
        className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap px-4 text-[13px] font-semibold bg-blood-600 text-white hover:bg-blood-700 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600"
       >
        <ShieldCheck className="w-3.5 h-3.5 text-white/90" />
        <span>{language === 'HI' ? 'साइन इन' : 'Sign In'}</span>
       </button>
      ) : (
       /* Profile icon + dropdown */
       <div ref={profileRef} className="relative">
        <button
         onClick={() => setProfileOpen(prev => !prev)}
         className="flex items-center gap-1.5 p-0.5 hover:bg-ink-100 transition cursor-pointer"
        >
         <span className="grid h-8 w-8 place-items-center rounded-full bg-blood-600 text-white text-xs font-bold">
          {avatarInitial}
         </span>
         <ChevronDown className={`w-3.5 h-3.5 text-ink-500 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
         {profileOpen && (
          <motion.div
           initial={{ opacity: 0, y: 8, scale: 0.96 }}
           animate={{ opacity: 1, y: 0, scale: 1 }}
           exit={{ opacity: 0, y: 8, scale: 0.96 }}
           transition={{ duration: 0.15 }}
           className="absolute top-full right-0 mt-2 w-64 border border-ink-200 bg-white p-1.5 min-w-[220px] z-50"
          >
            {/* Email */}
            {identityEmail && (
             <div className="px-3 py-2 text-xs font-medium text-ink-500 truncate border-b border-ink-100 mb-1">
              {identityEmail}
             </div>
            )}
            {/* Dashboard */}
            <button
             onClick={() => { setProfileOpen(false); onNavigate(loggedInUser ? 'donor-dashboard' : 'requester-portal'); }}
             className="w-full text-left px-3 py-2.5 text-[13px] font-medium text-ink-700 hover:bg-ink-100 hover:text-ink-900 transition flex items-center gap-2 cursor-pointer"
            >
             <LayoutDashboard className="w-4 h-4 text-ink-500 shrink-0" />
             {language === 'HI' ? 'डैशबोर्ड' : 'Dashboard'}
            </button>
            {/* Profile Settings — donor only */}
            {loggedInUser && (
            <button
             onClick={() => { setProfileOpen(false); onNavigate('donor-profile'); }}
             className="w-full text-left px-3 py-2.5 text-[13px] font-medium text-ink-700 hover:bg-ink-100 hover:text-ink-900 transition flex items-center gap-2 cursor-pointer"
            >
             <Settings className="w-4 h-4 text-ink-500 shrink-0" />
             {language === 'HI' ? 'प्रोफ़ाइल सेटिंग्स' : 'Profile Settings'}
            </button>
            )}
            {/* Logout */}
            <button
             onClick={handleLogout}
             className="w-full text-left px-3 py-2.5 text-[13px] font-medium text-blood-700 hover:bg-blood-50 transition flex items-center gap-2 cursor-pointer"
            >
            <LogOut className="w-4 h-4 shrink-0" />
            {language === 'HI' ? 'लॉग आउट' : 'Logout'}
           </button>
          </motion.div>
         )}
        </AnimatePresence>
       </div>
      )}
     </div>

     {/* Language Switcher */}
     <div className="flex items-center border border-ink-200 bg-ink-100 p-0.5">
      <button
       onClick={() => setLanguage('EN')}
       className={`px-2.5 py-1 text-[11px] font-semibold uppercase transition-colors cursor-pointer ${
        language === 'EN'
         ? 'bg-white text-ink-900'
         : 'text-ink-500 hover:text-ink-900'
       }`}
       title="English"
      >
       EN
      </button>
      <button
       onClick={() => setLanguage('HI')}
       className={`px-2.5 py-1 text-[11px] font-semibold uppercase transition-colors cursor-pointer ${
        language === 'HI'
         ? 'bg-white text-ink-900'
         : 'text-ink-500 hover:text-ink-900'
       }`}
       title="हिन्दी (Hindi)"
      >
       HI
      </button>
     </div>

     {/* Mobile Hamburger */}
     <button
      onClick={() => setOpen((s) => !s)}
      aria-label="Toggle menu"
      className="grid lg:hidden h-9 w-9 place-items-center bg-ink-900 text-white cursor-pointer"
     >
      {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
     </button>
    </div>
    </nav>
   </motion.header>

   {/* Mobile Drawer */}
   <AnimatePresence>
    {open && (
     <>
      <motion.div
       key="scrim"
       initial={{ opacity: 0 }}
       animate={{ opacity: 1 }}
       exit={{ opacity: 0 }}
       transition={{ duration: 0.2 }}
       onClick={() => setOpen(false)}
       className="fixed inset-0 z-[80] bg-ink-950/70 lg:hidden"
      />
       <motion.div
        key="panel"
        initial={{ x: 320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 320, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="fixed right-0 top-0 bottom-0 z-[90] w-[min(20rem,85vw)] max-w-[85vw] overflow-y-auto overflow-x-hidden border-l border-ink-200 bg-white p-4 sm:p-6 lg:hidden"
       >
      <div className="flex flex-col space-y-1">
       {/* Language Switcher */}
       <div className="flex items-center justify-between px-3.5 py-2.5 bg-ink-50 border border-ink-200 mb-1">
        <span className="text-xs font-semibold text-ink-600 flex items-center gap-1.5">
         <Globe className="w-3.5 h-3.5 text-ink-500" />
         Language / भाषा
        </span>
        <div className="flex items-center border border-ink-200 bg-ink-100 p-0.5">
         <button
          onClick={() => setLanguage('EN')}
          className={`px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
           language === 'EN'
            ? 'bg-white text-ink-900'
            : 'text-ink-500 hover:text-ink-900'
          }`}
         >
          EN
         </button>
         <button
          onClick={() => setLanguage('HI')}
          className={`px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
           language === 'HI'
            ? 'bg-white text-ink-900'
            : 'text-ink-500 hover:text-ink-900'
          }`}
         >
          HI (हिन्दी)
         </button>
        </div>
       </div>

       {/* Nav items */}
       <button
        onClick={() => { setOpen(false); onNavigate('home'); }}
        className="w-full text-left px-3.5 py-2.5 text-sm font-semibold text-ink-600 hover:text-ink-900 hover:bg-ink-50 transition-colors flex items-center justify-between"
       >
        <span>{language === 'HI' ? 'होम' : 'Home'}</span>
        <ArrowUpRight className="h-4 w-4" />
       </button>
       <button
        onClick={() => { setOpen(false); onNavigate('donor-register'); }}
        className="w-full text-left px-3.5 py-2.5 text-sm font-semibold text-ink-600 hover:text-ink-900 hover:bg-ink-50 transition-colors flex items-center justify-between"
       >
        <span>{language === 'HI' ? 'डोनर' : 'Donor'}</span>
        <ArrowUpRight className="h-4 w-4" />
       </button>
       <button
        onClick={() => { setOpen(false); onNavigate('requester-register'); }}
        className="w-full text-left px-3.5 py-2.5 text-sm font-semibold text-ink-600 hover:text-ink-900 hover:bg-ink-50 transition-colors flex items-center justify-between"
       >
        <span>{language === 'HI' ? 'अनुरोधकर्ता' : 'Requester'}</span>
        <ArrowUpRight className="h-4 w-4" />
       </button>
       <button
        onClick={() => { setOpen(false); onNavigate('institution-signup'); }}
        className="w-full text-left px-3.5 py-2.5 text-sm font-semibold text-ink-600 hover:text-ink-900 hover:bg-ink-50 transition-colors flex items-center justify-between"
       >
        <span className="flex items-center gap-2">
         {language === 'HI' ? 'संस्थागत (बीटा)' : 'Institutional (Beta)'}
        </span>
        <ArrowUpRight className="h-4 w-4" />
       </button>
       <button
        onClick={() => { setOpen(false); onNavigate('tracking'); }}
        className="w-full text-left px-3.5 py-2.5 text-sm font-semibold text-ink-600 hover:text-ink-900 hover:bg-ink-50 transition-colors flex items-center justify-between"
       >
        <span>{language === 'HI' ? 'ट्रैक मैच' : 'Track Match'}</span>
        <ArrowUpRight className="h-4 w-4" />
       </button>

       <div className="my-1.5 h-px bg-ink-200" />

       {/* Account Actions */}
       {!loggedInUser && !loggedInRequester ? (
        <div className="pt-1">
         <button
          onClick={() => { setOpen(false); onNavigate('auth-signin'); }}
          className="w-full inline-flex items-center justify-center gap-1.5 h-11 bg-blood-600 text-white text-sm font-semibold hover:bg-blood-700 transition-colors"
         >
          <ShieldCheck className="w-4 h-4 text-white" />
          <span>{language === 'HI' ? 'साइन इन' : 'Sign In'}</span>
         </button>
        </div>
       ) : (
        <>
         {/* User info */}
         <div className="flex items-center gap-3 px-3.5 py-2">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-blood-600 text-white text-sm font-bold shrink-0">
           {avatarInitial}
          </span>
          <div className="min-w-0">
           {identityEmail && (
            <span className="block text-xs font-medium text-ink-500 truncate max-w-[180px]">{identityEmail}</span>
           )}
          </div>
         </div>
          {/* Dashboard */}
          <button
           onClick={() => { setOpen(false); onNavigate(loggedInUser ? 'donor-dashboard' : 'requester-portal'); }}
           className="w-full text-left px-3.5 py-2.5 text-[13px] font-medium text-ink-700 hover:bg-ink-100 hover:text-ink-900 transition flex items-center gap-2.5"
          >
           <LayoutDashboard className="w-4 h-4 text-ink-500" />
           {language === 'HI' ? 'डैशबोर्ड' : 'Dashboard'}
          </button>
          {loggedInUser && (
          <button
           onClick={() => { setOpen(false); onNavigate('donor-profile'); }}
           className="w-full text-left px-3.5 py-2.5 text-[13px] font-medium text-ink-700 hover:bg-ink-100 hover:text-ink-900 transition flex items-center gap-2.5"
          >
           <Settings className="w-4 h-4 text-ink-500" />
           {language === 'HI' ? 'प्रोफ़ाइल सेटिंग्स' : 'Profile Settings'}
          </button>
          )}
          {/* Logout */}
          <button
           onClick={() => { setOpen(false); handleLogout(); }}
           className="w-full text-left px-3.5 py-2.5 text-[13px] font-medium text-blood-700 hover:bg-blood-50 transition flex items-center gap-2.5"
          >
           <LogOut className="w-4 h-4" />
           {language === 'HI' ? 'लॉग आउट' : 'Logout'}
          </button>
        </>
       )}

       {/* Request Blood CTA */}
       <button
        onClick={() => { setOpen(false); onNavigate('request'); }}
        className="mt-2 flex w-full items-center justify-center gap-1.5 h-11 bg-blood-600 hover:bg-blood-700 text-sm font-semibold text-white transition-colors"
       >
        {language === 'HI' ? 'खून की ज़रूरत' : 'Request Blood'}
        <ArrowUpRight className="h-4 w-4" />
       </button>
      </div>
      </motion.div>
     </>
     )}
    </AnimatePresence>
   </>
  );
 }
