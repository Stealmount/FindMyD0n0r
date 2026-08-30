import React from 'react';
import { Shield, BadgeCheck, AlertTriangle, Bell } from 'lucide-react';
import { InstitutionType } from '../../types';

interface HospitalHeaderProps {
 hospital: { hospital_name: string; institution_type: InstitutionType; status: string; phone: string; city: string };
 contact_name?: string;
 contact_email?: string;
 criticalCount: number;
 lowCount: number;
 onLanguageChange: (lang: 'EN' | 'HI') => void;
 onLogout: () => void;
 language: 'EN' | 'HI';
 lastSync: Date | null;
}

export function HospitalHeader({
 hospital,
 contact_name,
 contact_email,
 criticalCount,
 lowCount,
 onLanguageChange,
 onLogout,
 language,
 lastSync,
}: HospitalHeaderProps) {
 const isHi = language === 'HI';

 return (
   <header className="sticky top-0 z-20 border-b border-ink-200 bg-white px-4 md:px-6 py-3 flex items-center justify-between gap-4">
   <div className="flex items-center gap-3 min-w-0 flex-1">
   <div className="grid h-10 w-10 shrink-0 place-items-center bg-blood-600">
   <Shield className="h-5 w-5 text-white" />
  </div>
  <div className="min-w-0">
  <div className="flex items-center gap-2 flex-wrap">
  <h1 className="text-[15px] font-bold text-ink-900 tracking-tight leading-tight truncate">
  {hospital.hospital_name}
  </h1>
   <span className="flex items-center gap-1 px-2 py-0.5 bg-vital-500/10 border border-vital-500/30 text-vital-600 text-[10px] font-bold uppercase tracking-widest shrink-0">
  <BadgeCheck className="w-3 h-3" /> Verified
  </span>
  {criticalCount> 0 && (
   <span className="flex items-center gap-1 px-2 py-0.5 bg-blood-500/10 border border-blood-500/30 text-blood-600 text-[10px] font-bold shrink-0">
  <AlertTriangle className="w-3 h-3" />
  {criticalCount} {isHi ? 'गंभीर' : 'Critical'}
  </span>
  )}
  {lowCount> 0 && criticalCount === 0 && (
   <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-600 text-[10px] font-bold shrink-0">
  <AlertTriangle className="w-3 h-3" />
  {lowCount} {isHi ? 'कम' : 'Low'}
  </span>
  )}
  </div>
  <p className="text-[11px] font-medium text-ink-500 truncate">
 {hospital.institution_type === 'blood_bank'
 ? (isHi ? 'लाइव स्टॉक और आपातकालीन अनुरोध' : 'Live Stock & Emergency Requests')
 : hospital.institution_type === 'ngo'
 ? (isHi ? 'शिविर प्रबंधन और समुदाय' : 'Camp Management & Community')
 : (isHi ? 'लाइव इन्वेंट्री और कंट्रोल टॉवर' : 'Live Inventory & Control Tower')}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2 sm:gap-3 shrink-0">
   <div className="inline-flex items-center border border-ink-200 bg-ink-50 p-1 gap-1">
   {(['EN', 'HI'] as const).map(lang => (
   <button key={lang}
   onClick={() => onLanguageChange(lang)}
   className={`px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${language === lang ? 'bg-blood-600 text-white' : 'text-ink-600 hover:text-ink-900'}`}
>
  {lang}
  </button>
  ))}
  </div>
  {(contact_name || contact_email) && (
   <div className="flex flex-col items-end leading-tight min-w-0 border border-ink-200 bg-ink-50 px-3 py-1.5 text-ink-500">
  {contact_name && (
  <span className="text-sm font-semibold text-ink-900 truncate max-w-[200px]">{contact_name}</span>
  )}
  {contact_email && (
  <span className="text-xs text-ink-500 truncate max-w-[200px]">{contact_email}</span>
  )}
  </div>
  )}
  <button
  onClick={onLogout}
   className="inline-flex h-9 cursor-pointer select-none items-center justify-center gap-2 border border-ink-300 px-4 text-[13px] font-semibold text-ink-700 transition-colors duration-200 hover:border-ink-500 hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600"
>
 <Bell className="h-4 w-4" />
 <span className="hidden sm:inline">{isHi ? 'लॉगआउट' : 'Logout'}</span>
 </button>
 </div>
 </header>
 );
}
