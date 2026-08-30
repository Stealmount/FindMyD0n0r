import React from 'react';
import { Building2, Activity, Calendar, ArrowRight, MapPin } from 'lucide-react';
import { INITIAL_BLOOD_BANKS, INITIAL_VOLUNTARY_CAMPS } from '../../data/bloodBankData';

interface DirectoriesHubSectionProps {
 onNavigate: (view: any) => void;
}

export function DirectoriesHubSection({ onNavigate }: DirectoriesHubSectionProps) {
 return (
 <section className="relative py-20 sm:py-24 bg-ink-50 border-y border-ink-200">
  <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

  {/* Header */}
  <div className="max-w-2xl space-y-3">
  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
  Powered by e-Raktkosh · National Blood Transfusion Council
  </p>
  <h2 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink-900">
  Access 3,500+ Verified Blood Banks & Live Stock
  </h2>
  <p className="text-[17px] leading-relaxed text-ink-600">
  Real-time government and private blood bank inventory, live stock levels, and upcoming voluntary donation drives across India.
  </p>
  </div>

  {/* 3 Cards */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

  {/* Card 1 — Blood Bank Directory */}
  <div className="border border-l-4 border-ink-200 border-l-blood-600 bg-white p-5 sm:p-6 transition-colors hover:border-ink-300 hover:border-l-blood-600 flex flex-col gap-5">
  <div>
  <div className="h-10 w-10 bg-blood-50 border border-blood-200 grid place-items-center mb-4">
  <Building2 className="w-5 h-5 text-blood-700" />
  </div>
  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blood-700 mb-1">Live Inventory</p>
  <h3 className="text-base font-semibold text-ink-900">Blood Bank Directory</h3>
  <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
  Search government hospitals, Red Cross centers, and private banks by city or pincode.
  </p>
  </div>

  {/* Preview rows */}
  <div className="divide-y divide-ink-100 border-t border-ink-100">
  {INITIAL_BLOOD_BANKS.slice(0, 2).map((bank) => (
  <div key={bank.id} className="text-xs text-ink-700 flex items-center justify-between py-2.5">
  <span className="truncate font-medium max-w-[160px]">{bank.name}</span>
  <span className="shrink-0 ml-2 inline-flex items-center border border-vital-200 bg-vital-50 px-2 py-0.5 font-mono text-[11px] font-bold text-vital-700">
  O+: {bank.stock.find((s) => s.blood_type === 'O+')?.available_units ?? 0}u
  </span>
  </div>
  ))}
  </div>

  <button
  type="button"
  onClick={() => onNavigate('blood-banks')}
  className="mt-auto inline-flex h-9 w-full items-center justify-center gap-2 bg-blood-600 px-4 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-blood-700 active:bg-blood-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600 cursor-pointer"
  >
  Explore Blood Banks <ArrowRight className="w-3.5 h-3.5" />
  </button>
  </div>

  {/* Card 2 — Live Stock Availability */}
  <div className="border border-l-4 border-ink-200 border-l-blue-600 bg-white p-5 sm:p-6 transition-colors hover:border-ink-300 hover:border-l-blue-600 flex flex-col gap-5">
  <div>
  <div className="h-10 w-10 bg-blue-50 border border-blue-200 grid place-items-center mb-4">
  <Activity className="w-5 h-5 text-blue-700" />
  </div>
  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700 mb-1">Component Breakdown</p>
  <h3 className="text-base font-semibold text-ink-900">Live Stock Availability</h3>
  <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
  Filter by Whole Blood, Platelets (SDP), PRBC Red Cells, or FFP Plasma across all centres.
  </p>
  </div>

  <div className="grid grid-cols-2 gap-2 border-t border-ink-100 pt-3">
  {[
  { label: 'Whole Blood', sub: 'All groups live' },
  { label: 'Platelets', sub: 'SDP available' },
  { label: 'PRBC', sub: 'Packed red cells' },
  { label: 'FFP Plasma', sub: 'Fresh frozen' },
  ].map((item) => (
  <div key={item.label} className="bg-ink-50 border border-ink-100 p-2.5 text-left">
  <div className="text-xs font-semibold text-ink-800">{item.label}</div>
  <div className="text-[10px] text-ink-500 mt-0.5">{item.sub}</div>
  </div>
  ))}
  </div>

  <button
  type="button"
  onClick={() => onNavigate('blood-banks')}
  className="mt-auto inline-flex h-9 w-full items-center justify-center gap-2 border border-ink-300 bg-white px-4 text-[13px] font-semibold text-ink-900 transition-colors duration-200 hover:border-ink-900 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600 cursor-pointer"
  >
  Check Group Stock <ArrowRight className="w-3.5 h-3.5" />
  </button>
  </div>

  {/* Card 3 — Voluntary Camps */}
  <div className="border border-l-4 border-ink-200 border-l-amber-500 bg-white p-5 sm:p-6 transition-colors hover:border-ink-300 hover:border-l-amber-500 flex flex-col gap-5">
  <div>
  <div className="h-10 w-10 bg-amber-50 border border-amber-200 grid place-items-center mb-4">
  <Calendar className="w-5 h-5 text-amber-700" />
  </div>
  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700 mb-1">Community Drives</p>
  <h3 className="text-base font-semibold text-ink-900">Voluntary Donation Camps</h3>
  <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
  Upcoming blood donation drives by Red Cross, Rotary Club, and Lions Club near you.
  </p>
  </div>

  {/* Preview rows */}
  <div className="divide-y divide-ink-100 border-t border-ink-100">
  {INITIAL_VOLUNTARY_CAMPS.slice(0, 2).map((camp) => (
  <div key={camp.id} className="py-2.5 space-y-0.5">
  <div className="text-xs font-medium text-ink-800 truncate">{camp.title}</div>
  <div className="text-[11px] text-ink-500 flex items-center gap-1">
  <MapPin className="w-3 h-3 text-blood-600" /> {camp.city} · {camp.camp_date}
  </div>
  </div>
  ))}
  </div>

  <button
  type="button"
  onClick={() => onNavigate('blood-banks')}
  className="mt-auto inline-flex h-9 w-full items-center justify-center gap-2 border border-ink-300 bg-white px-4 text-[13px] font-semibold text-ink-900 transition-colors duration-200 hover:border-ink-900 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600 cursor-pointer"
  >
  Find Donation Camps <ArrowRight className="w-3.5 h-3.5" />
  </button>
  </div>

  </div>
  </div>
 </section>
 );
}
