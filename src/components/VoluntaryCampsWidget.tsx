import React from 'react';
import { Calendar, MapPin, Phone, Building, ArrowUpRight, HeartHandshake } from 'lucide-react';
import { INITIAL_VOLUNTARY_CAMPS } from '../data/bloodBankData';
import { DonationCamp } from '../types';

interface VoluntaryCampsWidgetProps {
 userPincode?: string;
 onNavigate?: (view: string) => void;
}

export function VoluntaryCampsWidget({ userPincode, onNavigate }: VoluntaryCampsWidgetProps) {
 const [camps, setCamps] = React.useState<DonationCamp[]>(INITIAL_VOLUNTARY_CAMPS);

 React.useEffect(() => {
 fetch('/api/camps?limit=6')
 .then(res => res.json())
 .then(data => {
 if (Array.isArray(data?.camps) && data.camps.length> 0) {
 setCamps(data.camps);
 }
 })
 .catch(() => { /* keep fallback */ });
 }, []);

 return (
 <div className="bg-ink-950/90 border border-white/10 p-6 space-y-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="grid h-10 w-10 place-items-center bg-blood-500/10 border border-blood-500/20 text-blood-400">
 <HeartHandshake className="h-5 w-5" />
 </div>
 <div>
 <h3 className="text-lg font-black text-white">Voluntary Blood Donation Drives</h3>
 <p className="text-xs text-ink-300">Organized by Red Cross, Rotary, & e-Raktkosh Network</p>
 </div>
 </div>

 <button
 type="button"
 onClick={() => onNavigate?.('blood-banks')}
 className="text-xs font-bold text-blood-400 hover:text-blood-300 flex items-center gap-1 cursor-pointer"
>
 View All <ArrowUpRight className="h-3.5 w-3.5" />
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {camps.map((camp: DonationCamp) => (
 <div
 key={camp.id}
 className="bg-white/5 border border-white/10 p-4 hover:border-blood-500/40 transition space-y-3"
>
 <div className="flex items-start justify-between gap-2">
 <h4 className="font-bold text-sm text-white leading-snug">{camp.title}</h4>
 <span className="shrink-0 px-2 py-0.5 bg-vital-500/10 text-vital-400 text-[10px] font-bold border border-vital-500/20">
 Verified Camp
 </span>
 </div>

 <div className="space-y-1.5 text-xs text-ink-300">
 <p className="flex items-center gap-1.5 font-semibold text-white">
 <Calendar className="h-3.5 w-3.5 text-blood-500 shrink-0" />
 {camp.camp_date} ({camp.start_time} - {camp.end_time})
 </p>
 <p className="flex items-start gap-1.5">
 <MapPin className="h-3.5 w-3.5 text-blood-500 shrink-0 mt-0.5" />
 {camp.venue_address}, {camp.city} ({camp.pincode})
 </p>
 <p className="flex items-center gap-1.5">
 <Building className="h-3.5 w-3.5 text-ink-400 shrink-0" />
 {camp.organizer_name}
 </p>
 </div>

 <div className="pt-2 flex items-center gap-2">
 <a
 href={`tel:${camp.contact_phone || (camp as any).contact_number}`}
 className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold text-center flex items-center justify-center gap-1 transition"
>
 <Phone className="h-3 w-3 text-vital-400" /> Contact Desk
 </a>
 <a
 href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(camp.venue_address + ', ' + camp.city)}`}
 target="_blank"
 rel="noreferrer"
 className="py-2 px-3 bg-blood-600/80 hover:bg-blood-500 text-white text-xs font-bold flex items-center justify-center gap-1 transition"
>
 Directions
 </a>
 </div>
 </div>
 ))}
 </div>
 </div>
 );
}
