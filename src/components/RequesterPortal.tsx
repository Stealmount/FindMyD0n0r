import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Requester, BloodRequest, Match, User } from '../types';
import { authenticatedApi } from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import { StateMessage } from './ui/StateMessage';
import { 
 Heart, 
 MapPin, 
 Clock, 
 Phone, 
 MessageSquare, 
 User as UserIcon, 
 CheckCircle, 
 XCircle, 
 Calendar,
 AlertTriangle,
 LogOut,
 Shield,
 Droplet,
 FileText,
 Save,
 ArrowRight,
 PlusCircle,
 Users,
 Search,
 Check,
 ChevronRight,
  Sparkles,
  Trash2,
  Megaphone,
  Settings
} from 'lucide-react';
import DeleteAccountModal from './ui/DeleteAccountModal';
import RequesterSettingsPanel from './RequesterPortal/RequesterSettingsPanel';

interface RequesterPortalProps {
 currentRequester: Requester | null;
 onLoginSuccess: (requester: Requester) => void;
 onLogout: () => void;
 onStateChange?: () => void;
 onNavigateToRequest: () => void;
 onNavigateToRegister: () => void;
}

export default function RequesterPortal({ 
 currentRequester, 
 onLoginSuccess, 
 onLogout, 
 onStateChange,
 onNavigateToRequest,
 onNavigateToRegister
}: RequesterPortalProps) {
 const { t, language, setLanguage } = useLanguage();
 const isHi = language === 'HI';
 const [showDeleteModal, setShowDeleteModal] = useState(false);
 const [showSettings, setShowSettings] = useState(false);

 // Dashboard state
 const [requests, setRequests] = useState<BloodRequest[]>([]);
 const [matches, setMatches] = useState<Match[]>([]);
 const [donors, setDonors] = useState<User[]>([]);
 const [loadingData, setLoadingData] = useState(false);
 const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
 const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
 const [dataError, setDataError] = useState<string | null>(null);
 // Profile location returned by /api/requester/requests (not on the Requester type)
 const [requesterProfile, setRequesterProfile] = useState<{ pincode?: string | null; area?: string | null; city?: string | null; notification_channel?: string | null } | null>(null);

 const showToast = (message: string, type: 'success' | 'error' = 'success') => {
 setToast({ message, type });
 setTimeout(() => setToast(null), 3000);
 };

 // Refresh dashboard data
 const loadDashboardData = async () => {
 if (!currentRequester) return;
 setLoadingData(true);
 try {
  const dashboard = await authenticatedApi<{
   requests: BloodRequest[]; matches: Match[]; donors: User[]; profile?: { pincode?: string | null; area?: string | null; city?: string | null; notification_channel?: string | null } | null;
  }>('/api/requester/requests', undefined, 'GET');
  const userRequests = dashboard.requests || [];
  const allMatches = dashboard.matches || [];
  const allDonors = dashboard.donors || [];
  const profile = dashboard.profile || null;

 // Sort by creation date (newest first)
 userRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

 setRequests(userRequests);
 setMatches(allMatches);
 setDonors(allDonors);
 setRequesterProfile(profile);

 if (userRequests.length> 0 && !selectedRequestId) {
 setSelectedRequestId(userRequests[0].id);
 }
 } catch (err) {
 console.error("Error loading requester data: ", err);
 setDataError(isHi ? 'आपका डेटा लोड नहीं हो सका। कृपया पुनः प्रयास करें।' : 'Could not load your data. Please try again.');
 } finally {
 setLoadingData(false);
 }
 };

 useEffect(() => {
 if (currentRequester) {
 loadDashboardData();
 }
 }, [currentRequester]);



 // Actions on blood requests
 const handleFulfillRequest = async (request: BloodRequest) => {
 if (!window.confirm("Marking this request as fulfilled will close search and send simulated WhatsApp cooldown confirmations to all approved donors. Proceed?")) return;

 try {
 const nowStr = new Date().toISOString();
 
 const res = await authenticatedApi<{ success: boolean; request: BloodRequest }>(`/api/requests/${request.tracking_code}/fulfill`, {}, 'PATCH');
 const closedAs = res?.request?.status ?? 'fulfilled';

 // Trigger verification messages for matches who approved
 const reqMatches = matches.filter(m => m.request_id === request.id);
 const approvedMatches = reqMatches.filter(m => m.donor_response === 'approved');

 for (const m of approvedMatches) {
 const donor = donors.find(d => d.id === m.donor_id);
 if (donor) {
 const checkNotifId = crypto.randomUUID();
 const bodyMsg = `Did you successfully donate blood for Request ID: ${request.tracking_code} at ${request.hospital_name}? Reply YES to CONFIRM and activate your 60-day recovery cooldown, or NO to indicate it did not happen.`;
 
 await authenticatedApi('/api/notifications', {
 id: checkNotifId,
 type: 'whatsapp',
 recipient_type: 'donor',
 recipient_id: donor.id,
 trigger_event: 'cooldown_verification',
 message_body: bodyMsg,
 status: 'delivered',
 sent_at: nowStr,
 created_at: nowStr
 }, 'POST');
 }
 }

 await loadDashboardData();
 if (onStateChange) onStateChange();

 // Trigger success confetti animation
 try {
  confetti({
  particleCount: 150,
  spread: 80,
  origin: { y: 0.6 },
  colors: ['#C8102E', '#DE2F49', '#1C1C1C', '#6B7280'],
  });
 } catch (confettiErr) {
 console.error("Confetti error:", confettiErr);
 }

 showToast(
   isHi
     ? (closedAs === 'fulfilled' ? "रक्त अनुरोध सफलतापूर्वक पूर्ण हुआ!" : "रक्त अनुरोध बंद कर दिया गया।")
     : (closedAs === 'fulfilled' ? "Blood request marked as fulfilled successfully!" : "Blood request search closed successfully."),
   'success'
 );
 } catch (err) {
 console.error("Fulfill failed: ", err);
 showToast(isHi ? "अनुरोध पूरा करने में विफल। कृपया पुनः प्रयास करें।" : "Failed to fulfill request. Please try again.", 'error');
 }
 };

 const handleCancelRequest = async (request: BloodRequest) => {
 if (!window.confirm("Are you sure you want to cancel this request? It will be marked inactive and retracted from matching systems.")) return;

 try {
 await authenticatedApi(`/api/requests/${request.tracking_code}/cancel`, {}, 'PATCH');

 await loadDashboardData();
 if (onStateChange) onStateChange();
 showToast(isHi ? "रक्त अनुरोध सफलतापूर्वक रद्द कर दिया गया।" : "Blood request cancelled successfully.", 'success');
 } catch (err) {
 console.error("Cancel failed: ", err);
 showToast(isHi ? "अनुरोध रद्द करने में विफल।" : "Failed to cancel request.", 'error');
 }
 };

// Rendering Helper: Urgency Style
  const getUrgencyBadge = (urgency: string) => {
  switch (urgency) {
  case 'critical':
  return <span className="inline-flex items-center bg-blood-600 px-2.5 py-0.5 text-[10px] font-semibold text-white border border-blood-600 uppercase">{isHi ? 'अत्यंत गंभीर' : 'CRITICAL'}</span>;
  case 'urgent':
  return <span className="inline-flex items-center bg-blood-50 px-2.5 py-0.5 text-[10px] font-semibold text-blood-700 border border-blood-200 uppercase">{isHi ? 'तत्काल' : 'URGENT'}</span>;
  default:
  return <span className="inline-flex items-center bg-ink-100 px-2.5 py-0.5 text-[10px] font-semibold text-ink-600 border border-ink-200 uppercase">{isHi ? 'नियोजित' : 'PLANNED'}</span>;
  }
  };

  // Rendering Helper: Status Badge
  const getStatusBadge = (status: string, reqId?: string) => {
  switch (status) {
  case 'draft':
  return <span className="inline-flex items-center bg-ink-100 px-2.5 py-0.5 text-[10px] font-semibold text-ink-600 border border-ink-200 uppercase">Draft</span>;
  case 'broadcasting':
  return <span className="inline-flex items-center bg-blood-50 px-2.5 py-0.5 text-[10px] font-semibold text-blood-700 border border-blood-200 uppercase animate-pulse">Broadcasting</span>;
  case 'open':
  return <span className="inline-flex items-center bg-blood-50 px-2.5 py-0.5 text-[10px] font-semibold text-blood-700 border border-blood-200 uppercase">{isHi ? 'खोज जारी' : 'Searching'}</span>;
  case 'matching':
  return <span className="inline-flex items-center bg-blood-50 px-2.5 py-0.5 text-[10px] font-semibold text-blood-700 border border-blood-200 uppercase animate-pulse">{isHi ? 'मिलान जारी' : 'Matching'}</span>;
  case 'partially_matched':
  return <span className="inline-flex items-center bg-blood-600 px-2.5 py-0.5 text-[10px] font-semibold text-white border border-blood-600 uppercase font-bold">{isHi ? 'दाता मिला' : 'Donor Matched'}</span>;
  case 'secured':
  return <span className="inline-flex items-center bg-blood-600 px-2.5 py-0.5 text-[10px] font-semibold text-white border border-blood-600 uppercase font-bold">{isHi ? 'दाता आरक्षित' : 'Donors Reserved'}</span>;
  case 'search_exhausted':
  return <span className="inline-flex items-center bg-amber-600 px-2.5 py-0.5 text-[10px] font-semibold text-white border border-amber-600 uppercase">{isHi ? 'खोज समाप्त' : 'Search Exhausted'}</span>;
  case 'fulfilled':
  return <span className="inline-flex items-center bg-blood-600 px-2.5 py-0.5 text-[10px] font-semibold text-white border border-blood-600 uppercase">{isHi ? 'पूर्ण हुआ' : 'Fulfilled'}</span>;
  case 'cancelled':
  return <span className="inline-flex items-center bg-ink-100 px-2.5 py-0.5 text-[10px] font-semibold text-ink-500 border border-ink-200 uppercase">{isHi ? 'रद्द किया गया' : 'Cancelled'}</span>;
  default:
  return <span className="inline-flex items-center bg-ink-100 px-2.5 py-0.5 text-[10px] font-semibold text-ink-600 border border-ink-200 uppercase">{status}</span>;
  }
  };

 // Broadcast a saved draft — promotes it to a live broadcast via API
 const [broadcastingDraftId, setBroadcastingDraftId] = useState<string | null>(null);
 const handleBroadcastDraft = async (req: BloodRequest) => {
 if (!window.confirm(`Broadcast "${req.blood_type_needed}" request to nearby donors now?`)) return;
 setBroadcastingDraftId(req.id);
 try {
 await authenticatedApi(`/api/requests/${req.id}/broadcast`, {}, 'POST');
 await loadDashboardData();
 } catch (err: any) {
 console.error('Broadcast draft error:', err);
 showToast(isHi ? 'प्रसारण करने में विफल। कृपया पुनः प्रयास करें।' : 'Failed to broadcast. Please try again.', 'error');
 } finally {
 setBroadcastingDraftId(null);
 }
 };

 // Render Logged Out View
 if (!currentRequester) {
 return (
 <div id="requester-login-container" className="max-w-md mx-auto bg-white border border-ink-200 my-8">
 <div className="p-8 text-center">
 <div className="mx-auto mb-3 grid h-12 w-12 place-items-center bg-blood-50 border border-blood-100">
 <Heart className="w-6 h-6 text-blood-600" />
 </div>
 <h2 className="text-lg font-bold tracking-tight text-ink-900">
 {t.requesterDashboard.loginTitle}
 </h2>
 <p className="text-ink-500 text-xs mt-1">
 {isHi ? 'अनुरोध प्रबंधित करें और मिलान अपडेट ट्रैक करें।' : 'Manage requests and track matching updates.'}
 </p>
 </div>

 <div className="px-8 pb-8 space-y-4">
 <p className="text-sm text-ink-600 text-center">{isHi ? 'कृपया साइन इन करें।' : 'Please sign in to continue.'}</p>
 <button
 id="btn-requester-signin"
 type="button"
 onClick={onNavigateToRegister}
 className="w-full h-12 bg-blood-600 hover:bg-blood-700 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
>
 {isHi ? 'साइन इन / पंजीकरण करें' : 'Sign In / Register'}
 </button>
 </div>
 </div>
 );
 }

 // Active Requester Dashboard View
 const selectedRequest = requests.find(r => r.id === selectedRequestId);
 const selectedMatches = selectedRequest ? matches.filter(m => m.request_id === selectedRequest.id) : [];

 return (
 <div id="requester-dashboard" className="max-w-6xl mx-auto space-y-5 animate-fade-in">
  {/* Overview Header */}
 <div className="bg-white border border-ink-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
 <div className="flex items-center gap-4">
 <div className="grid h-14 w-14 place-items-center bg-blood-600 text-white">
 <UserIcon className="w-7 h-7" />
 </div>
 <div>
 <div className="flex flex-wrap items-center gap-2.5">
 <h2 className="text-xl font-bold tracking-tight text-ink-900">
 {currentRequester.full_name}
 </h2>
 <span className="inline-flex items-center bg-blood-50 px-3 py-1 text-xs font-semibold text-blood-700 border border-blood-200 uppercase">
 {isHi ? 'सत्यापित अनुरोधकर्ता' : 'Verified Requester'}
 </span>
 </div>
 <p className="text-xs text-ink-400 font-medium mt-1">
 {isHi ? 'संपर्क:' : 'Contact:'} {currentRequester.phone || (isHi ? 'अपडेट करें' : 'Update needed')} &bull; {isHi ? 'ईमेल:' : 'Email:'} {currentRequester.email}
 </p>
 </div>
 </div>

 <div className="flex flex-wrap items-center gap-3">
 <button
 id="btn-dashboard-new-req"
 onClick={onNavigateToRequest}
 className=" inline-flex items-center justify-center gap-2 bg-blood-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blood-700 transition-all cursor-pointer"
>
 <PlusCircle className="w-4 h-4" />
 {t.requesterDashboard.newRequestBtn}
 </button>
 <button
 id="btn-requester-settings"
 onClick={() => setShowSettings(!showSettings)}
 className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
 showSettings 
 ? 'bg-ink-900 text-white' 
 : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 hover:text-ink-900'
 }`}
 >
 <Settings className="w-4 h-4" />
 {isHi ? 'सेटिंग्स' : 'Settings'}
 </button>
 <button
 id="btn-requester-delete-account"
 onClick={() => setShowDeleteModal(true)}
 className="inline-flex items-center justify-center gap-2 border border-blood-200 bg-blood-50 px-5 py-2.5 text-xs font-semibold text-blood-700 hover:bg-blood-100 transition-all cursor-pointer"
>
 <Trash2 className="w-4 h-4" />
 {isHi ? 'खाता हटाएं' : 'Delete Account'}
 </button>
 <button
 id="btn-requester-logout"
 onClick={onLogout}
 className="inline-flex items-center justify-center gap-2 border border-ink-200 bg-white px-5 py-2.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 hover:text-ink-900 transition-all cursor-pointer"
>
 <LogOut className="w-4 h-4" />
 {isHi ? 'साइन आउट' : 'Sign Out'}
 </button>
 </div>
 </div>

  {showSettings && (
  <RequesterSettingsPanel
  currentRequester={currentRequester}
  savedLocation={requesterProfile ? { pincode: requesterProfile.pincode ?? null, area: requesterProfile.area ?? null, city: requesterProfile.city ?? null } : null}
  onSaved={() => {
  showToast(isHi ? 'सेटिंग्स सहेजी गईं!' : 'Settings saved!', 'success');
  }}
  />
  )}

  <DeleteAccountModal
 open={showDeleteModal}
 onClose={() => setShowDeleteModal(false)}
 onDeleted={onLogout}
 />

 {/* Requester Stat Strip */}
 <div id="requester-stat-strip" className="grid grid-cols-1 md:grid-cols-3 gap-3">
  <div className="bg-white border border-ink-200 p-4">
   <div className="flex items-center justify-between">
    <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
     {isHi ? 'सक्रिय प्रसारण' : 'Active Broadcasts'}
    </span>
    <div className="grid h-8 w-8 place-items-center bg-blood-500/10 text-blood-600">
     <Clock className="w-4 h-4" />
    </div>
   </div>
    <p className="font-display text-2xl font-extrabold tabular-nums text-ink-900 mt-2">
     {requests.filter(r => ['open', 'broadcasting', 'matching', 'partially_matched', 'secured', 'search_exhausted'].includes(r.status)).length}
    </p>
  </div>

  <div className="bg-white border border-ink-200 p-4">
   <div className="flex items-center justify-between">
    <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
     {isHi ? 'मिले हुए दाता' : 'Donors Matched'}
    </span>
    <div className="grid h-8 w-8 place-items-center bg-blood-500/10 text-blood-600">
      <Users className="w-4 h-4" />
    </div>
   </div>
    <p className="font-display text-2xl font-extrabold tabular-nums text-ink-900 mt-2">
     {matches.filter(m => m.donor_response === 'approved').length}
    </p>
  </div>

  <div className="bg-white border border-ink-200 p-4">
   <div className="flex items-center justify-between">
    <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
     {isHi ? 'पूर्ण' : 'Fulfilled'}
    </span>
    <div className="grid h-8 w-8 place-items-center bg-blood-500/10 text-blood-600">
     <CheckCircle className="w-4 h-4" />
    </div>
   </div>
    <p className="font-display text-2xl font-extrabold tabular-nums text-ink-900 mt-2">
     {requests.filter(r => r.status === 'fulfilled').length}
    </p>
  </div>
 </div>

  {/* Emergency Request Command Center */}
  {requests.length > 0 && (
   <div className="bg-white border border-ink-200 p-6 text-ink-900 relative overflow-hidden">
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
     <div className="space-y-1.5 max-w-xl">
      <h3 className="text-lg font-bold text-ink-900 tracking-tight">
       {isHi ? 'नया रक्त अनुरोध भेजें' : 'Generate & Broadcast Blood Requests'}
      </h3>
      <p className="text-xs text-ink-600 leading-relaxed">
       {isHi
        ? 'रक्त अनुरोध बनाएं, लाइव दाताओं से जुड़ें और टिकट्स प्रबंधित करें।'
        : 'Create verified emergency blood requests, broadcast to compatible nearby donors, and manage live tracking tickets.'}
      </p>
      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-semibold text-ink-500">
       <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blood-600 animate-pulse" />
        <span>{requests.filter(r => ['broadcasting', 'open', 'matching', 'partially_matched', 'secured', 'search_exhausted'].includes(r.status)).length} Active</span>
       </div>
       <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-ink-300" />
        <span>{requests.filter(r => r.status === 'draft').length} Drafts</span>
       </div>
       <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-ink-900" />
        <span>{requests.filter(r => r.status === 'fulfilled').length} Fulfilled</span>
       </div>
      </div>
     </div>
     <button
      id="btn-command-center-generate"
      onClick={onNavigateToRequest}
      className="px-5 py-3 bg-blood-600 hover:bg-blood-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
     >
      <PlusCircle className="w-4 h-4" />
      <span>{isHi ? 'नया अनुरोध' : 'New Request'}</span>
     </button>
    </div>
   </div>
  )}

 {/* Main Content Pane */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
  
  {/* Left column: My Request Registry */}
  <div className="space-y-3">
  <div className="flex justify-between items-center px-1">
  <h3 className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
  {t.requesterDashboard.activeRequests} ({requests.length})
  </h3>
  <button 
  id="btn-refresh-dashboard"
  onClick={loadDashboardData}
  className="text-[10px] font-semibold uppercase tracking-wider text-blood-600 hover:text-blood-700 transition-colors cursor-pointer"
  >
  {isHi ? 'रिफ्रेश' : 'Refresh'}
  </button>
  </div>

  {/* My Drafts Banner */}
  {requests.filter(r => r.status === 'draft').length > 0 && (
  <div className="bg-ink-50 border border-ink-200 p-3 space-y-2">
  <div className="flex items-center gap-2">
  <Save className="w-3.5 h-3.5 text-blood-600" />
   <span className="text-xs font-bold text-ink-800">
   {requests.filter(r => r.status === 'draft').length} Draft{requests.filter(r => r.status === 'draft').length > 1 ? 's' : ''}
   </span>
  </div>
  <div className="space-y-1.5">
  {requests.filter(r => r.status === 'draft').map(draft => (
  <div key={draft.id} className="flex items-center justify-between bg-white border border-ink-200 px-3 py-2">
  <div>
  <p className="text-xs font-semibold text-ink-900">{draft.blood_type_needed} · {draft.units_required}u</p>
  <p className="text-[10px] text-ink-500">{draft.hospital_name} · {draft.hospital_city}</p>
  </div>
  <button
  onClick={() => handleBroadcastDraft(draft)}
  disabled={broadcastingDraftId === draft.id}
  className="flex items-center gap-1.5 px-3 py-1.5 bg-blood-600 hover:bg-blood-700 text-white font-semibold text-[10px] transition-all cursor-pointer disabled:opacity-50"
  >
  {broadcastingDraftId === draft.id ? (
  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
  ) : (
  <Megaphone className="w-3 h-3" />
  )}
  Broadcast
  </button>
  </div>
  ))}
  </div>
  </div>
  )}

  {dataError ? (
  <StateMessage
  variant="error"
  title={dataError}
  onRetry={() => { setDataError(null); loadDashboardData(); }}
  isHi={isHi}
  />
  ) : loadingData && requests.length === 0 ? (
  <div className="bg-white border border-ink-200 p-6 text-center">
  <span className="w-5 h-5 border-2 border-blood-600 border-t-transparent rounded-full animate-spin inline-block"></span>
  <p className="text-xs text-ink-500 mt-2 font-semibold">{isHi ? 'लोड हो रहा है...' : 'Loading...'}</p>
  </div>
  ) : requests.length === 0 ? (
  <div className="bg-white border border-ink-200 p-6 text-center">
  <Droplet className="w-8 h-8 mx-auto text-ink-300 mb-2" />
  <p className="text-sm text-ink-800 font-bold">{t.requesterDashboard.noRequests}</p>
  <p className="text-xs text-ink-500 mt-1 leading-relaxed">
  {t.requesterDashboard.noRequestsSub}
  </p>
  <button
  id="btn-empty-create-req"
  onClick={onNavigateToRequest}
  className="mt-3 px-5 py-2 bg-blood-600 hover:bg-blood-700 text-white font-semibold text-xs transition-all cursor-pointer"
  >
  {t.requesterDashboard.newRequestBtn}
  </button>
  </div>
  ) : (
  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
  {requests.map(req => {
  const isSelected = req.id === selectedRequestId;
  const reqMatches = matches.filter(m => m.request_id === req.id);
  const approvedMatches = reqMatches.filter(m => m.donor_response === 'approved');
  const approvedCount = approvedMatches.length;

  return (
  <button
  key={req.id}
  id={`btn-select-req-${req.id}`}
  onClick={() => setSelectedRequestId(req.id)}
  className={`w-full text-left p-3.5 transition-all block cursor-pointer border ${
   isSelected
   ? 'bg-white border-ink-900'
   : 'bg-white border-transparent hover:border-ink-200'
   }`}
  >
  <div className="flex justify-between items-start gap-2 mb-1">
  <span className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
  {req.tracking_code}
  </span>
  <div className="flex items-center gap-1.5">
  {getStatusBadge(req.status, req.id)}
  {getUrgencyBadge(req.urgency_level)}
  </div>
  </div>

  <h4 className="text-xs font-semibold text-ink-900 truncate">
  {req.patient_name}
  </h4>

  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
  <span className="px-1.5 py-0.5 text-[10px] font-bold font-mono bg-blood-50 text-blood-700 border border-blood-100">
  {req.blood_type_needed}
  </span>
  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-ink-50 text-ink-600 border border-ink-100">
  {req.units_required}u
  </span>
  <span className="text-[10px] text-ink-400">
  {req.hospital_city}
  </span>
  </div>

  {approvedCount > 0 && (
  <div className="mt-2 pt-2 border-t border-ink-100">
  <div className="flex items-center gap-1.5 flex-wrap">
  <span className="text-[10px] font-semibold text-blood-600 flex items-center gap-1">
  <Users className="w-3 h-3" />
  {approvedCount} {isHi ? 'दाता' : 'matched'}
  </span>
  {approvedMatches.slice(0, 3).map(m => {
  const donor = donors.find(d => d.id === m.donor_id);
  if (!donor) return null;
  return (
  <span key={m.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blood-50 border border-blood-100 text-[9px] font-semibold text-blood-700">
   <span className="w-3 h-3 rounded-full bg-blood-200 text-blood-700 flex items-center justify-center text-[7px] font-bold">{donor.full_name[0]}</span>
  {donor.full_name.split(' ')[0]}
  </span>
  );
  })}
  {approvedCount > 3 && (
  <span className="text-[9px] text-ink-400 font-medium">+{approvedCount - 3}</span>
  )}
  </div>
  </div>
  )}

  <div className="mt-1.5 text-[10px] text-ink-400">
   {new Date(req.fulfilled_at || req.created_at).toLocaleDateString()}
  </div>
  </button>
  );
  })}
  </div>
  )}
  </div>

 {/* Right columns: Selected Request Match Operations & Management */}
 <div className="lg:col-span-2">
 {selectedRequest ? (
 <div className="bg-white border border-ink-200">
  
  {/* Card Header Info */}
  <div className="p-5 border-b border-ink-100">
  <div className="flex flex-wrap justify-between items-center gap-2">
  <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
  {isHi ? 'अनुरोध' : 'Request'} &bull; {selectedRequest.tracking_code}
  </span>
  <div className="flex items-center gap-2">
  {getStatusBadge(selectedRequest.status)}
  {getUrgencyBadge(selectedRequest.urgency_level)}
  </div>
  </div>

  <h3 className="text-xl font-bold text-ink-900 mt-2 tracking-tight">
  {selectedRequest.blood_type_needed} &bull; {selectedRequest.units_required} {isHi ? 'यूनिट' : 'units'}
  </h3>
  <p className="text-sm text-ink-500 mt-1">
  {selectedRequest.hospital_name} &bull; {selectedRequest.hospital_city}
  </p>
  <div className="mt-3 inline-flex items-center gap-2 bg-ink-50 px-3 py-1 border border-ink-100">
  <span className="text-xs font-semibold text-ink-700">{selectedRequest.patient_name} {selectedRequest.patient_age ? `(${selectedRequest.patient_age}Y)` : ''}</span>
  </div>
  </div>

  {/* Patient and Hospital Meta Grid */}
  <div className="p-5 space-y-5">
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-ink-100">
  <div className="space-y-1">
  <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500 block">{isHi ? 'पिनकोड' : 'Pincode'}</span>
  <p className="text-sm font-semibold text-ink-900">{selectedRequest.hospital_pincode} - {selectedRequest.hospital_area}</p>
  </div>
  <div className="space-y-1">
  <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500 block">{isHi ? 'नोट्स' : 'Notes'}</span>
   <p className="text-xs font-medium text-ink-600 leading-relaxed">
  "{selectedRequest.additional_notes || '—'}"
  </p>
  </div>
  </div>

 {/* Match Operations Section */}
 <div className="bg-white border border-ink-100 p-5 ">
 <div className="flex justify-between items-center mb-4">
 <h4 className="text-[12px] font-semibold text-ink-900 flex items-center gap-1.5">
 {isHi ? 'प्रतिक्रिया देने वाले दाता' : 'Donors responding'}
 </h4>
 <span className="text-[10px] font-semibold text-blood-600 bg-blood-50 px-2 py-0.5 border border-blood-100">
 {selectedMatches.length} {isHi ? 'मिले' : 'matched'}
 </span>
 </div>
 {selectedRequest.search_batch && ['matching', 'partially_matched', 'secured', 'open', 'search_exhausted'].includes(selectedRequest.status) && (
 <p className="text-[10px] uppercase tracking-[0.12em] text-ink-400 mb-4 font-semibold -mt-2">
 {isHi ? `🔎 सर्च ब्याज ${selectedRequest.search_batch}/15` : `🔎 Search budget ${selectedRequest.search_batch}/15`}
 </p>
 )}

 {selectedMatches.length === 0 ? (
 <div className="bg-ink-50 p-6 border border-dashed border-ink-200 text-center">
 <p className="text-xs text-ink-800 font-semibold uppercase tracking-wider">{isHi ? 'निकटतम खोज जारी है' : 'Proximity Search in Progress'}</p>
 <p className="text-[11px] text-ink-500 mt-2 leading-relaxed max-w-sm mx-auto">
 {isHi ? `हम पिनकोड ${selectedRequest.hospital_pincode} के पास संगत रक्तदाताओं की खोज कर रहे हैं। मिलान यहाँ तुरंत दिखाई देंगे।` : `We are searching our database for compatible blood donors near pincode ${selectedRequest.hospital_pincode}. Matches will appear here instantly.`}
 </p>
 </div>
 ) : (
 <div className="space-y-3">
 {selectedMatches.map((match, idx) => {
 const donor = donors.find(d => d.id === match.donor_id);
 if (!donor) return null;

 const isApproved = match.donor_response === 'approved';
 const isDeclined = match.donor_response === 'declined';
 const isPending = match.donor_response === 'pending';

 return (
 <div 
 key={match.id}
 id={`match-row-${match.id}`}
 className={`p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${
  isApproved ? 'bg-blood-50 border border-blood-200' :
  isDeclined ? 'bg-ink-50 border border-ink-200 opacity-60' :
  'bg-white border border-ink-200'
  }`}
>
 <div className="flex items-center gap-3 w-full sm:w-auto">
 <div className={`grid h-9 w-9 place-items-center rounded-full text-white text-[10px] font-semibold shrink-0 ${isApproved ? 'bg-blood-600' : 'bg-ink-300'}`}>
 {isApproved ? donor.full_name[0] : '?'}
 </div>
 <div className="space-y-0.5">
 <div className="flex items-center gap-2">
 <span className="font-semibold text-[11.5px] text-ink-900 flex items-center gap-1.5">
 {isApproved ? donor.full_name : (isHi ? `रक्तदाता #${idx + 1}` : `Donor #${idx + 1}`)}
 {donor.aadhaar_verified && isApproved && (
 <span title="DigiLocker Verified"><Shield className="w-3.5 h-3.5 text-blood-500 fill-blood-500/20" /></span>
 )}
 </span>
 <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-white border border-ink-200 text-ink-700">
 {donor.blood_type}
 </span>
 </div>
 <p className="text-[10px] text-ink-500 flex items-center gap-1">
 {donor.area} ({donor.pincode}) &bull; ~{match.distance_km ? `${match.distance_km} ${isHi ? 'किमी दूर' : 'km away'}` : (isHi ? '2 किमी दूर' : '2km away')}
 </p>
 </div>
 </div>

 <div className="flex-shrink-0 w-full sm:w-auto sm:text-right flex flex-col sm:items-end gap-2">
 {isPending && (
 <>
 <p className="text-[10.5px] font-semibold text-ink-600 flex items-center gap-1">
 <Clock className="w-3 h-3 animate-spin" />
 {isHi ? 'प्रतीक्षारत' : 'Pending'}
 </p>
 <p className="text-[10px] text-ink-500">{isHi ? 'सूचित किया गया' : 'Notified'}</p>
 </>
 )}
 
 {isDeclined && (
 <>
 <p className="text-[10.5px] font-semibold text-ink-400">{isHi ? 'अस्वीकृत' : 'Declined'}</p>
 </>
 )}

 {isApproved && (
 <div className="flex flex-col sm:items-end w-full">
 <p className="text-[10.5px] font-semibold text-blood-600 mb-2">{isHi ? 'पुष्टि की गई' : 'Confirmed'}</p>
 <div className="flex gap-2 w-full sm:w-auto">
 <a
 id={`lnk-call-donor-${match.id}`}
 href={`tel:${donor.phone}`}
 className="flex-1 sm:flex-initial px-3 py-1.5 bg-white hover:bg-ink-50 text-ink-700 border border-ink-200 text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
>
 <Phone className="w-3 h-3" />
 {isHi ? 'कॉल' : 'Call'}
 </a>
 {donor.whatsapp_number && (
 <a
 id={`lnk-wa-donor-${match.id}`}
 href={`https://wa.me/${donor.whatsapp_number.replace(/\+/g, '')}`}
 target="_blank"
 rel="noopener noreferrer"
  className="flex-1 sm:flex-initial px-3 py-1.5 bg-whatsapp/10 hover:bg-whatsapp/20 text-whatsapp border border-whatsapp/30 text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
>
 <MessageSquare className="w-3 h-3" />
 {isHi ? 'चैट' : 'Chat'}
 </a>
 )}
 </div>
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Dashboard Request Level Action Buttons */}
 {selectedRequest.status !== 'fulfilled' && selectedRequest.status !== 'cancelled' ? (
 <div className="pt-4 border-t border-ink-100 flex flex-wrap gap-2">
   <button
   id="btn-fulfill-req-act"
   onClick={() => handleFulfillRequest(selectedRequest)}
   className="px-5 py-2 bg-blood-600 hover:bg-blood-700 text-white font-semibold text-[11px] transition-all flex items-center gap-2"
   >
   <CheckCircle className="w-4 h-4" />
   {isHi ? 'पूर्ण चिह्नित करें' : 'Mark Fulfilled'}
   </button>
   <button
   id="btn-cancel-req-act"
   onClick={() => handleCancelRequest(selectedRequest)}
   className="px-5 py-2 bg-white hover:bg-blood-50 text-blood-700 border border-blood-300 font-semibold text-[11px] transition-all flex items-center gap-2"
  >
  <XCircle className="w-4 h-4" />
  {isHi ? 'रद्द करें' : 'Cancel'}
  </button>
 </div>
 ) : (
 <div className="bg-ink-50 p-4 text-center border border-ink-100 mt-4">
  <p className="text-[11px] font-semibold text-ink-700 uppercase tracking-wider">
  {isHi ? 'स्थिति:' : 'Status:'} <strong className="text-blood-600 ml-1">{selectedRequest.status}</strong>
  </p>
  <p className="text-[11px] text-ink-500 mt-1">
  {isHi ? 'यह अनुरोध पूरा हो चुका है।' : 'This request is complete.'}
  </p>
 </div>
 )}

 </div>
 </div>
 ) : (
 <div className="bg-white border border-ink-200 text-center flex flex-col items-center justify-center min-h-[400px]">
   <div className="w-14 h-14 bg-blood-50 flex items-center justify-center text-blood-500 mb-3 border border-blood-100">
 <FileText className="w-8 h-8" />
 </div>
 <h3 className="text-lg font-semibold text-ink-900 tracking-tight">{isHi ? 'एक रक्त अनुरोध चुनें' : 'Select a Blood Request'}</h3>
 <p className="text-sm text-ink-500 mt-2 max-w-sm leading-relaxed">
 {isHi ? 'लाइव दाता मिलान प्रतिक्रियाएं देखने के लिए बाईं सूची से अपना कोई अनुरोध चुनें।' : 'Choose one of your requirements from the left list to view live donor match responses and consent gateways.'}
 </p>
 </div>
 )}
 </div>

 </div>

 {toast && (
 <div
 id="requester-toast"
  className={`fixed bottom-6 right-6 z-[100] px-5 py-3.5 bg-ink-950 text-white transition-all duration-200 flex items-center gap-3 text-xs font-bold border-l-[3px] ${
  toast.type === 'error'
  ? 'border-blood-500'
  : 'border-blood-500'
  }`}
 >
  {toast.type === 'error' ? <XCircle className="w-4 h-4 text-blood-400" /> : <CheckCircle className="w-4 h-4 text-blood-400" />}
  <span>{toast.message}</span>
 </div>
 )}
 </div>
 );
}

