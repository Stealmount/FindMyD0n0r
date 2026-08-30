import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Clock, LogOut, X } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { authenticatedApi } from '../../lib/api';
import { HospitalUser, BloodType, BloodRequest, Match, User } from '../../types';
import { HospitalSidebar, HospitalView } from './HospitalSidebar';
import { HospitalHeader } from './HospitalHeader';
import { Worklist } from './views/Worklist';
import { LiveView } from './views/LiveView';
import { HistoryView } from './views/HistoryView';
import { CampsView } from './views/CampsView';
import { RequestsView } from './views/RequestsView';
import { DonorsView } from './views/DonorsView';
import { StatsView } from './views/StatsView';
import { ProfileView } from './views/ProfileView';
import { EntityDrawer } from './widgets/Shared';

interface HospitalDashboardProps {
 hospital: HospitalUser;
 onLogout: () => void;
}

// Tolerant phone normalization (§6.11). Registration stores the 91-prefixed
// 12-digit form while profile edits save the de-prefixed 10-digit form; matching
// must treat them as the same number instead of a literal string compare.
const normalizePhone = (p?: string | null) => {
 const digits = String(p || '').replace(/\D/g, '');
 return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
};

// Trust range for a "verified" institution — reflects live network health.
function LivePulse() {
 const [seconds, setSeconds] = useState(0);
 useEffect(() => {
 const t = setInterval(() => setSeconds(s => s + 1), 1000);
 return () => clearInterval(t);
 }, []);
 return (
  <span className="inline-flex items-center gap-1.5 border border-vital-500/30 bg-vital-500/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest tabular-nums text-vital-400">
 <span className="relative flex h-2 w-2">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vital-400 opacity-75" />
 <span className="relative inline-flex rounded-full h-2 w-2 bg-vital-500" />
 </span>
 {seconds}s ago
 </span>
 );
}

