import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { User, Match, BloodRequest, DonationLog } from '../types';
import { authenticatedApi } from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import ProfileCard from './DonorDashboard/ProfileCard';
import MatchList from './DonorDashboard/MatchList';
import RequestDetailDrawer from './DonorDashboard/RequestDetailDrawer';
import DonationHistory from './DonorDashboard/DonationHistory';
import { SelfReportCard } from './DonorDashboard/SelfReportCard';
import TabBar from './DonorDashboard/TabBar';
import LoginView from './DonorDashboard/LoginView';
import DonorBadges from './DonorBadges';

interface DonorDashboardProps {
 currentUser: User | null;
 onLoginSuccess: (user: User) => void;
 onLogout: () => void;
 onStateChange?: () => void;
 onGoogleRegisterRedirect?: (googleData: { uid: string; email: string; full_name: string }) => void;
 onNavigate?: (view: string) => void;
}

export default function DonorDashboard({ currentUser, onLoginSuccess, onLogout, onStateChange, onGoogleRegisterRedirect, onNavigate }: DonorDashboardProps) {
 const { t, language } = useLanguage();
 const isHi = language === 'HI';
 const [matches, setMatches] = useState<Match[]>([]);
 const [requests, setRequests] = useState<BloodRequest[]>([]);
 const [dashboardTab, setDashboardTab] = useState<'requests' | 'history'>('requests');
 const [donationLogs, setDonationLogs] = useState<DonationLog[]>([]);
   const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);
    const [detailMatchId, setDetailMatchId] = useState<string | null>(null);
 const [loadingDashboard, setLoadingDashboard] = useState(true);
 const [dashboardError, setDashboardError] = useState<string | null>(null);
 const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  setToast({ message, type });
  setTimeout(() => setToast(null), 3000);
  };

 // Manual Donation Cooldown fields
 const [reportDate, setReportDate] = useState('');
 const [reportNotes, setReportNotes] = useState('');
 const [reporting, setReporting] = useState(false);

 const loadDashboardData = async () => {
 if (!currentUser) return;
 setLoadingDashboard(true);
 setDashboardError(null);
 try {
 const dashboard = await authenticatedApi<{
 matches: Match[]; requests: BloodRequest[]; donationLogs?: DonationLog[];
 }>('/api/donor/matches', undefined, 'GET');
 const donorMatches = dashboard.matches || [];
 const allRequests = dashboard.requests || [];
 const donorLogs = dashboard.donationLogs || [];

 // Sort matches so pending/active ones are on top
 donorMatches.sort((a, b) => {
 if (a.donor_response === 'pending' && b.donor_response !== 'pending') return -1;
 if (a.donor_response !== 'pending' && b.donor_response === 'pending') return 1;
 return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
 });

 // Sort donation logs by date descending
 donorLogs.sort((a, b) => {
 const dateA = new Date(a.donation_date).getTime();
 const dateB = new Date(b.donation_date).getTime();
 if (dateB !== dateA) return dateB - dateA;
 return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
 });

 setMatches(donorMatches);
 setRequests(allRequests);
 setDonationLogs(donorLogs);
 } catch (err) {
 console.error(err);
 setDashboardError(isHi ? 'आपका डेटा लोड नहीं हो सका। कृपया पुनः प्रयास करें।' : 'Could not load your data. Please try again.');
 } finally {
 setLoadingDashboard(false);
 }
 };

 useEffect(() => {
 loadDashboardData();
 }, [currentUser]);

 // Handle Donor Match Decision (Approve/Decline)
 const handleMatchDecision = async (matchId: string, decision: 'approved' | 'declined') => {
 if (!currentUser) return;
 setLoadingMatchId(matchId);
 try {
 if (decision === 'approved') {
 await authenticatedApi(`/api/donor/matches/${matchId}/accept`, {}, 'POST');
 } else {
 await authenticatedApi(`/api/matches/${matchId}/decline`, {}, 'POST');
 }
 await loadDashboardData();
 if (onStateChange) onStateChange();
 showToast(isHi ? `आपने इस अनुरोध को सफलतापूर्वक ${decision === 'approved' ? 'स्वीकार' : 'अस्वीकार'} किया।` : `You have successfully ${decision} this request.`, 'success');
 } catch (error: any) {
 console.error(error);
 showToast(error.message || 'Unable to update this match. Please try again.', 'error');
  } finally {
  setLoadingMatchId(null);
  }
  };

  // Drawer decision: accept keeps the drawer open so the refreshed approved state
  // (with backend-authorized requester contact) is visible immediately; decline closes it.
  const handleDrawerDecision = async (matchId: string, decision: 'approved' | 'declined') => {
  await handleMatchDecision(matchId, decision);
  if (decision === 'declined') setDetailMatchId(null);
  };

  // Self-report external donation to trigger 60-day cooldown
 const handleSelfReportDonation = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!currentUser || !reportDate) return;

 setReporting(true);
 try {
 const lastDate = new Date(reportDate);
 const cooldownObj = new Date(lastDate.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days cooldown
 const cooldownUntilStr = cooldownObj.toISOString().split('T')[0];

  await authenticatedApi('/api/donor/matches/self/confirm', {
  notes: reportNotes || 'Manually reported external donation.',
  donation_date: reportDate,
  }, 'POST');

 const updatedUser: User = {
 ...currentUser,
 last_donation_date: reportDate,
 cooldown_until: cooldownUntilStr,
 account_status: 'cooldown',
 updated_at: new Date().toISOString()
 };
 onLoginSuccess(updatedUser); // Update local state

 showToast(isHi ? `धन्यवाद! आपका रक्तदान सफलतापूर्वक दर्ज किया गया। (${cooldownUntilStr} तक विश्राम अवधि)` : "Thank you! Your donation was logged successfully. Cooldown active until " + cooldownUntilStr + ".", 'success');
 setReportDate('');
 setReportNotes('');
 await loadDashboardData();
 } catch (err) {
 console.error(err);
 showToast(isHi ? "रक्तदान दर्ज करने में विफल।" : "Failed to record donation.", 'error');
 } finally {
 setReporting(false);
 }
 };

 // Login view
 if (!currentUser) {
 return <LoginView onNavigate={onNavigate} />;
 }

   return (
   <div id="donor-dashboard" className="max-w-6xl mx-auto w-full min-w-0 space-y-4 animate-fade-in overflow-x-hidden">
  <ProfileCard
  user={currentUser}
  matches={matches}
  donationLogs={donationLogs}
  onLogout={onLogout}
  onCompleteProfile={() => onNavigate?.('donor-profile')}
  />

  {/* Subdued profile nudge — single neutral card linking to Profile Settings (replaces amber banners) */}
  {(!currentUser?.blood_type || !currentUser?.pincode) && (
  <div className="border border-ink-200 bg-white px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-l-[3px] border-l-blood-500">
   <div className="text-xs leading-relaxed">
    <span className="font-semibold text-ink-900">{isHi ? 'प्रोफ़ाइल पूरी करें — मिलान सक्रिय करने के लिए' : 'Complete your profile to activate matching'}</span>
    <span className="text-ink-500 ml-2">{isHi ? 'ब्लड ग्रुप और पिनकोड की जानकारी अपडेट करें।' : 'Update your blood group and pincode.'}</span>
   </div>
   <button
    type="button"
    id="btn-donor-nudge-profile"
    onClick={() => onNavigate?.('donor-profile')}
    className="inline-flex h-8 items-center gap-1.5 border border-ink-300 bg-white px-4 text-xs font-semibold text-ink-900 transition-colors hover:border-ink-900 hover:bg-ink-50 cursor-pointer shrink-0"
   >
    {isHi ? 'प्रोफ़ाइल सेटिंग्स खोलें →' : 'Open Profile Settings →'}
   </button>
  </div>
  )}

  {donationLogs.length > 0 && (
   <SelfReportCard
    reporting={reporting}
    reportDate={reportDate}
    reportNotes={reportNotes}
    onReportDateChange={setReportDate}
    onReportNotesChange={setReportNotes}
    onReportSubmit={handleSelfReportDonation}
   />
  )}

   <div className="border border-ink-200 bg-white overflow-hidden p-1 min-w-0">
   {/* Tabs Header */}
   <TabBar
   active={dashboardTab}
   matchCount={matches.length}
   historyCount={donationLogs.length}
   onSelect={setDashboardTab}
   />

   {/* Tab content panel */}
   <div className="p-4 sm:p-5 space-y-4 min-w-0">
  {dashboardError ? (
  <div className="text-center py-12 px-4 border border-ink-200 bg-ink-50">
  <p className="text-[13px] font-semibold text-ink-900">{dashboardError}</p>
  <button
  onClick={loadDashboardData}
  className="mt-4 inline-flex items-center gap-2 border border-ink-200 bg-white px-5 py-2 text-xs font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50 cursor-pointer"
 >
  {isHi ? 'फिर कोशिश करें' : 'Try again'}
  </button>
  </div>
  ) : loadingDashboard && matches.length === 0 && donationLogs.length === 0 ? (
  <div className="text-center py-12 px-4 border border-ink-200 bg-ink-50">
  <span className="h-6 w-6 border-2 border-ink-200 border-t-ink-900 rounded-full animate-spin inline-block"></span>
  <p className="text-xs text-ink-500 mt-3 font-semibold">{isHi ? 'सिंक हो रहा है...' : 'Syncing Data...'}</p>
  </div>
  ) : dashboardTab === 'requests' ? (
  <MatchList
  matches={matches}
  requests={requests}
  currentUser={currentUser}
  loadingMatchId={loadingMatchId}
   onViewDetails={(match) => setDetailMatchId(match.id ?? null)}
  onPass={(matchId) => handleMatchDecision(matchId, 'declined')}
  />
  ) : (
  <DonationHistory
  logs={donationLogs}
  requests={requests}
  currentUser={currentUser}
  />
  )}
  </div>
  </div>

  <DonorBadges donationCount={donationLogs.length} />

  <RequestDetailDrawer
  match={detailMatchId ? matches.find(m => m.id === detailMatchId) ?? null : null}
  request={detailMatchId ? (() => { const mm = matches.find(m => m.id === detailMatchId); return mm ? requests.find(r => r.id === mm.request_id) ?? null : null; })() : null}
  currentUser={currentUser}
  loadingMatchId={loadingMatchId}
   onClose={() => setDetailMatchId(null)}
   onDecision={handleDrawerDecision}
   />

  {toast && (
  <div
  id="donor-toast"
  className={`fixed bottom-4 right-4 left-4 sm:left-auto z-[100] border-l-[3px] bg-ink-950 p-3 pr-4 text-[13px] font-medium text-white transition-colors duration-200 flex items-center gap-2.5 animate-fade-in shadow-lg max-w-[calc(100vw-1rem)] sm:max-w-md ${
  toast.type === 'error'
  ? 'border-blood-500'
  : 'border-vital-500'
  }`}
 >
 {toast.type === 'error'
 ? <AlertTriangle className="h-4 w-4 shrink-0 text-blood-400" />
 : <CheckCircle2 className="h-4 w-4 shrink-0 text-vital-400" />}
 <span>{toast.message}</span>
 </div>
 )}
 </div>
 );
}
