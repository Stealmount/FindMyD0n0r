import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Heart, ShieldCheck, Megaphone, Users, Award, ExternalLink, HelpCircle, ChevronDown } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { DELHI_PINCODES, DelhiPincode } from '../data/pincodes';
import { BLOOD_COMPATIBILITY_MATRIX, BloodType } from '../types';

interface CityDonorDirectoryProps {
 initialZone?: string;
 initialBloodGroup?: string;
 onNavigate: (view: any, pushHistory?: boolean, customCode?: string) => void;
}

const BLOOD_GROUPS: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

// Group pincodes by Zone
const ZONES_MAP: Record<string, DelhiPincode[]> = {};
DELHI_PINCODES.forEach(item => {
 const normalizedZone = item.zone.trim();
 if (!ZONES_MAP[normalizedZone]) {
 ZONES_MAP[normalizedZone] = [];
 }
 ZONES_MAP[normalizedZone].push(item);
});

const ALL_ZONES = Object.keys(ZONES_MAP).sort();

export function CityDonorDirectory({ initialZone, initialBloodGroup, onNavigate }: CityDonorDirectoryProps) {
 const { language } = useLanguage();
 const isHi = language === 'HI';

 const [selectedZone, setSelectedZone] = useState<string>(initialZone || ALL_ZONES[0] || 'Central Delhi');
 const [selectedBloodGroup, setSelectedBloodGroup] = useState<BloodType | 'ALL'>((initialBloodGroup as BloodType) || 'ALL');
 const [donorCount, setDonorCount] = useState<number | null>(null);
 const [loadingCount, setLoadingCount] = useState<boolean>(true);

 const zonePincodes = ZONES_MAP[selectedZone] || [];
 const uniqueAreas = Array.from(new Set(zonePincodes.map(p => p.area))).slice(0, 15);
 const pincodeList = Array.from(new Set(zonePincodes.map(p => p.pincode)));

 // Query real donor counts from database matching pincodes (Privacy preserved: count only, zero PII)
 useEffect(() => {
 let isMounted = true;
 async function fetchDonorCount() {
 setLoadingCount(true);
 try {
 if (pincodeList.length === 0) {
 if (isMounted) { setDonorCount(0); setLoadingCount(false); }
 return;
 }

 const params = new URLSearchParams({ pins: pincodeList.join(',') });
 if (selectedBloodGroup !== 'ALL') params.set('bg', selectedBloodGroup);
 const res = await fetch(`/api/donors/count?${params.toString()}`);
 const data = await res.json().catch(() => ({ count: 0 }));
 if (isMounted) {
 setDonorCount(typeof data.count === 'number' ? data.count : 0);
 }
 } catch {
 if (isMounted) setDonorCount(0);
 } finally {
 if (isMounted) setLoadingCount(false);
 }
 }

 fetchDonorCount();
 return () => { isMounted = false; };
 }, [selectedZone, selectedBloodGroup]);

 // Compatibility data for selected blood group (derived from BLOOD_COMPATIBILITY_MATRIX)
 const compatibility = selectedBloodGroup !== 'ALL'
 ? {
 canReceiveFrom: BLOOD_COMPATIBILITY_MATRIX[selectedBloodGroup],
 canGiveTo: (Object.keys(BLOOD_COMPATIBILITY_MATRIX) as BloodType[]).filter(recipient =>
 BLOOD_COMPATIBILITY_MATRIX[recipient].includes(selectedBloodGroup)
 ),
 }
 : null;

 return (
 <div className="min-h-screen bg-[#FAFAFA] text-ink-900 py-12 px-4 sm:px-6 lg:px-8">
 <div className="max-w-4xl mx-auto space-y-8">
 
 {/* Header Navigation */}
 <div className="flex items-center justify-between border-b border-ink-200 pb-6">
 <button
 onClick={() => onNavigate('home')}
 className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900 transition-colors cursor-pointer"
>
 <ArrowLeft className="w-4 h-4" />
 <span>{isHi ? 'मुख्य पृष्ठ पर लौटें' : 'Back to Home'}</span>
 </button>
 <div className="flex items-center gap-2 text-blood-600 font-bold text-sm">
 <MapPin className="w-5 h-5" />
 <span>FindMyDonor™ Regional Directory</span>
 </div>
 </div>

 {/* Title & Zone Selector */}
 <div className="space-y-4">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ink-900">
 {isHi ? `रक्तदाता निर्देशिका: ${selectedZone}` : `Blood Donors in ${selectedZone}`}
 {selectedBloodGroup !== 'ALL' && <span className="text-blood-600 ml-2">({selectedBloodGroup})</span>}
 </h1>
 <p className="text-[13px] text-ink-500 mt-1">
 {isHi ? 'दिल्ली एनसीआर में व्हाट्सएप-आधारित आपातकालीन रक्तदाता मिलान' : 'WhatsApp-based Emergency Blood Donor Network in Delhi NCR'}
 </p>
 </div>

 {/* Zone Selector Dropdown */}
 <div className="relative shrink-0">
 <select
 value={selectedZone}
 onChange={(e) => setSelectedZone(e.target.value)}
 className="h-11 w-full appearance-none border border-ink-300 bg-white px-3.5 pr-9 text-sm font-medium text-ink-900 cursor-pointer transition-colors focus:border-blood-600 focus:outline-1 focus:outline-offset-0 focus:outline-blood-600"
>
 {ALL_ZONES.map(z => (
 <option key={z} value={z}>{z}</option>
 ))}
 </select>
 <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
 </div>
 </div>
 </div>

 {/* Honest Donor Count Banner (No Fake Numbers) */}
 <div className="border border-l-4 border-l-blood-600 border-ink-200 bg-white p-6">
 {loadingCount ? (
 <div className="flex items-center gap-3 text-sm text-ink-500">
 <div className="h-4 w-4 animate-spin rounded-full border-2 border-blood-600/30 border-t-blood-600" />
 <span>{isHi ? 'रक्तदाताओं की संख्या जांची जा रही है...' : 'Checking registered donor availability...'}</span>
 </div>
 ) : donorCount && donorCount> 0 ? (
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div className="flex items-center gap-5">
 <div className="font-display text-5xl sm:text-6xl font-extrabold tabular-nums leading-none text-blood-600">
 {donorCount}
 </div>
 <div>
 <h3 className="text-base font-bold text-ink-900">
 {isHi ? `${selectedZone} में ${donorCount} सत्यापित रक्तदाता सक्रिय हैं` : `${donorCount} Verified Donor(s) Available in ${selectedZone}`}
 </h3>
 <p className="text-xs text-ink-500 mt-0.5">
 {isHi ? '100% गोपनीयता सुरक्षित: आवश्यकता पड़ने पर केवल प्रत्यक्ष मैच साझा किया जाता है' : '100% Privacy Protected. Contacts shared only upon explicit donor match approval.'}
 </p>
 </div>
 </div>
 <button
 onClick={() => onNavigate('request')}
 className="inline-flex h-11 shrink-0 items-center justify-center gap-2 bg-blood-600 px-5 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-blood-700 active:bg-blood-800 cursor-pointer"
>
 <Megaphone className="w-4 h-4" />
 <span>{isHi ? 'रक्त की आवश्यकता पोस्ट करें' : 'Request Blood in Area'}</span>
 </button>
 </div>
 ) : (
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div className="space-y-1">
 <div className="flex items-center gap-2 font-bold text-sm text-blood-700">
 <Heart className="w-4 h-4 fill-blood-600 text-blood-600" />
 <span>{isHi ? `पहला रक्तदाता बनें!` : `Be the first donor in ${selectedZone}!`}</span>
 </div>
 <p className="text-xs text-ink-600">
 {isHi 
 ? `वर्तमान में ${selectedZone} (${selectedBloodGroup !== 'ALL' ? selectedBloodGroup : 'सभी समूह'}) में पंजीकृत दाता कम हैं। जीवन बचाने के लिए अभी पंजीकरण करें।`
 : `Currently zero public donors registered for ${selectedBloodGroup !== 'ALL' ? selectedBloodGroup : 'all blood types'} in ${selectedZone}. Register now to help patients in emergency.`}
 </p>
 </div>
 <button
 onClick={() => onNavigate('auth-signup')}
 className="inline-flex h-11 shrink-0 items-center justify-center gap-2 bg-blood-600 px-5 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-blood-700 active:bg-blood-800 cursor-pointer"
>
 <Users className="w-4 h-4" />
 <span>{isHi ? 'रक्तदाता के रूप में जुड़ें' : `Register as Donor in ${selectedZone} →`}</span>
 </button>
 </div>
 )}
 </div>

 {/* Filter by Blood Group Pills */}
 <div className="space-y-3">
 <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
 {isHi ? 'रक्त समूह द्वारा फ़िल्टर करें:' : 'Filter by Blood Group:'}
 </label>
 <div className="flex flex-wrap gap-2">
 <button
 onClick={() => setSelectedBloodGroup('ALL')}
 className={`border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
 selectedBloodGroup === 'ALL'
 ? 'border-blood-600 bg-blood-600 text-white'
 : 'border-ink-300 bg-white text-ink-600 hover:border-ink-900'
 }`}
>
 {isHi ? 'सभी समूह (ALL)' : 'ALL GROUPS'}
 </button>
 {BLOOD_GROUPS.map(bg => (
 <button
 key={bg}
 onClick={() => setSelectedBloodGroup(bg)}
 className={`border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
 selectedBloodGroup === bg
 ? 'border-blood-600 bg-blood-600 text-white'
 : 'border-ink-300 bg-white text-ink-600 hover:border-ink-900'
 }`}
>
 {bg}
 </button>
 ))}
 </div>
 </div>

 {/* Covered Areas in Zone */}
 <div className="border border-ink-100 bg-ink-50 p-5 space-y-3">
 <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
 <MapPin className="w-4 h-4 text-blood-600" />
 <span>{isHi ? `${selectedZone} के अंतर्गत प्रमुख क्षेत्र` : `Key Areas & Pincodes Covered in ${selectedZone}`}</span>
 </h3>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
 {uniqueAreas.map((area, idx) => (
 <div key={idx} className="flex items-center gap-1.5 border border-ink-200 bg-white px-3 py-2 text-xs text-ink-700 transition-colors hover:border-ink-900">
 <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blood-600" />
 <span className="truncate">{area}</span>
 </div>
 ))}
 </div>
 </div>

 {/* Blood Group Compatibility Guide (Reusable from BLOOD_COMPATIBILITY_MATRIX) */}
 {compatibility && (
 <div className="border border-ink-200 bg-white p-6 space-y-4">
 <div className="flex items-center gap-3 text-base font-bold text-blood-700">
 <Award className="w-5 h-5" />
 <h3>{isHi ? `${selectedBloodGroup} रक्त समूह अनुकूलता (Compatibility Guide)` : `Blood Compatibility Guide for ${selectedBloodGroup}`}</h3>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
 <div className="space-y-1.5 border border-ink-100 bg-ink-50 p-4">
 <span className="block font-bold uppercase tracking-wider text-vital-700">
 {isHi ? 'इन रक्त समूहों को दान कर सकते हैं:' : 'Can Give Blood To:'}
 </span>
 <p className="text-sm font-semibold text-ink-800">{compatibility.canGiveTo.join(', ')}</p>
 </div>
 <div className="space-y-1.5 border border-ink-100 bg-ink-50 p-4">
 <span className="block font-bold uppercase tracking-wider text-blue-700">
 {isHi ? 'इन रक्त समूहों से प्राप्त कर सकते हैं:' : 'Can Receive Blood From:'}
 </span>
 <p className="text-sm font-semibold text-ink-800">{compatibility.canReceiveFrom.join(', ')}</p>
 </div>
 </div>
 </div>
 )}

 {/* Dual CTAs */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
 <button
 onClick={() => onNavigate('auth-signup')}
 className="flex cursor-pointer items-center justify-between bg-blood-600 p-5 text-sm font-bold text-white transition-colors duration-200 hover:bg-blood-700 active:bg-blood-800 group"
>
 <div className="text-left space-y-1">
 <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">{isHi ? 'रक्तदाता पंजीकरण' : 'Become a Volunteer Donor'}</span>
 <span className="block text-base font-extrabold">{isHi ? `${selectedZone} में दान दें` : `Register in ${selectedZone}`}</span>
 </div>
 <Users className="h-6 w-6 transition-transform group-hover:scale-110" />
 </button>

 <button
 onClick={() => onNavigate('request')}
 className="flex cursor-pointer items-center justify-between border border-ink-300 bg-white p-5 text-sm font-bold text-ink-900 transition-colors duration-200 hover:border-ink-900 hover:bg-ink-50 group"
>
 <div className="text-left space-y-1">
 <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">{isHi ? 'आपातकालीन आवश्यकता' : 'Emergency Requirement'}</span>
 <span className="block text-base font-extrabold">{isHi ? `${selectedZone} में रक्त माँगें` : `Request Blood in ${selectedZone}`}</span>
 </div>
 <Megaphone className="h-6 w-6 text-blood-600 transition-transform group-hover:scale-110" />
 </button>
 </div>

 {/* Links to Phase 2 Legal/FAQ pages */}
 <div className="pt-8 border-t border-ink-200 flex flex-wrap items-center justify-center gap-6 text-xs text-ink-500">
 <button onClick={() => onNavigate('privacy')} className="transition-colors hover:text-ink-900 cursor-pointer">
 {isHi ? 'गोपनीयता नीति (Privacy Policy)' : 'Privacy Policy'}
 </button>
 <span>•</span>
 <button onClick={() => onNavigate('terms')} className="transition-colors hover:text-ink-900 cursor-pointer">
 {isHi ? 'सेवा की शर्तें (Terms of Service)' : 'Terms of Service'}
 </button>
 <span>•</span>
 <button onClick={() => onNavigate('faq')} className="transition-colors hover:text-ink-900 cursor-pointer flex items-center gap-1">
 <HelpCircle className="w-3.5 h-3.5" />
 <span>{isHi ? 'अक्सर पूछे जाने वाले प्रश्न (FAQ)' : 'FAQ & Eligibility'}</span>
 </button>
 </div>

 </div>
 </div>
 );
}