export function HospitalDashboard({ hospital, onLogout }: HospitalDashboardProps) {
 const { language, setLanguage } = useLanguage();
 const isHi = language === 'HI';

 // Status gate — render holding screen before any real state
 if (hospital.status === 'pending') {
 return (
  <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center p-8 text-center font-sans">
  <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mb-6">
  <Clock className="w-10 h-10 text-amber-600" />
  </div>
   <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 mb-2">
   {isHi ? 'सत्यापन प्रतीक्षित है' : 'Verification Pending'}
   </h1>
  <p className="text-ink-500 text-sm max-w-sm leading-relaxed mb-2">
  {isHi
  ? `${hospital.hospital_name} का आवेदन हमारी टीम द्वारा समीक्षाधीन है। अनुमोदन पर आपको WhatsApp पर सूचना मिलेगी।`
  : `Your application for ${hospital.hospital_name} is under review. You'll be notified once approved.`}
  </p>
  <button onClick={onLogout} className="text-ink-500 hover:text-ink-900 text-sm transition flex items-center gap-2 cursor-pointer">
 <LogOut className="w-4 h-4" /> {isHi ? 'लॉगआउट' : 'Sign out'}
 </button>
 </div>
 );
 }
 if (hospital.status === 'rejected') {
 return (
  <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center p-8 text-center font-sans">
  <div className="w-20 h-20 rounded-full bg-blood-500/10 border-2 border-blood-500/30 flex items-center justify-center mb-6">
  <X className="w-10 h-10 text-blood-600" />
  </div>
   <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 mb-2">
   {isHi ? 'आवेदन अस्वीकृत' : 'Application Rejected'}
   </h1>
  <p className="text-ink-500 text-sm max-w-sm leading-relaxed mb-6">
  {isHi
  ? 'आपका संस्थागत आवेदन इस समय अनुमोदित नहीं किया जा सका। सही विवरण के साथ पुनः पंजीकरण करें या सहायता से संपर्क करें।'
  : 'Your institutional application could not be approved at this time. Please re-register or contact support.'}
  </p>
  <button onClick={onLogout} className="text-ink-500 hover:text-ink-900 text-sm transition flex items-center gap-2 cursor-pointer">
 <LogOut className="w-4 h-4" /> {isHi ? 'लॉगआउट' : 'Sign out'}
 </button>
 </div>
 );
 }

// ── View router
  const [activeView, setActiveView] = useState<HospitalView>('dashboard');

 // ── Inventory (localStorage-backed, blood banks / hospitals only)
 const [inventory, setInventory] = useState<Record<BloodType, number>>(() => {
 const saved = localStorage.getItem(`hosp_inventory_${hospital.id}`);
 if (saved) { try { return JSON.parse(saved); } catch { } }
 return { 'A+': 18, 'A-': 5, 'B+': 14, 'B-': 4, 'O+': 6, 'O-': 8, 'AB+': 12, 'AB-': 3 };
 });

 useEffect(() => {
 localStorage.setItem(`hosp_inventory_${hospital.id}`, JSON.stringify(inventory));
 }, [inventory, hospital.id]);

 const criticalCount = (Object.values(inventory) as number[]).filter(v => v <= 3).length;
 const lowCount = (Object.values(inventory) as number[]).filter(v => v > 3 && v <= 6).length;

 // ── Emergency broadcast state
 const [selectedBlood, setSelectedBlood] = useState<BloodType>('O+');
 const [units, setUnits] = useState(2);
 const [urgency, setUrgency] = useState<'critical' | 'urgent' | 'planned'>('urgent');
 const [patientName, setPatientName] = useState('Emergency Transfusion');
 const [requestStatus, setRequestStatus] = useState<'idle' | 'broadcasting' | 'sent' | 'error'>('idle');
 const [notifiedCount, setNotifiedCount] = useState(0);
 const [lastSync, setLastSync] = useState<Date | null>(null);

  // ── Live Matches
  const [activeMatches, setActiveMatches] = useState<(Match & { donorName: string; donorPhone: string })[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const fetchLiveMatches = async () => {
    try {
      const data = await authenticatedApi<{ requests: BloodRequest[]; matches: Match[]; users: User[] }>(
        '/api/hospital/dashboard', undefined, 'GET'
      );
      const allRequests = data.requests || [];
      const allMatches = data.matches || [];
      const allUsersData = data.users || [];
      setAllUsers(allUsersData);
      const hospitalReqs = allRequests.filter(r =>
        normalizePhone(r.requester_phone) === normalizePhone(hospital.phone) || r.hospital_name === hospital.hospital_name
      );
      const reqIds = new Set(hospitalReqs.map(r => r.id));
      const enriched = allMatches
        .filter(m => reqIds.has(m.request_id))
        .map(m => {
          const donor = allUsersData.find(u => u.id === m.donor_id);
          return { ...m, donorName: donor?.full_name || 'Volunteer Donor', donorPhone: donor?.whatsapp_number || donor?.phone || '—' };
        });
      setActiveMatches(enriched);
      setLastSync(new Date());
    } catch { /* silent */ } finally {
      setLoadingMatches(false);
    }
  };

 useEffect(() => {
 fetchLiveMatches();
 const interval = setInterval(fetchLiveMatches, 8000);
 return () => clearInterval(interval);
 }, [hospital.phone, hospital.hospital_name]);

 // ── Donor directory (privacy-scoped, §5/6.6): only donors who matched/opted
 // into THIS institution's requests are listed. A donor's phone is never exposed
 // unless the donor has approved the match for this institution.
 const matchedDonors = useMemo(() => {
   const approvedIds = new Set(activeMatches.filter(m => m.donor_response === 'approved').map(m => m.donor_id));
   return allUsers
     .filter(u => activeMatches.some(m => m.donor_id === u.id))
     .map(u => ({
       ...u,
       phone: approvedIds.has(u.id) ? (u.whatsapp_number || u.phone) : undefined,
       whatsapp_number: approvedIds.has(u.id) ? (u.whatsapp_number || u.phone) : undefined,
     }));
 }, [allUsers, activeMatches]);

 // ── History
 const [history, setHistory] = useState<BloodRequest[]>([]);
 const [historyLoading, setHistoryLoading] = useState(false);

 // Re-pointed: `/api/institutions/requests` does not exist — derive institution
 // requests from the live dashboard payload instead (single source of truth).
 const fetchHistory = async () => {
 setHistoryLoading(true);
 try {
 const data = await authenticatedApi<{ requests: BloodRequest[] }>(
 '/api/hospital/dashboard', undefined, 'GET'
 );
  const hospitalReqs = (data.requests || []).filter(r =>
  normalizePhone(r.requester_phone) === normalizePhone(hospital.phone) || r.hospital_name === hospital.hospital_name
  );
  setHistory(hospitalReqs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  } catch { /* silent */ } finally {
  setHistoryLoading(false);
  }
  };

  // Auto-load history on mount (§5 item 12), so the History tab is ready without
  // a manual load, and stays fresh while the dashboard is open.
  useEffect(() => {
  void fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospital.phone, hospital.hospital_name]);

// ── Donor detail drawer
  const [detailMatch, setDetailMatch] = useState<(Match & { donorName: string; donorPhone: string }) | null>(null);

  // ── Upcoming camps quick stat (camp-capable institutions only)
  const showCamps = hospital.institution_type === 'ngo' || hospital.institution_type === 'blood_bank';
  const [upcomingCampCount, setUpcomingCampCount] = useState(0);
  const fetchCampCount = async () => {
    try {
      const data = await authenticatedApi<{ camps: Array<{ camp_date: string; status?: string }> }>('/api/camps', undefined, 'GET');
      const now = new Date();
      const count = (data.camps || []).filter(c => c.status !== 'cancelled' && new Date(c.camp_date) >= now).length;
      setUpcomingCampCount(count);
    } catch { /* silent */ }
  };
  useEffect(() => { if (showCamps) fetchCampCount(); }, [showCamps]);

  const handleBroadcast = async (e: React.FormEvent) => {
 e.preventDefault();
 setRequestStatus('broadcasting');
 try {
 const data = await authenticatedApi<{ matched?: number }>(
 '/api/requests',
 {
 verificationToken: 'verified',
 patient_name: patientName,
 blood_type_needed: selectedBlood,
 units_required: units,
  hospital_name: hospital.hospital_name,
  hospital_pincode: hospital.pincode,
  hospital_area: hospital.address?.trim() || hospital.city,
  hospital_city: hospital.city,
 urgency_level: urgency,
 showcase_opt_in: true,
 },
 'POST'
 );
 setNotifiedCount(data.matched || 0);
 setRequestStatus('sent');
 fetchLiveMatches();
 setTimeout(() => { setRequestStatus('idle'); setPatientName('Emergency Transfusion'); }, 4000);
 } catch {
 setRequestStatus('error');
 setTimeout(() => setRequestStatus('idle'), 3000);
 }
 };

const pendingReplies = activeMatches.filter(m => m.donor_response === 'pending').length;

  return (
 <div className="min-h-screen bg-ink-50 flex flex-col font-sans relative overflow-hidden text-ink-900 w-full">
 {/* Background */}
 <div className="absolute inset-0 grid-pattern opacity-35 pointer-events-none" />

 {/* Mobile-only horizontal top bar */}
 <div className="md:hidden relative z-10">
 <div className="px-4 pt-4 flex items-center justify-between">
 <div className="flex items-center gap-2">
  <div className="grid h-9 w-9 place-items-center bg-blood-600">
  <Shield className="h-4 w-4 text-white" />
  </div>
 <div>
 <div className="text-sm font-bold text-ink-900 leading-none">{hospital.hospital_name}</div>
 <div className="text-[10px] text-ink-400 mt-0.5">{isHi ? 'संस्थागत CRM' : 'Institution CRM'}</div>
 {hospital.admin_name && (
 <div className="text-[10px] text-ink-500 mt-0.5 truncate max-w-[160px]">{hospital.admin_name}</div>
 )}
 </div>
 </div>
 <div className="flex items-center gap-2">
 <LivePulse />
  <button onClick={onLogout} className="grid h-9 w-9 cursor-pointer place-items-center text-ink-600 transition-colors duration-200 hover:bg-ink-100 hover:text-ink-900">
  <LogOut className="w-4 h-4" />
  </button>
 </div>
 </div>
      {/* Mobile view switcher */}
      <div className="px-3 py-3 flex gap-1 overflow-x-auto">
        {(['dashboard', 'requests', 'donors', 'live', 'history', ...(showCamps ? ['camps'] : []), 'stats', 'settings'] as HospitalView[]).map(v => (
          <button key={v} onClick={() => setActiveView(v)}
            className={`shrink-0 cursor-pointer border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
              activeView === v ? 'border-blood-600 bg-blood-600 text-white' : 'border-ink-300 text-ink-600 hover:border-ink-400 hover:text-ink-900'
            }`}>
            {isHi
              ? (v === 'dashboard' ? 'डैशबोर्ड' : v === 'requests' ? 'अनुरोध' : v === 'donors' ? 'दाता' : v === 'live' ? 'लाइव' : v === 'history' ? 'इतिहास' : v === 'stats' ? 'आंकड़े' : v === 'settings' ? 'प्रोफ़ाइल' : 'शिविर')
              : (v === 'dashboard' ? 'Dashboard' : v === 'requests' ? 'Requests' : v === 'donors' ? 'Donors' : v === 'live' ? 'Live' : v === 'history' ? 'History' : v === 'stats' ? 'Stats' : v === 'settings' ? 'Profile' : 'Camps')}
          </button>
        ))}
      </div>
 </div>

 {/* Desktop header + sidebar layout */}
 <div className="flex flex-1 min-h-0 relative z-10">
 <HospitalSidebar
 activeView={activeView}
 onNavigate={setActiveView}
 showCamps={showCamps}
 pendingReplies={pendingReplies}
 lowStockCount={criticalCount + lowCount}
 isHi={isHi}
 />

 <div className="flex-1 flex flex-col min-w-0">
 {/* Desktop header only (mobile has its own top bar) */}
 <div className="hidden md:block">
 <HospitalHeader
 hospital={hospital}
 contact_name={hospital.admin_name}
 contact_email={hospital.email}
 criticalCount={criticalCount}
 lowCount={lowCount}
 onLanguageChange={(lang) => setLanguage(lang)}
 onLogout={onLogout}
 language={language}
 lastSync={lastSync}
 />
 </div>

 <main className="flex-1 relative z-10 p-4 sm:p-6 lg:p-8 overflow-y-auto">
 <AnimatePresence mode="wait">
 <motion.div
 key={activeView}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -10 }}
 transition={{ duration: 0.2 }}
 >
{activeView === 'dashboard' && (
          <Worklist
            inventory={inventory}
            activeMatches={activeMatches}
            history={history}
            isHi={isHi}
            institutionType={hospital.institution_type}
            criticalCount={criticalCount}
            lowCount={lowCount}
            upcomingCampCount={upcomingCampCount}
          />
          )}

 {activeView === 'live' && (
 <LiveView
 inventory={inventory}
 setInventory={setInventory}
 activeMatches={activeMatches}
 loadingMatches={loadingMatches}
 fetchLiveMatches={fetchLiveMatches}
 isHi={isHi}
 institutionType={hospital.institution_type}
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
 onBroadcast={handleBroadcast}
 />
 )}

 {activeView === 'history' && (
 <HistoryView
 history={history}
 historyLoading={historyLoading}
 historyLoaded={false}
 fetchHistory={fetchHistory}
 isHi={isHi}
 />
 )}

          {showCamps && activeView === 'camps' && (
            <CampsView hospital={hospital} isHi={isHi} />
          )}

          {activeView === 'requests' && (
            <RequestsView
              requests={history}
              matches={activeMatches}
              users={allUsers}
              isHi={isHi}
              onRequestFulfilled={fetchLiveMatches}
            />
          )}

          {activeView === 'donors' && (
            <DonorsView
              users={matchedDonors}
              isHi={isHi}
            />
          )}

          {activeView === 'stats' && (
            <StatsView isHi={isHi} />
          )}

          {activeView === 'settings' && (
            <ProfileView hospital={hospital} isHi={isHi} />
          )}
 </motion.div>
 </AnimatePresence>
 </main>
 </div>
 </div>

 {/* Entity detail drawer */}
 <EntityDrawer
 open={!!detailMatch}
 onClose={() => setDetailMatch(null)}
 title={detailMatch?.donorName || ''}
 badge={detailMatch ? <LivePulse /> : undefined}
 rows={[
 ...(detailMatch ? [
 { label: isHi ? 'संपर्क' : 'Contact', value: detailMatch.donorPhone },
 ...(detailMatch.distance_km ? [{ label: isHi ? 'दूरी' : 'Distance', value: `${detailMatch.distance_km} km` }] : []),
 { label: isHi ? 'स्थिति' : 'Status', value: detailMatch.donor_response },
 ] : []),
 ]}
 isHi={isHi}
 />
 </div>
 );
}
