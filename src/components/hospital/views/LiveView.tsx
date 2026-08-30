import React from 'react';
import { motion } from 'framer-motion';
import { Droplet, Plus, Minus, Radio } from 'lucide-react';
import { BloodType, InstitutionType } from '../../../types';
import { EmptyState } from '../widgets/Shared';
import { EmergencyConsole } from '../widgets/EmergencyConsole';

interface LiveViewProps {
 inventory: Record<BloodType, number>;
 setInventory: React.Dispatch<React.SetStateAction<Record<BloodType, number>>>;
 activeMatches: Array<{
 id?: string;
 request_id?: string;
 donor_id?: string;
 donorName: string;
 donorPhone: string;
 donor_response: string;
 distance_km?: number;
 is_exact_match?: boolean;
 }>;
 loadingMatches: boolean;
 fetchLiveMatches: () => Promise<void>;
 isHi: boolean;
 institutionType: InstitutionType;

 // Emergency console state lifted to shell
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
}

export function LiveView({
 inventory, setInventory, activeMatches, loadingMatches, fetchLiveMatches,
 isHi, institutionType,
 selectedBlood, setSelectedBlood, units, setUnits, urgency, setUrgency,
 patientName, setPatientName, requestStatus, notifiedCount, onBroadcast,
}: LiveViewProps) {
 const adjustInventory = (type: BloodType, delta: number) =>
 setInventory(prev => ({ ...prev, [type]: Math.max(0, prev[type] + delta) }));

 const bloodTypes: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

 return (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 animate-fade-in">
 {/* Left: Inventory + Live Matches */}
 <div className="lg:col-span-8 space-y-8">
 {institutionType !== 'ngo' && (
  <section className="border border-ink-200 bg-ink-50 p-5 sm:p-7">
  <div className="flex justify-between items-center mb-5">
  <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-500">
  {isHi ? 'लाइव रक्त सूची (इन्वेंट्री मैट्रिक्स)' : 'Live Inventory Matrix'}
  </h2>
  <span className="text-[11px] text-ink-500">
  {isHi ? 'संख्या समायोजित करने के लिए + / - का उपयोग करें' : 'Use + / - to adjust levels'}
  </span>
  </div>

 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
 {bloodTypes.map(type => {
 const count = inventory[type];
 const isCritical = count <= 3;
 const isLow = count > 3 && count <= 6;
  const cardStyle = isCritical
  ? 'border-blood-500/45 bg-blood-500/10'
  : isLow ? 'border-amber-500/40 bg-amber-500/10'
  : 'border-ink-200 bg-white';
  const textStyle = isCritical ? 'text-blood-600' : isLow ? 'text-amber-600' : 'text-ink-800';
  const dropColor = isCritical ? 'text-blood-400 fill-blood-400/20' : isLow ? 'text-amber-600' : 'text-ink-400';
 return (
 <motion.div
 key={type}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: bloodTypes.indexOf(type) * 0.04 }}
 className={`p-4 border transition-colors duration-200 relative group flex flex-col justify-between ${cardStyle}`}
 >
 <div className="flex items-center justify-between mb-2">
 <Droplet className={`h-4 w-4 ${dropColor}`} strokeWidth={2} />
  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 ${
  isCritical ? 'bg-blood-500/15 text-blood-600' : isLow ? 'bg-amber-500/15 text-amber-600' : 'bg-ink-100 text-ink-600'
  }`}>
 {isCritical ? (isHi ? 'गंभीर' : 'Critical') : isLow ? (isHi ? 'कम' : 'Low') : (isHi ? 'स्थिर' : 'Stable')}
 </span>
 </div>
 <div className="text-center my-2">
 <div className="text-3xl font-extrabold tracking-tight mb-1">{type}</div>
 <div className={`text-[13px] font-semibold ${textStyle}`}>
 {count} {isHi ? 'यूनिट' : 'units'}
 </div>
 </div>
  <div className="flex justify-center gap-1.5 mt-2 pt-2 border-t border-ink-200 opacity-80 group-hover:opacity-100 transition-opacity">
  <button onClick={() => adjustInventory(type, -1)}
  className="p-1 bg-ink-100 hover:bg-ink-200 border border-ink-200 text-ink-500 hover:text-ink-900 cursor-pointer transition"
  title={isHi ? '1 यूनिट घटाएं' : 'Decrease'}>
  <Minus size={13} />
  </button>
  <button onClick={() => adjustInventory(type, 1)}
  className="p-1 bg-ink-100 hover:bg-ink-200 border border-ink-200 text-ink-500 hover:text-ink-900 cursor-pointer transition"
  title={isHi ? '1 यूनिट जोड़ें' : 'Increase'}>
  <Plus size={13} />
  </button>
  </div>
 </motion.div>
 );
 })}
 </div>
 </section>
 )}

  <section className="border border-ink-200 bg-ink-50 p-5 sm:p-7">
  <div className="flex items-center justify-between mb-6">
  <div>
  <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-500">
  {isHi ? 'आने वाले स्वैच्छिक रक्तदाता' : 'Incoming Matched Donors'}
  </h2>
  <p className="text-[11px] text-ink-500 mt-1">
  {isHi ? 'रीयल-टाइम प्रतिक्रिया ट्रैकिंग' : 'Real-time response tracking from matched network alerts'}
  </p>
  </div>
  <div className="flex items-center gap-2">
   <button onClick={fetchLiveMatches}
   className="grid h-9 w-9 cursor-pointer place-items-center border border-ink-300 text-ink-600 transition-colors duration-200 hover:border-ink-400 hover:bg-ink-100 hover:text-ink-900"
   title="Refresh">
   <Radio className="h-4 w-4" />
   </button>
   <span className="border border-blood-500/30 bg-blood-500/10 px-3 py-1 text-[12px] font-bold text-blood-600">
  {activeMatches.length} {isHi ? 'सक्रिय' : 'Active'}
  </span>
  </div>
  </div>

 {loadingMatches ? (
 <div className="py-8 text-center text-ink-400 text-sm">
 <span className="animate-pulse">{isHi ? 'सिंक हो रहा है...' : 'Syncing donor network matches...'}</span>
 </div>
 ) : activeMatches.length === 0 ? (
 <EmptyState
 title={isHi ? 'कोई आने वाला रक्तदाता नहीं है' : 'No incoming donor matches yet'}
 titleHi={isHi ? 'कोई आने वाला रक्तदाता नहीं है' : 'No incoming donor matches yet'}
 hint={isHi ? 'इमरजेंसी कंसोल से पिंग करें।' : 'Use the Emergency Console to trigger alerts.'}
 hintHi={isHi ? 'इमरजेंसी कंसोल से पिंग करें।' : 'Use the Emergency Console to trigger alerts.'}
 isHi={isHi}
 />
 ) : (
 <div className="space-y-3">
 {activeMatches.map(match => {
 const s = match.donor_response;
 return (
 <motion.div
 key={match.id}
 initial={{ opacity: 0, y: 6 }}
 animate={{ opacity: 1, y: 0 }}
   className="flex flex-col gap-4 border border-ink-200 bg-white p-4 transition-colors hover:bg-ink-100 sm:flex-row sm:items-center justify-between"
   >
   <div className="flex items-center gap-3">
   <div className="w-10 h-10 rounded-full bg-blood-600 flex items-center justify-center text-white font-bold text-sm">
  {match.donorName.charAt(0)}
  </div>
  <div>
  <div className="text-[14px] font-bold text-ink-900 flex items-center gap-2">
  {match.donorName}
   {match.is_exact_match && (
   <span className="border border-vital-500/30 bg-vital-500/10 px-1.5 py-0.5 text-[9px] font-bold text-vital-600 ">
  {isHi ? 'सटीक मिलान' : 'Exact Match'}
  </span>
  )}
  </div>
   <div className="text-[12px] text-ink-500 mt-0.5 font-medium">
   {isHi ? 'संपर्क:' : 'Contact:'} <strong className="font-mono text-ink-900">{match.donorPhone}</strong>
  {match.distance_km && ` · ~${match.distance_km} km`}
  </div>
  </div>
  </div>
   <span className={`whitespace-nowrap border px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] ${
   s === 'approved' ? 'border-vital-500/30 bg-vital-500/10 text-vital-600'
   : s === 'declined' ? 'border-blood-500/30 bg-blood-500/10 text-blood-600'
   : 'animate-pulse border-ink-200 bg-ink-100 text-ink-600'
   }`}>
 {s === 'approved' ? (isHi ? 'स्वीकृत' : 'Approved')
 : s === 'declined' ? (isHi ? 'अस्वीकृत' : 'Declined')
 : (isHi ? 'प्रतीक्षारत' : 'Pending Reply')}
 </span>
 </motion.div>
 );
 })}
 </div>
 )}
 </section>
 </div>

 {/* Right column */}
 <div className="lg:col-span-4 space-y-6 sm:space-y-8">
  {institutionType !== 'ngo' && (
  <section className="border border-ink-200 bg-ink-50 p-5 sm:p-7">
  <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-500">
  {isHi ? 'रक्त समूह के अनुसार मांग' : 'Demand by Blood Type'}
  </h2>
  <p className="text-[10px] font-mono text-ink-500 mb-5">
  {isHi ? 'वर्तमान इन्वेंट्री स्तरों से तत्काल आवश्यकता' : 'Derived from current inventory — lower stock = higher urgency'}
  </p>
  <div className="h-32 w-full flex items-end justify-between px-2">
  {bloodTypes.map(bt => {
  const stock = inventory[bt] ?? 0;
  const urgent = stock <= 3;
  const pct = Math.max(8, Math.min(100, Math.round(((8 - stock) / 8) * 100)));
  return (
  <div key={bt} className="relative w-[10%] bg-ink-100" style={{ height: '100%' }} title={`${bt}: ${stock} units`}>
  <div className={`absolute bottom-0 w-full transition-all duration-1000 ${urgent ? 'bg-blood-600' : 'bg-ink-300'}`}
  style={{ height: `${pct}%` }} />
  </div>
  );
  })}
  </div>
  <div className="flex justify-between text-[10px] font-mono text-ink-500 px-2 mt-2">
  {bloodTypes.map(bt => {
  const urgent = (inventory[bt] ?? 0) <= 3;
  return (
  <span key={bt} className={urgent ? 'text-blood-400 font-bold' : ''}>{bt}</span>
  );
  })}
  </div>
  </section>
  )}

 <EmergencyConsole
 inventory={inventory}
 selectedBlood={selectedBlood}
 setSelectedBlood={setSelectedBlood}
 units={units}
 setUnits={setUnits}
 urgency={urgency}
 setUrgency={setUrgency}
 patientName={patientName}
 setPatientName={setPatientName}
 requestStatus={requestStatus}
 notifiedCount={notifiedCount}
 onBroadcast={onBroadcast}
 isHi={isHi}
 />
 </div>
 </div>
 );
}

