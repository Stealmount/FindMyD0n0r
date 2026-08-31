import React from 'react';
import { useLanguage } from '../../lib/LanguageContext';
import { authenticatedApi } from '../../lib/api';
import {
  User, BloodRequest, Match, NotificationLog, DonationLog, Requester, AdminUser,
} from '../../types';
import { AuditEntry, FaqEntry } from './types';
import AdminShell, { AdminTab } from './AdminShell';
import Overview from './views/Overview';
import Donors from './views/Donors';
import Requesters from './views/Requesters';
import Users from './views/Users';
import Requests from './views/Requests';
import Matches from './views/Matches';
import Institutions from './views/Institutions';
import Notifications from './views/Notifications';
import AuditLog from './views/AuditLog';
import Faq from './views/Faq';
import Roles from './views/Roles';
import Settings from './views/Settings';
import { EntityDrawer, StatusPill, downloadCSV } from './widgets/Shared';

interface AdminConsoleProps {
  admin: AdminUser;
  onLogout: () => void;
}

interface DashboardResponse {
  users: User[];
  blood_requests: BloodRequest[];
  matches: Match[];
  notifications: NotificationLog[];
  donation_log: DonationLog[];
}

const REQUEST_LIVE = ['open', 'broadcasting', 'matching', 'partially_matched', 'secured', 'search_exhausted'];

