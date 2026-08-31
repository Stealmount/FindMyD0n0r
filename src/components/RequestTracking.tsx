import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { BloodRequest, Match } from '../types';
import { authenticatedApi } from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import { getCoordinates } from '../data/pincode_coords';
import HospitalMap from './HospitalMap';
import { Spinner } from './ui/Spinner';
import RequestProgress from './RequestProgress';
import { 
 CheckCircle, 
 Clock, 
 MapPin, 
 AlertTriangle, 
 Phone, 
 MessageSquare, 
 Users, 
 XCircle,
 Search,
 ShieldCheck,
 Heart,
 Copy,
 Check
} from 'lucide-react';

interface RequestTrackingProps {
 initialCode?: string;
 onStateChange?: () => void;
 role?: 'donor' | 'requester';
 /** Opaque capability token from the ?matchToken= URL param (S-1: replaces raw matchId). */
 matchToken?: string;
}

export default function RequestTracking({ initialCode = '', onStateChange, role = 'requester', matchToken }: RequestTrackingProps) {
 const { language, setLanguage } = useLanguage();
 const isHi = language === 'HI';
 const [searchCode, setSearchCode] = useState(initialCode);
 const [request, setRequest] = useState<BloodRequest | null>(null);
 const [matches, setMatches] = useState<Match[]>([]);
 // donors[] is no longer returned by the public tracking API (S-1: PII removed from projection);
 // donor fields are now inlined into each match object by the backend.
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [donorResponseStatus, setDonorResponseStatus] = useState<'pending' | 'confirmed' | 'declined' | 'already_done'>('pending');
 const [copied, setCopied] = useState(false);

 const copyTrackingCode = useCallback((code: string) => {
  navigator.clipboard.writeText(code).then(() => {
   setCopied(true);
   setTimeout(() => setCopied(false), 2000);
  }).catch(() => {});
 }, []);

 const handleSearch = async (codeToSearch: string) => {
 if (!codeToSearch) return;
 setLoading(true);
 setError('');
 setRequest(null);
 try {
 const response = await fetch(`/api/requests/${encodeURIComponent(codeToSearch.trim())}`);
 const data = await response.json().catch(() => ({}));
 
 if (!response.ok || !data.request) {
 setError(data.error || (isHi ? 'इस ट्रैकिंग कोड से कोई सक्रिय रक्त अनुरोध नहीं मिला। कृपया कोड जांचें और फिर से प्रयास करें।' : 'No active blood request found with this tracking code. Please double-check the code and try again.'));
 setLoading(false);
 return;
 }

 setRequest(data.request);
 setMatches(data.matches || []);
 // donors[] no longer returned — donor info is inlined in each match (see backend tracking route)
 } catch (err) {
 console.error(err);
 setError('An error occurred while fetching tracking details.');
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 if (initialCode) {
 handleSearch(initialCode);
 }
 }, [initialCode]);

 // Auto-refresh every 30 seconds in requester view
 useEffect(() => {
 if (role !== 'requester' || !initialCode) return;
 const id = setInterval(() => handleSearch(searchCode || initialCode), 30_000);
 return () => clearInterval(id);
 }, [role, initialCode]);

 const handleMarkAsFulfilled = async () => {
 if (!request) return;
 if (!window.confirm("Marking this request as fulfilled will close the search and send a confirmation to all approved donors. Proceed?")) return;

try {
 const nowStr = new Date().toISOString();
 const res = await authenticatedApi<{ success: boolean; request: BloodRequest }>(`/api/requests/${request.tracking_code}/fulfill`, {}, 'PATCH');
 // Server is authoritative: an under-filled close becomes 'cancelled', never a
 // fabricated 'fulfilled' — reflect the true terminal state returned by the API.
 const settledReq = res?.request ?? { ...request, status: 'fulfilled' as const, fulfilled_at: nowStr };
 setRequest(settledReq);

 const approvedMatches = matches.filter(m => m.donor_response === 'approved');
 for (const m of approvedMatches) {
 // donor_phone is inlined into the match object by the backend tracking API
 if (m.donor_phone) {
 const checkNotifId = crypto.randomUUID();
 const bodyMsg = `Did you successfully donate blood for Request ID: ${request.tracking_code} at ${request.hospital_name}? Reply YES to CONFIRM and activate your 60-day recovery cooldown, or NO to indicate it did not happen.`;
 
 await authenticatedApi('/api/notifications', {
 id: checkNotifId,
 type: 'whatsapp',
 recipient_type: 'donor',
 recipient_id: m.matchToken || 'unknown',
 trigger_event: 'cooldown_verification',
 message_body: bodyMsg,
 status: 'delivered',
 sent_at: nowStr,
 created_at: nowStr
 }, 'POST');
 }
 }

 try {
 if (role !== 'donor') {
  confetti({
  particleCount: 80,
  spread: 70,
  origin: { y: 0.6 },
  colors: ['#C8102E', '#DE2F49', '#0E8574', '#1C1C1C'],
  });
 }
 } catch (confettiErr) {
 console.error("Confetti error:", confettiErr);
 }

if (onStateChange) onStateChange();
 alert(settledReq.status === 'cancelled' ? "Blood request search has been closed (marked cancelled — reopen allowed anytime)." : settledReq.status === 'secured' ? "Request kept open — fulfill only when donations complete." : "Blood request has been marked as fulfilled.");
 } catch (err) {
 console.error(err);
 alert("Failed to update request.");
 }
 };

 const handleCancelRequest = async () => {
 if (!request) return;
 if (!window.confirm("Are you sure you want to cancel this blood request?")) return;

 try {
 const response = (await authenticatedApi(`/api/requests/${request.tracking_code}/cancel`, {}, 'PATCH')) as any;
 if (response && response.request) {
 setRequest(response.request);
 if (onStateChange) onStateChange();
 alert("Blood request cancelled successfully.");
 } else {
 throw new Error("Failed to cancel");
 }
 } catch (err) {
 console.error(err);
 alert("Failed to cancel request.");
 }
 };

 const getStatusBadge = (status: string) => {
 switch (status) {
 case 'open':
 return <span className="inline-flex items-center gap-1.5 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">{isHi ? 'मिलान की प्रतीक्षा' : 'Awaiting Matches'}</span>;
 case 'matching':
 return <span className="inline-flex items-center gap-1.5 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200 animate-pulse">{isHi ? 'रीयल-टाइम खोज जारी' : 'Live Matching'}</span>;
 case 'partially_matched':
 return <span className="inline-flex items-center gap-1.5 bg-vital-50 px-3 py-1 text-xs font-semibold text-vital-700 border border-vital-200 font-bold">{isHi ? 'रक्तदाता स्वीकृत / मैच मिला' : 'Donor Approved / Matched'}</span>;
 case 'secured':
 return <span className="inline-flex items-center gap-1.5 bg-vital-50 px-3 py-1 text-xs font-semibold text-vital-700 border border-vital-200 font-bold">{isHi ? 'दाता आरक्षित' : 'Donors Reserved'}</span>;
 case 'search_exhausted':
 return <span className="inline-flex items-center gap-1.5 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">{isHi ? 'खोज समाप्त' : 'Search Exhausted'}</span>;
 case 'fulfilled':
 return <span className="inline-flex items-center gap-1.5 bg-vital-50 px-3 py-1 text-xs font-semibold text-vital-700 border border-vital-200">{isHi ? 'पूर्ण हुआ' : 'Fulfilled'}</span>;
 case 'cancelled':
 return <span className="inline-flex items-center gap-1.5 bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-600 border border-ink-200">{isHi ? 'रद्द' : 'Cancelled'}</span>;
 default:
 return <span className="inline-flex items-center gap-1.5 bg-blood-50 px-3 py-1 text-xs font-semibold text-blood-700 border border-blood-200">{status}</span>;
 }
 };

 const handleDonorRespond = async (response: 'approved' | 'declined') => {
 if (!matchToken) return;
 try {
 // S-1: post capability token, not a raw match UUID.
 // The server scans matches by public_token and validates with timingSafeEqual.
 const res = await fetch(`/api/matches/respond-public`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ response, token: matchToken }),
 });
 if (res.status === 409) { setDonorResponseStatus('already_done'); return; }
 if (!res.ok) throw new Error('Request failed');
 setDonorResponseStatus(response === 'approved' ? 'confirmed' : 'declined');
 } catch {
 setError('Unable to submit your response. Please try again.');
 }
 };

  return (
  <div id="tracking-view-container" className="max-w-4xl mx-auto w-full min-w-0 space-y-4 sm:space-y-6 overflow-x-hidden">

 {/* Donor view — shown when role=donor and matchToken is present */}
  {role === 'donor' && matchToken && (
  <div className="bg-white border border-ink-200 p-4 sm:p-6 min-w-0 overflow-hidden">
 {donorResponseStatus === 'confirmed' ? (
 <div className="text-center py-8">
 <Heart className="w-12 h-12 text-blood-600 mx-auto mb-4" />
 <h2 className="text-xl font-bold text-ink-900 mb-2">
 {isHi ? 'धन्यवाद — अनुरोधकर्ता को सूचित कर दिया गया है। 🩸' : 'Thank you — the requester has been notified. 🩸'}
 </h2>
 <p className="text-sm text-ink-500">
 {isHi ? 'कृपया अनुरोधकर्ता के साथ अपनी पहुँच का समन्वय करें। आपका संपर्क जल्द ही साझा किया जाएगा।' : 'Please coordinate your arrival with the requester. Your contact will be shared shortly.'}
 </p>
 </div>
 ) : donorResponseStatus === 'declined' ? (
 <div className="text-center py-8">
 <ShieldCheck className="w-12 h-12 text-ink-400 mx-auto mb-4" />
 <h2 className="text-xl font-bold text-ink-900 mb-2">{isHi ? 'आपकी प्रतिक्रिया दर्ज कर ली गई है' : 'Your response has been recorded'}</h2>
 <p className="text-sm text-ink-500">{isHi ? 'अद्यतन के लिए धन्यवाद। हम अन्य संगत रक्तदाताओं को खोजना जारी रखेंगे।' : 'Thank you for updating. We will continue matching with other compatible donors.'}</p>
 </div>
 ) : donorResponseStatus === 'already_done' ? (
 <div className="text-center py-8">
 <Clock className="w-12 h-12 text-ink-400 mx-auto mb-4" />
 <h2 className="text-xl font-bold text-ink-900 mb-2">{isHi ? 'प्रतिक्रिया पहले ही दर्ज हो चुकी है' : 'Response already recorded'}</h2>
 <p className="text-sm text-ink-500">{isHi ? 'आप इस रक्तदान अनुरोध के लिए पहले ही अपनी प्रतिक्रिया दर्ज कर चुके हैं।' : 'You have already submitted your availability response for this request.'}</p>
 </div>
 ) : request ? (
 <div className="space-y-5">
 <div className="flex items-center gap-3">
 <div className="grid h-10 w-10 place-items-center bg-blood-600">
 <Heart className="w-5 h-5 text-white" />
 </div>
 <div>
 <h2 className="text-lg font-bold text-ink-900">{isHi ? 'रक्तदान अनुरोध' : 'Blood Donation Request'}</h2>
 <p className="text-xs text-ink-500">{isHi ? 'आसपास किसी को आपकी मदद की जरूरत है' : 'Someone nearby needs your help'}</p>
 </div>
 </div>
 <div className="bg-ink-50 p-5 border border-ink-100 space-y-2 text-sm">
 <div className="flex items-center gap-2">
 <span className="bg-blood-100 px-3 py-1 text-sm font-bold text-blood-700 border border-blood-200">{request.blood_type_needed}</span>
 <span className="text-ink-600 font-medium">{request.units_required} {isHi ? 'यूनिट की आवश्यकता' : 'unit(s) needed'}</span>
 <span className={`ml-auto text-xs font-semibold px-2 py-0.5 ${request.urgency_level === 'critical' ? 'bg-blood-100 text-blood-700' : request.urgency_level === 'urgent' ? 'bg-amber-100 text-amber-700' : 'bg-ink-100 text-ink-600'}`}>{request.urgency_level}</span>
 </div>
 <p className="text-xs font-medium text-ink-700 flex items-center gap-1.5">
 <MapPin className="w-3.5 h-3.5 text-blood-500" />
 {request.hospital_name}, {request.hospital_city}
 </p>
 </div>
 <div className="flex flex-col sm:flex-row gap-3 pt-2">
 <button
 onClick={() => handleDonorRespond('approved')}
 className="flex-1 py-3 px-4 bg-blood-600 hover:bg-blood-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
 >
 <Heart className="w-4 h-4" />
 {isHi ? 'मैं मदद कर सकता हूँ — पुष्टि करें' : 'I can help — confirm'}
 </button>
 <button
 onClick={() => handleDonorRespond('declined')}
 className="py-3 px-4 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700 font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
 >
 <XCircle className="w-4 h-4" />
 {isHi ? 'अभी उपलब्ध नहीं हूँ' : 'Not available right now'}
 </button>
 </div>
 </div>
 ) : (
 <Spinner isHi={isHi} label={isHi ? 'अनुरोध विवरण लोड हो रहा है…' : 'Loading request details…'} />
 )}
 </div>
 )}

  <div className="bg-white border border-ink-200 p-4 sm:p-6 min-w-0 overflow-hidden">
  <div className="flex items-center gap-3 mb-4 min-w-0">
  <div className="grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center bg-blood-600">
  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
  </div>
  <div className="min-w-0">
  <h3 className="text-base sm:text-lg font-bold tracking-tight text-ink-900 leading-tight">
  {isHi ? 'रीयल-टाइम मैचिंग स्थिति ट्रैक करें' : 'Track Real-Time Matching Status'}
  </h3>
  <p className="text-[11px] sm:text-xs leading-snug text-ink-500 line-clamp-2">
   {isHi ? 'लाइव रक्तदाता प्रतिक्रियाएं और संपर्क जानकारी देखने के लिए अपना ट्रैकिंग कोड दर्ज करें' : 'Enter your tracking code to view live donor responses & contact info'}
  </p>
  </div>
  </div>

  <div className="flex flex-col sm:flex-row gap-3 min-w-0">
 <div className="relative flex-1">
 <Search className="absolute left-4 top-3.5 w-4 h-4 text-ink-400" />
 <input
 type="text"
 placeholder={isHi ? 'ट्रैकिंग कोड दर्ज करें...' : 'Enter Tracking Code...'}
 value={searchCode}
 onChange={e => setSearchCode(e.target.value)}
 className="w-full border border-ink-300 bg-white pl-11 pr-4 py-3 text-sm font-semibold text-ink-900 placeholder:text-ink-400 outline-none transition-colors duration-150 focus:border-blood-600 focus:outline-1 focus:outline-offset-0 focus:outline-blood-600"
 />
 </div>
 <button
 onClick={() => handleSearch(searchCode)}
 disabled={loading}
 className=" inline-flex items-center justify-center gap-2 bg-ink-900 px-8 py-3 text-sm font-semibold text-white hover:bg-black transition-all cursor-pointer disabled:opacity-50"
 >
 {loading ? (isHi ? 'खोजा जा रहा है...' : 'Searching...') : (isHi ? 'स्थिति ट्रैक करें' : 'Track Match')}
 </button>
 </div>
 </div>

 {error && (
 <div className="bg-blood-50 border border-blood-200 p-4 text-blood-700 text-xs font-semibold flex items-center gap-3">
 <AlertTriangle className="w-5 h-5 flex-shrink-0 text-blood-600" />
 <span>{error}</span>
 </div>
 )}

 {/* Tracking Results */}
  {request && (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 min-w-0">
  {/* Main details */}
  <div className="md:col-span-2 space-y-4 sm:space-y-6 min-w-0">
  <div className="bg-white border border-ink-200 p-4 sm:p-6 space-y-4 sm:space-y-6 min-w-0 overflow-hidden">
 <div className="flex justify-between items-start gap-4">
  <div>
  <div className="flex flex-wrap items-center gap-2.5">
  <button
   onClick={() => copyTrackingCode(request.tracking_code)}
   className="text-lg font-bold tracking-wider font-mono text-ink-900 bg-ink-50 hover:bg-ink-100 px-3 py-1 border border-ink-200 flex items-center gap-2 transition-all cursor-pointer"
   title={isHi ? 'कोड कॉपी करें' : 'Click to copy'}
  >
   {request.tracking_code}
   {copied ? <Check className="w-4 h-4 text-vital-600" /> : <Copy className="w-4 h-4 text-ink-400" />}
  </button>
  {getStatusBadge(request.status)}
  </div>
  <p className="text-xs text-ink-400 font-medium mt-1">
  {isHi ? 'अनुरोध किया गया: ' : 'Requested on '}{new Date(request.created_at).toLocaleString()}
  </p>
  </div>
 <div className="bg-blood-50 border border-blood-200 px-4 py-3 text-center min-w-[90px]">
 <span className="block text-[10px] font-semibold uppercase tracking-wider text-blood-600">{isHi ? 'आवश्यक रक्त' : 'Blood Needed'}</span>
 <span className="text-2xl font-bold text-blood-700">{request.blood_type_needed}</span>
 </div>
 </div>

 {/* Progress Tracker */}
  <div className="flex items-center gap-0 pt-4 border-t border-ink-100">
  {[
   { label: isHi ? 'बनाया' : 'Created', done: true },
   { label: isHi ? 'मिलान' : 'Matched', done: request.status !== 'open' },
   { label: isHi ? 'स्वीकृत' : 'Accepted', done: matches.some(m => m.donor_response === 'approved') },
   { label: isHi ? 'प्रगति में' : 'In Progress', done: request.status === 'fulfilled' },
   { label: isHi ? 'पूर्ण' : 'Completed', done: request.status === 'fulfilled' },
  ].map((step, idx, arr) => (
   <React.Fragment key={idx}>
   <div className="flex flex-col items-center flex-1 min-w-0">
    <div className={`w-3 h-3 rounded-full mb-1.5 transition-all ${step.done ? 'bg-blood-600' : 'bg-ink-200'}`} />
    <span className={`text-[10px] font-semibold text-center leading-tight ${step.done ? 'text-ink-900' : 'text-ink-400'}`}>
    {step.label}
    </span>
   </div>
   {idx < arr.length - 1 && (
    <div className={`h-0.5 flex-1 -mx-1 mb-4 transition-all ${step.done && arr[idx + 1].done ? 'bg-blood-400' : step.done ? 'bg-blood-300' : 'bg-ink-200'}`} />
   )}
   </React.Fragment>
  ))}
  </div>

 {/* Patient and Hospital details */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-ink-50 p-5 border border-ink-100 text-xs font-medium text-ink-800">
 <div>
 <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block">Patient Name & Demographics</span>
 <p className="font-bold text-sm mt-0.5 text-ink-900">
 {request.patient_name} {request.patient_age ? `(${request.patient_age}Y / ${request.patient_gender || 'M'})` : ''}
 </p>
 </div>
 <div>
 <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block">Component & Units</span>
 <p className="font-bold text-sm mt-0.5 text-ink-900">
 {request.component_needed || 'Whole Blood'} — {request.units_required} Unit(s)
 </p>
 </div>
 <div className="sm:col-span-2">
 <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block">Hospital & Clinical Verification</span>
 <p className="font-semibold text-xs mt-1 flex items-start gap-1.5 text-ink-900">
 <MapPin className="w-4 h-4 text-blood-500 mt-0.5 flex-shrink-0" />
 <span>{request.hospital_name}, {request.hospital_area}, {request.hospital_city} ({request.hospital_pincode})</span>
 </p>
 {(request.hospital_uhid || request.attending_doctor) && (
 <p className="text-xs text-ink-600 mt-1 pl-5 mb-3">
 {request.hospital_uhid && <span className="font-mono bg-ink-100 px-1.5 py-0.5 text-[10px] mr-2">UHID: {request.hospital_uhid}</span>}
 {request.attending_doctor && <span>Physician: {request.attending_doctor}</span>}
 </p>
 )}
 {(() => {
 const coords = getCoordinates(request.hospital_pincode);
 return (
 <div className="mt-3">
 <HospitalMap 
 hospitalLat={coords.lat} 
 hospitalLng={coords.lng} 
 hospitalName={request.hospital_name} 
 />
 </div>
 );
 })()}
 </div>
 <div>
 <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block">Urgency Level</span>
 <p className="font-semibold text-xs mt-0.5 capitalize flex items-center gap-1.5 text-ink-900">
 <span className={`w-2.5 h-2.5 rounded-full inline-block ${request.urgency_level === 'critical' ? 'bg-blood-600' : request.urgency_level === 'urgent' ? 'bg-amber-500' : 'bg-ink-400'}`} />
 {request.urgency_level}
 </p>
 </div>
 <div>
 <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block">Expiry / Timeout</span>
 <p className="font-semibold text-xs mt-0.5 flex items-center gap-1.5 text-ink-900">
 <Clock className="w-3.5 h-3.5 text-blood-500" />
 {new Date(request.expires_at) < new Date() ? 'Expired' : new Date(request.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + new Date(request.expires_at).toLocaleDateString() + ')'}
 </p>
 </div>
 </div>

 {/* Action Buttons — only shown in authenticated/dashboard context */}
 {onStateChange && request.status !== 'fulfilled' && request.status !== 'cancelled' && (
 <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-ink-100">
 <button
 onClick={handleMarkAsFulfilled}
 className="flex-1 py-3 px-4 bg-blood-600 hover:bg-blood-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
 >
 <CheckCircle className="w-4 h-4" />
 Mark as Fulfilled
 </button>
 <button
 onClick={handleCancelRequest}
 className="py-3 px-4 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
 >
 <XCircle className="w-4 h-4" />
 Cancel Request
 </button>
 </div>
 )}
 </div>
 </div>

 {/* Matches & Privacy Gate Info */}
 <div className="space-y-6">

 {/* ── P4: Unit Fulfillment Progress Bar ── */}
 {request.units_required > 0 && (
 <div className="bg-white border border-ink-200 p-6">
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 flex items-center gap-2">
 🩸 {isHi ? 'यूनिट पूर्ति प्रगति' : 'Unit Fulfillment Progress'}
 </h3>
 <span className="font-mono text-sm font-bold tabular-nums text-blood-700">
 {(request as any).units_completed ?? 0}/{request.units_required} completed
 {((request as any).units_confirmed ?? matches.filter(m => m.donor_response === 'approved').length) !== ((request as any).units_completed ?? 0) ? <span className="text-ink-400 font-medium text-[10px] ml-1">· {(request as any).units_confirmed ?? matches.filter(m => m.donor_response === 'approved').length} confirmed</span> : null}
 </span>
 </div>
 <div className="w-full h-3 bg-ink-100 overflow-hidden">
 <div
 className="h-full bg-blood-600 transition-all duration-700 ease-out"
 style={{
 width: `${Math.min(100, (((request as any).units_completed ?? 0) / request.units_required) * 100)}%`,
 }}
 />
 </div>
<p className="text-[11px] text-ink-500 mt-2 font-medium">
  {(() => {
    const confirmed = (request as any).units_confirmed ?? matches.filter(m => m.donor_response === 'approved').length;
    const completed = (request as any).units_completed ?? 0;
    if (['cancelled','fulfilled','expired'].includes(request.status)) {
      return completed >= request.units_required
        ? (isHi ? '✅ सभी यूनिट पूर्ण!' : '✅ All units completed!')
        : (isHi ? 'ℹ️ खोज बंद — दान पूर्ण नहीं' : 'ℹ️ Search closed — donation not completed');
    }
    if (confirmed >= request.units_required) {
      return isHi ? '🧪 डोनर कन्फर्म — दान समाप्ति की प्रतीक्षा' : '🧪 Donors confirmed — awaiting donation completion';
    }
    return isHi ? '⏳ डोनर्स की प्रतिक्रिया की प्रतीक्षा...' : '⏳ Waiting for donor responses...';
  })()}
  </p>
{request.search_batch && ['matching', 'partially_matched', 'secured', 'open', 'search_exhausted'].includes(request.status) && (
 <p className="text-[10px] uppercase tracking-[0.12em] text-ink-400 mt-1 font-semibold">
 {isHi ? `🔎 सर्च ब्याज ${request.search_batch}/15` : `🔎 Search budget ${request.search_batch}/15`}
 </p>
 )}
  </div>
  )}

 <div className="bg-white border border-ink-200 p-6 space-y-4">
 <div className="flex items-center justify-between border-b border-ink-100 pb-3">
 <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 flex items-center gap-2">
 <Users className="w-4 h-4 text-blood-600" />
 Donors Matched ({matches.length})
 </h3>
 <span className="font-mono text-[10px] font-semibold text-ink-400">POOL</span>
 </div>

 {matches.length === 0 ? (
 <RequestProgress request={request} matches={matches} isHi={isHi} />
 ) : (
 <div className="space-y-3">
 {matches.map((match, idx) => {
 // Donor info is inlined in match by the backend safe-projection (S-1 fix)
 const isApproved = match.donor_response === 'approved';
 const isDeclined = match.donor_response === 'declined';
 const isPending = match.donor_response === 'pending';

 return (
 <div key={match.matchToken || idx} className={`p-4 border transition-all ${
 isApproved ? 'bg-vital-50 border-vital-200' :
 isDeclined ? 'bg-ink-50 border-ink-200 opacity-60' : 'bg-white border-ink-200'
 }`}>
 <div className="flex justify-between items-start gap-2">
 <div>
 <span className="text-[10px] font-semibold text-ink-400 uppercase">
 {match.unit_slot ? `Unit #${match.unit_slot}` : `Rank #${match.match_rank}`}
 </span>
 <h4 className="font-bold text-sm text-ink-900 mt-0.5">
 {isApproved && match.donor_name ? match.donor_name : `Volunteer Donor (${match.blood_type})`}
 </h4>
 <p className="text-xs text-ink-500 font-medium mt-0.5">
 {match.area}, {match.city}
 {match.distance_km ? ` · ${Number(match.distance_km).toFixed(1)} km` : ''}
 </p>
 </div>
 
 <span className={`px-2.5 py-0.5 font-semibold text-[10px] uppercase ${
 isApproved ? 'bg-vital-100 text-vital-700 border border-vital-200' :
 isDeclined ? 'bg-ink-100 text-ink-600 border border-ink-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
 }`}>
 {match.donor_response}
 </span>
 </div>

 {isApproved && match.donor_phone ? (
 <div className="mt-3 pt-3 border-t border-vital-200 space-y-2 text-xs">
 <p className="text-xs text-vital-700 font-semibold flex items-center gap-1.5">
 <ShieldCheck className="w-3.5 h-3.5" /> Consent granted! Direct Contact:
 </p>
 <div className="grid grid-cols-2 gap-2">
 <a
 href={`tel:${match.donor_phone}`}
 className="p-2 bg-white hover:bg-vital-50 text-ink-800 border border-vital-200 flex items-center justify-center gap-1.5 font-semibold text-xs transition-colors"
 >
 <Phone className="w-3.5 h-3.5 text-vital-600" /> Call
 </a>
 <a
 href={`https://wa.me/${String(match.donor_phone).replace(/\D/g, '')}`}
 target="_blank"
 rel="noreferrer"
 className="p-2 bg-whatsapp text-white hover:bg-whatsapp/90 flex items-center justify-center gap-1.5 font-semibold text-xs transition-colors"
 >
 <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
 </a>
 </div>
 </div>
 ) : isPending ? (
 <div className="mt-3 text-xs text-ink-600 bg-ink-50 p-3 border border-ink-100 font-medium leading-relaxed">
 <span className="font-semibold text-blood-600 block mb-0.5">🛡️ Privacy Shield Active</span>
 Personal details hidden until donor replies YES via WhatsApp.
 </div>
 ) : (
 <div className="mt-2 text-xs font-semibold text-ink-400">
 Donor unavailable or declined this request.
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
