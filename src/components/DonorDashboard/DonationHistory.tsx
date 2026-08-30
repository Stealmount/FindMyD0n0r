import React from 'react';
import { DonationLog, BloodRequest, User } from '../../types';
import { useLanguage } from '../../lib/LanguageContext';
import { Heart, Clock, MapPin, Calendar } from 'lucide-react';

interface DonationHistoryProps {
 logs: DonationLog[];
 requests: BloodRequest[];
 currentUser: User;
}

/** Past donation timeline. */
export default function DonationHistory({ logs, requests, currentUser }: DonationHistoryProps) {
 const { t, language } = useLanguage();
 const isHi = language === 'HI';

  return (
  <>
   <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 pb-3 min-w-0">
   <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-ink-900 min-w-0">
  <Clock className="w-4 h-4 text-blood-400 shrink-0" />
   <span className="truncate">{t.donorDashboard.donationHistory}</span>
   </h3>
  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500 shrink-0">Your Life-Saving Impact</span>
  </div>

   {logs.length === 0 ? (
   <div className="border border-ink-200 bg-ink-50 px-4 py-10 text-center">
   <Calendar className="mx-auto mb-3 h-9 w-9 text-ink-500" />
   <p className="text-[13px] font-semibold text-ink-900">No Donation History Found</p>
   <p className="mt-1.5 text-[12px] leading-relaxed text-ink-500">
   You haven't logged any donations yet. Use Report a Donation on your dashboard to log one!
   </p>
  </div>
   ) : (
   <div className="relative ml-3 space-y-4 border-l-2 border-ink-200 py-2 pl-4 sm:pl-6 text-left overflow-hidden">
 {logs.map((log) => {
 const req = requests.find(r => r.id === log.request_id);
 const hospitalName = req ? req.hospital_name : 'External Location / Event';
 const locationInfo = req ? `${req.hospital_area}, ${req.hospital_city} (${req.hospital_pincode})` : log.notes;
 const bloodType = req ? req.blood_type_needed : currentUser.blood_type;

 return (
 <div key={log.id} className="relative">
 {/* Bullet point on the timeline */}
  <span className="absolute -left-[33px] top-2 h-3 w-3 rounded-full border-2 border-blood-600 bg-white" />

   <div className="space-y-2.5 border border-ink-200 bg-white p-4 text-ink-900 min-w-0 overflow-hidden">
  <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
 <div className="flex items-center gap-2">
  <span className="border border-ink-200 bg-ink-50 px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-ink-600">
 {new Date(log.donation_date).toLocaleDateString('en-US', {
 year: 'numeric',
 month: 'short',
 day: 'numeric',
 })}
 </span>
  <span className={`inline-flex items-center border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${
  log.source === 'platform_match' ? 'border-blood-500 bg-blood-600 text-white' : 'border border-ink-200 bg-ink-100 text-ink-600'
  }`}>
 {log.source.replace('_', ' ')}
 </span>
 </div>
 <span className="bg-blood-600 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-white">
 Blood Group: {bloodType}
 </span>
 </div>

  <div className="space-y-1">
  <h4 className="text-[15px] font-semibold text-ink-900">{hospitalName}</h4>
  <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-600">
 <MapPin className="w-3.5 h-3.5 shrink-0" />
 {locationInfo}
 </p>
 </div>

  {req && log.notes && (
  <p className="border border-ink-100 bg-ink-50 p-2.5 text-[11px] text-ink-600">
  &ldquo;{log.notes}&rdquo;
  </p>
  )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </>
 );
}