export function AdminConsole({ admin, onLogout }: AdminConsoleProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';
  const adminEmail = admin.email || admin.username;

  const [activeTab, setActiveTab] = React.useState<AdminTab>('overview');
  const [globalSearch, setGlobalSearch] = React.useState('');

  // Core collections
  const [users, setUsers] = React.useState<User[]>([]);
  const [requests, setRequests] = React.useState<BloodRequest[]>([]);
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [notifications, setNotifications] = React.useState<NotificationLog[]>([]);
  const [donationLogs, setDonationLogs] = React.useState<DonationLog[]>([]);
  const [institutions, setInstitutions] = React.useState<any[]>([]);
  const [requesters, setRequesters] = React.useState<Requester[]>([]);
  const [audits, setAudits] = React.useState<AuditEntry[]>([]);
  const [faqs, setFaqs] = React.useState<FaqEntry[]>([]);
  const [telemetry, setTelemetry] = React.useState<any>(null);

  const [loadingDashboard, setLoadingDashboard] = React.useState(true);
  const [loadingInstitutions, setLoadingInstitutions] = React.useState(false);
  const [loadingRequesters, setLoadingRequesters] = React.useState(false);
  const [loadingAudits, setLoadingAudits] = React.useState(false);
  const [loadingFaqs, setLoadingFaqs] = React.useState(false);

  // Donors view state
  const [showDeleted, setShowDeleted] = React.useState(false);
  const [bloodFilter, setBloodFilter] = React.useState('');
  const [donorSearch, setDonorSearch] = React.useState('');

  // Requesters view state
  const [requesterSearch, setRequesterSearch] = React.useState('');
  const [requesterShowDeleted, setRequesterShowDeleted] = React.useState(false);

  // Requests view state
  const [statusFilter, setStatusFilter] = React.useState('');
  const [urgencyFilter, setUrgencyFilter] = React.useState('');

  // Institutions view state
  const [institutionSearch, setInstitutionSearch] = React.useState('');
  const [institutionStatusFilter, setInstitutionStatusFilter] = React.useState('');

  // Audit view state
  const [actionFilter, setActionFilter] = React.useState('');

  // Detail drawers
  const [donorDetail, setDonorDetail] = React.useState<User | null>(null);
  const [requesterDetail, setRequesterDetail] = React.useState<Requester | null>(null);

  // SOS broadcast state
  const [sosCity, setSosCity] = React.useState('');
  const [sosBloodType, setSosBloodType] = React.useState('');
  const [sosMessage, setSosMessage] = React.useState('');
  const [sosSending, setSosSending] = React.useState(false);
  const [sosStatus, setSosStatus] = React.useState<string | null>(null);

  const loadDashboard = React.useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const data = await authenticatedApi<DashboardResponse>('/api/admin/dashboard', undefined, 'GET');
      setUsers(data.users || []);
      setRequests(data.blood_requests || []);
      setMatches(data.matches || []);
      setNotifications(data.notifications || []);
      setDonationLogs(data.donation_log || []);
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  const loadTelemetry = React.useCallback(async () => {
    try {
      const data = await authenticatedApi<{ telemetry: any }>('/api/admin/telemetry', undefined, 'GET');
      setTelemetry(data.telemetry);
    } catch { /* non-critical */ }
  }, []);

  const loadInstitutions = React.useCallback(async () => {
    setLoadingInstitutions(true);
    try {
      const q = institutionStatusFilter ? `?status=${encodeURIComponent(institutionStatusFilter)}` : '';
      const data = await authenticatedApi<{ institutions: any[] }>(`/api/admin/institutions${q}`, undefined, 'GET');
      setInstitutions(data.institutions || []);
    } catch { /* silent */ } finally {
      setLoadingInstitutions(false);
    }
  }, [institutionStatusFilter]);

  const loadRequesters = React.useCallback(async () => {
    setLoadingRequesters(true);
    try {
      const data = await authenticatedApi<{ requesters: Requester[] }>('/api/admin/requesters', undefined, 'GET');
      setRequesters(data.requesters || []);
    } catch { /* silent */ } finally {
      setLoadingRequesters(false);
    }
  }, []);

  const loadAudits = React.useCallback(async () => {
    setLoadingAudits(true);
    try {
      const q = actionFilter ? `?action=${encodeURIComponent(actionFilter)}` : '';
      const data = await authenticatedApi<{ audits: AuditEntry[] }>(`/api/admin/audit${q}`, undefined, 'GET');
      setAudits(data.audits || []);
    } catch { /* silent */ } finally {
      setLoadingAudits(false);
    }
  }, [actionFilter]);

  const loadFaqs = React.useCallback(async () => {
    setLoadingFaqs(true);
    try {
      const data = await authenticatedApi<{ faqs: FaqEntry[] }>('/api/admin/faqs', undefined, 'GET');
      setFaqs(data.faqs || []);
    } catch { /* silent */ } finally {
      setLoadingFaqs(false);
    }
  }, []);

  React.useEffect(() => {
    void loadDashboard();
    void loadTelemetry();
    void loadInstitutions();
    void loadRequesters();
    void loadAudits();
    void loadFaqs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAll = React.useCallback(() => {
    void loadDashboard();
    void loadTelemetry();
  }, [loadDashboard, loadTelemetry]);

  // ── Donor actions ──────────────────────────────────────────────────────────
  const forceCooldown = async (id: string) => {
    try {
      await authenticatedApi(`/api/admin/donors/${id}/log-donation`, {}, 'POST');
    } catch { /* silent */ } finally {
      void loadDashboard();
    }
  };
  const liftCooldown = async (id: string) => {
    try {
      await authenticatedApi(`/api/admin/donors/${id}`, { status: 'active' }, 'PATCH');
    } catch { /* silent */ } finally {
      void loadDashboard();
    }
  };
  const bulkApprove = async (ids: string[]) => {
    await Promise.all(ids.map(id => authenticatedApi(`/api/admin/donors/${id}/approve`, {}, 'PATCH').catch(() => {})));
    void loadDashboard();
  };
  const bulkCooldown = async (ids: string[]) => {
    await Promise.all(ids.map(id => authenticatedApi(`/api/admin/donors/${id}`, { status: 'cooldown' }, 'PATCH').catch(() => {})));
    void loadDashboard();
  };

  // ── Match override ─────────────────────────────────────────────────────────
  const overrideOutcome = async (matchId: string, outcome: 'donated' | 'cancelled') => {
    try {
      await authenticatedApi(
        '/api/admin/matches',
        { matchId, payload: { id: matchId, outcome } },
        'POST'
      );
    } catch { /* silent */ } finally {
      void loadDashboard();
    }
  };

  // ── Institution review + email ─────────────────────────────────────────────
  const handleInstitutionReview = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      await authenticatedApi(`/api/admin/institutions/${id}/review`, {
        action,
        rejection_reason: action === 'reject' ? reason : undefined,
      }, 'PATCH');
    } catch { /* silent */ } finally {
      void loadInstitutions();
    }
  };
  const handleUpdateEmail = async (id: string, email: string): Promise<boolean> => {
    try {
      await authenticatedApi(`/api/admin/institutions/${id}/email`, { email }, 'PATCH');
      return true;
    } catch {
      return false;
    }
  };

  // ── SOS broadcast ──────────────────────────────────────────────────────────
  const handleSendSos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sosMessage.trim() || sosSending) return;
    setSosSending(true);
    setSosStatus(null);
    try {
      const data = await authenticatedApi<{ recipients_count: number }>(
        '/api/admin/broadcast-sos',
        { city: sosCity || undefined, blood_type: sosBloodType || undefined, message_body: sosMessage },
        'POST'
      );
      setSosStatus(
        isHi
          ? `प्रसारण भेजा गया — ${data.recipients_count ?? 0} प्राप्तकर्ता`
          : `Broadcast sent — ${data.recipients_count ?? 0} recipients`
      );
      setSosMessage('');
    } catch (err: any) {
      setSosStatus(isHi ? `भेजा नहीं जा सका: ${err.message}` : `Failed: ${err?.message || 'unknown'}`);
    } finally {
      setSosSending(false);
      void loadDashboard();
    }
  };

  // ── Engine sweep ───────────────────────────────────────────────────────────
  const handleSweep = async () => {
    try {
      await authenticatedApi('/api/admin/engine/sweep', {}, 'POST');
      void loadDashboard();
    } catch { /* silent */ }
  };

  // ── FAQ ────────────────────────────────────────────────────────────────────
  const handleSaveFaq = async (faq: Omit<FaqEntry, 'id' | 'created_at'> & { id?: string }): Promise<boolean> => {
    try {
      if (faq.id) {
        await authenticatedApi(`/api/admin/faqs/${faq.id}`, {
          title_en: faq.title_en, title_hi: faq.title_hi, body_en: faq.body_en, body_hi: faq.body_hi, active: faq.active,
        }, 'PATCH');
      } else {
        await authenticatedApi('/api/admin/faqs', {
          title_en: faq.title_en, title_hi: faq.title_hi, body_en: faq.body_en, body_hi: faq.body_hi, active: faq.active,
        }, 'POST');
      }
      void loadFaqs();
      return true;
    } catch {
      return false;
    }
  };
  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await authenticatedApi(`/api/admin/faqs/${id}`, { active }, 'PATCH');
      void loadFaqs();
    } catch { /* silent */ }
  };

  // ── Restore requester (soft-delete reversal) ───────────────────────────────
  const handleRestoreRequester = async (id: string) => {
    // No live PATCH restore endpoint on routes/admin.ts; log the intent and reload.
    void loadRequesters();
    void loadDashboard();
    void id;
  };

  // ── CSV exports ────────────────────────────────────────────────────────────
  const exportAll = () => {
    const stamp = new Date().toISOString().split('T')[0];
    downloadCSV(`admin_export_${stamp}.csv`,
      ['Type', 'ID', 'Name', 'Email', 'Phone', 'Blood', 'City', 'Status', 'Created'],
      [
        ...users.map(u => ['donor', u.id, u.full_name, u.email, u.phone, u.blood_type, u.city, u.account_status, u.created_at]),
        ...requesters.map(r => ['requester', r.id, r.full_name, r.email, r.phone, '', '', r.account_status, r.created_at]),
      ]);
  };
  const exportOverviewCSV = exportAll;

  // ── Derived data for views ─────────────────────────────────────────────────
  const visibleDonors = showDeleted ? users : users.filter(u => u.account_status !== 'deleted');

  const badges: Partial<Record<AdminTab, number>> = {
    institutions: institutions.filter(i => i.verification_status === 'pending').length,
    requests: requests.filter(r => REQUEST_LIVE.includes(r.status)).length,
  };

  let view: React.ReactNode;
  switch (activeTab) {
    case 'overview':
      view = (
        <Overview
          donors={visibleDonors}
          requests={requests}
          matches={matches}
          notifications={notifications}
          donationLogs={donationLogs}
          institutions={institutions}
          requesters={requesters}
          telemetry={telemetry}
          isHi={isHi}
          onExportCSV={exportOverviewCSV}
        />
      );
      break;
    case 'donors':
      view = (
        <Donors
          donors={visibleDonors}
          allDonors={users}
          loading={loadingDashboard}
          showDeleted={showDeleted}
          bloodFilter={bloodFilter}
          search={globalSearch || donorSearch}
          isHi={isHi}
          onToggleDeleted={setShowDeleted}
          onBloodFilterChange={setBloodFilter}
          onSearchChange={(v) => setDonorSearch(v)}
          onOpenDetail={(d) => setDonorDetail(d)}
          onForceCooldown={(id) => void forceCooldown(id)}
          onLiftCooldown={(id) => void liftCooldown(id)}
          onBulkApprove={(ids) => void bulkApprove(ids)}
          onBulkCooldown={(ids) => void bulkCooldown(ids)}
          onRefresh={refreshAll}
        />
      );
      break;
    case 'requesters':
      view = (
        <Requesters
          requesters={requesters}
          loading={loadingRequesters}
          showDeleted={requesterShowDeleted}
          search={globalSearch || requesterSearch}
          isHi={isHi}
          onToggleDeleted={setRequesterShowDeleted}
          onSearchChange={(v) => setRequesterSearch(v)}
          onOpenDetail={(r) => setRequesterDetail(r)}
          onRestore={(id) => void handleRestoreRequester(id)}
        />
      );
      break;
    case 'users':
      view = (
        <Users
          donors={visibleDonors}
          requesters={requesters}
          loading={loadingDashboard || loadingRequesters}
          search={globalSearch}
          isHi={isHi}
          onSearchChange={setGlobalSearch}
        />
      );
      break;
    case 'requests':
      view = (
        <Requests
          requests={requests}
          matches={matches}
          statusFilter={statusFilter}
          urgencyFilter={urgencyFilter}
          search={globalSearch}
          isHi={isHi}
          onStatusFilterChange={setStatusFilter}
          onUrgencyFilterChange={setUrgencyFilter}
          onSearchChange={setGlobalSearch}
          onRefresh={loadDashboard}
        />
      );
      break;
    case 'matches':
      view = (
        <Matches
          matches={matches}
          isHi={isHi}
          onOverrideOutcome={(id, outcome) => void overrideOutcome(id, outcome)}
        />
      );
      break;
    case 'institutions':
      view = (
        <Institutions
          institutions={institutions}
          loading={loadingInstitutions}
          search={institutionSearch}
          statusFilter={institutionStatusFilter}
          isHi={isHi}
          onSearchChange={setInstitutionSearch}
          onStatusFilterChange={setInstitutionStatusFilter}
          onOpenDetail={() => {}}
          onApprove={(id) => void handleInstitutionReview(id, 'approve')}
          onReject={(id, reason) => void handleInstitutionReview(id, 'reject', reason)}
          onUpdateEmail={handleUpdateEmail}
        />
      );
      break;
    case 'notifications':
      view = (
        <Notifications
          notifications={notifications}
          loading={loadingDashboard}
          onRetry={loadDashboard}
          isHi={isHi}
          sosCity={sosCity}
          sosBloodType={sosBloodType}
          sosMessage={sosMessage}
          sosSending={sosSending}
          sosStatus={sosStatus}
          onSosCityChange={setSosCity}
          onSosBloodTypeChange={setSosBloodType}
          onSosMessageChange={setSosMessage}
          onSendSos={(e) => void handleSendSos(e)}
        />
      );
      break;
    case 'audit':
      view = (
        <AuditLog
          audits={audits}
          loading={loadingAudits}
          actionFilter={actionFilter}
          isHi={isHi}
          onActionFilterChange={setActionFilter}
        />
      );
      break;
    case 'faq':
      view = (
        <Faq
          faqs={faqs}
          loading={loadingFaqs}
          isHi={isHi}
          onSaveFaq={handleSaveFaq}
          onToggleActive={(id, active) => void handleToggleActive(id, active)}
        />
      );
      break;
    case 'roles':
      view = <Roles isHi={isHi} />;
      break;
    case 'settings':
      view = (
        <Settings
          isHi={isHi}
          telemetry={telemetry}
          onRefresh={refreshAll}
          onExportAll={exportAll}
          donorsCount={users.length}
          requestsCount={requests.length}
          matchesCount={matches.length}
          notificationsCount={notifications.length}
        />
      );
      break;
    default:
      view = null;
  }

  return (
    <AdminShell
      activeTab={activeTab}
      badges={badges}
      telemetry={telemetry}
      onTabChange={setActiveTab}
      onLoadRequesters={() => void loadRequesters()}
      onLoadInstitutions={() => void loadInstitutions()}
      onSweep={() => void handleSweep()}
      onLogout={onLogout}
      adminEmail={adminEmail}
      globalSearch={globalSearch}
      onGlobalSearchChange={setGlobalSearch}
    >
      {view}

      {/* Donor detail drawer */}
      <EntityDrawer
        open={!!donorDetail}
        onClose={() => setDonorDetail(null)}
        title={donorDetail?.full_name || ''}
        subtitle={donorDetail?.email || donorDetail?.phone}
        badge={donorDetail && <StatusPill status={donorDetail.account_status || 'active'} isHi={isHi} />}
        rows={donorDetail ? [
          { label: isHi ? 'रक्त' : 'Blood', value: donorDetail.blood_type || '—' },
          { label: isHi ? 'फोन' : 'Phone', value: donorDetail.phone || '—' },
          { label: isHi ? 'व्हाट्सएप' : 'WhatsApp', value: donorDetail.whatsapp_number || '—' },
          { label: isHi ? 'पिनकोड' : 'Pincode', value: donorDetail.pincode || '—' },
          { label: isHi ? 'शहर' : 'City', value: donorDetail.city || '—' },
          { label: isHi ? 'क्षेत्र' : 'Area', value: donorDetail.area || '—' },
          { label: isHi ? 'अंतिम दान' : 'Last Donation', value: donorDetail.last_donation_date || '—' },
          { label: isHi ? 'कूलडाउन तक' : 'Cooldown Until', value: donorDetail.cooldown_until || '—' },
          { label: isHi ? 'पंजीकृत' : 'Created', value: donorDetail.created_at ? new Date(donorDetail.created_at).toLocaleString() : '—' },
        ] : []}
        isHi={isHi}
      />

      {/* Requester detail drawer */}
      <EntityDrawer
        open={!!requesterDetail}
        onClose={() => setRequesterDetail(null)}
        title={requesterDetail?.full_name || ''}
        subtitle={requesterDetail?.email || requesterDetail?.phone}
        badge={requesterDetail && <StatusPill status={requesterDetail.account_status || 'active'} isHi={isHi} />}
        rows={requesterDetail ? [
          { label: 'Email', value: requesterDetail.email || '—' },
          { label: isHi ? 'फोन' : 'Phone', value: requesterDetail.phone || '—' },
          { label: isHi ? 'पंजीकृत' : 'Registered', value: requesterDetail.created_at ? new Date(requesterDetail.created_at).toLocaleString() : '—' },
        ] : []}
        isHi={isHi}
      />
    </AdminShell>
  );
}
