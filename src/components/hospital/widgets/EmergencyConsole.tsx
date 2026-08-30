import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Check, ShieldAlert, ChevronDown } from 'lucide-react';
import { BloodType } from '../../../types';

interface EmergencyConsoleProps {
 inventory: Record<BloodType, number>;
 selectedBlood: BloodType;
 setSelectedBlood: (b: BloodType) => void;
 units: number;
 setUnits: (n: number) => void;
 urgency: 'critical' | 'urgent' | 'planned';
 setUrgency: (u: 'critical' | 'urgent' | 'planned') => void;
 patientName: string;
 setPatientName: (s: string) => void;
 requestStatus: 'idle' | 'broadcasting' | 'sent' | 'error';
 notifiedCount: number;
 onBroadcast: (e: React.FormEvent) => void;
 isHi: boolean;
}

export function EmergencyConsole({
 inventory, selectedBlood, setSelectedBlood, units, setUnits,
 urgency, setUrgency, patientName, setPatientName,
 requestStatus, notifiedCount, onBroadcast, isHi,
}: EmergencyConsoleProps) {
 return (
  <section className="border border-blood-500/30 bg-blood-600/10 p-5 sm:p-7">
 <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-blood-400 mb-1">
 {isHi ? 'आपातकालीन कंसोल' : 'Emergency Console'}
 </h2>
  <h3 className="text-xl font-bold text-ink-900 mb-5 tracking-tight">
 {isHi ? 'आपातकालीन रक्त अनुरोध भेजें' : 'Broadcast Emergency Request'}
 </h3>

 <AnimatePresence mode="wait">
 {requestStatus === 'idle' && (
 <motion.form key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 onSubmit={onBroadcast} className="space-y-4"
 >
 <div className="space-y-1.5">
 <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block">
 {isHi ? 'रोगी का नाम / संदर्भ' : 'Patient Name / Ref'}
 </label>
 <input type="text" required value={patientName}
 onChange={e => setPatientName(e.target.value)}
 placeholder="Emergency Patient"
          className="w-full h-11 border border-ink-700 bg-ink-950 px-3.5 text-sm font-medium text-white outline-none transition-colors duration-150 placeholder:text-ink-500 focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500"
  />
  </div>
  <div className="grid grid-cols-2 gap-3">
  <div className="space-y-1.5">
 <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block">
 {isHi ? 'रक्त समूह' : 'Blood Group'}
 </label>
  <div className="relative">
  <select value={selectedBlood} onChange={e => setSelectedBlood(e.target.value as BloodType)}
  className="w-full h-11 cursor-pointer appearance-none border border-ink-300 bg-white pl-3.5 pr-9 text-sm font-medium text-ink-900 outline-none transition-colors duration-150 focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500"
  >
  {(Object.keys(inventory) as BloodType[]).map(t => <option key={t} value={t}>{t}</option>)}
  </select>
  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
  </div>
 </div>
 <div className="space-y-1.5">
 <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block">
 {isHi ? 'आवश्यक इकाइयाँ' : 'Units'}
 </label>
 <input type="number" required min={1} max={10} value={units}
 onChange={e => setUnits(parseInt(e.target.value, 10))}
  className="w-full h-11 border border-ink-300 bg-white px-3.5 text-sm font-medium text-ink-900 outline-none transition-colors duration-150 focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500"
 />
 </div>
 </div>
 <div className="space-y-1.5">
 <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block">
 {isHi ? 'तत्कालता स्तर' : 'Urgency'}
 </label>
  <div className="relative">
  <select value={urgency} onChange={e => setUrgency(e.target.value as typeof urgency)}
  className="w-full h-11 cursor-pointer appearance-none border border-ink-300 bg-white pl-3.5 pr-9 text-sm font-medium text-ink-900 outline-none transition-colors duration-150 focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500"
  >
  <option value="critical">{isHi ? 'गंभीर (तत्काल)' : 'Critical (Immediate)'}</option>
  <option value="urgent">{isHi ? 'आवश्यक (4 घंटे में)' : 'Urgent (Within 4 hrs)'}</option>
  <option value="planned">{isHi ? 'नियोजित (सर्जरी)' : 'Planned (Surgery)'}</option>
  </select>
  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
  </div>
 </div>
 <button type="submit"
  className="inline-flex h-12 w-full cursor-pointer select-none items-center justify-center gap-2 bg-blood-600 px-6 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blood-700 active:bg-blood-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600"
 >
 <Send className="h-4 w-4" />
 {isHi ? 'रक्तदाता नेटवर्क पिंग करें' : 'Ping Donor Network'}
 </button>
 </motion.form>
 )}

 {requestStatus === 'broadcasting' && (
 <motion.div key="broadcasting" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
 className="py-12 flex flex-col items-center justify-center text-center"
 >
  <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blood-500/30 border-t-blood-500" />
  <p className="text-sm font-bold text-ink-900">{isHi ? 'अनुरोध प्रसारित किया जा रहा है...' : 'Broadcasting Request...'}</p>
  <p className="text-[11px] text-ink-500 mt-1">{isHi ? 'संगत रक्तदाताओं की खोज जारी है' : 'Locating eligible donors within proximity radius'}</p>
 </motion.div>
 )}

 {requestStatus === 'sent' && (
 <motion.div key="sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
 className="py-12 flex flex-col items-center justify-center text-center"
 >
  <div className="mb-4 grid h-14 w-14 place-items-center border border-vital-500/30 bg-vital-500/10">
  <Check className="h-7 w-7 text-vital-600" strokeWidth={3} />
  </div>
  <p className="text-base font-bold text-ink-900">{isHi ? 'प्रसारण सफल रहा' : 'Broadcast Successful'}</p>
  <p className="text-[12px] text-ink-500 mt-1">
 {isHi ? `${notifiedCount} रक्तदाता अधिसूचित।` : `${notifiedCount} donors matched. Tracking active.`}
 </p>
 </motion.div>
 )}

 {requestStatus === 'error' && (
 <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 className="py-12 flex flex-col items-center justify-center text-center"
 >
  <ShieldAlert className="mb-4 h-12 w-12 text-blood-400" />
  <p className="text-sm font-bold text-ink-900">{isHi ? 'प्रसारण विफल हुआ' : 'Broadcast Failed'}</p>
  <p className="text-[11px] text-ink-500 mt-1">{isHi ? 'API कनेक्शन जांचें।' : 'Check API connection status'}</p>
 </motion.div>
 )}
 </AnimatePresence>
 </section>
 );
}
