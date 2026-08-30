import React from 'react';
import { Search, Building2, CheckCircle2, X, Pencil } from 'lucide-react';
import { Institution } from '../../../types';
import { StatusPill, EmptyState, EntityDrawer, Badge } from '../widgets/Shared';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

interface InstitutionsProps {
  institutions: any[];
  loading: boolean;
  search: string;
  statusFilter: string;
  isHi: boolean;
  onSearchChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
  onOpenDetail: (inst: any) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onUpdateEmail?: (id: string, email: string) => Promise<boolean>;
}

const STATUS_OPTS = ['pending', 'verified', 'rejected'];

export default function Institutions({
  institutions, loading, search, statusFilter, isHi,
  onSearchChange, onStatusFilterChange, onOpenDetail, onApprove, onReject, onUpdateEmail,
}: InstitutionsProps) {
  const [detail, setDetail] = React.useState<any | null>(null);
  const [rejecting, setRejecting] = React.useState<any | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const rejectTrapRef = useFocusTrap<HTMLDivElement>(!!rejecting);

  // ── Institution email correction (§5 item 8 / §6.10) ──
  const [editingEmail, setEditingEmail] = React.useState<any | null>(null);
  const [emailValue, setEmailValue] = React.useState('');
  const [emailSaving, setEmailSaving] = React.useState(false);
  const [emailStatus, setEmailStatus] = React.useState<'' | 'ok' | 'err'>('');
  const emailTrapRef = useFocusTrap<HTMLDivElement>(!!editingEmail);

 const filtered = React.useMemo(() => {
 let list = institutions;
 if (statusFilter) list = list.filter(i => i.verification_status === statusFilter);
 if (search) {
 const q = search.toLowerCase();
 list = list.filter(i => [i.org_name, i.city, i.type, i.contact_person, i.phone].some(v => (v || '').toLowerCase().includes(q)));
 }
 return [...list].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
 }, [institutions, statusFilter, search]);

 const pendingCount = institutions.filter(i => i.verification_status === 'pending').length;

 return (
 <div className="space-y-4">
 <div className="border border-ink-800 bg-ink-900 p-4 flex flex-wrap items-center gap-3">
 <div className="relative">
 <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
 <input value={search} onChange={e => onSearchChange(e.target.value)}
 placeholder={isHi ? 'संस्थान खोजें...' : 'Search organization...'}
 className="bg-ink-950 border border-ink-700 pl-9 pr-3 py-2 text-xs text-white placeholder:text-ink-500 focus:outline-none focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500 w-56" />
 </div>
 <select value={statusFilter} onChange={e => onStatusFilterChange(e.target.value)} aria-label="status filter"
 className="bg-ink-950 border border-ink-700 px-3 py-2 text-xs text-white cursor-pointer focus:outline-none focus:border-blood-500">
 <option value="">{isHi ? 'सभी स्थितियां' : 'All statuses'}</option>
 {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
 </select>
 {pendingCount> 0 && (
 <span className="ml-auto border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-400">
 {pendingCount} {isHi ? 'लंबित समीक्षा' : 'pending reviews'}
 </span>
 )}
 </div>

 <div className="border border-ink-800 bg-ink-900 overflow-hidden">
 {loading ? (
 <div className="p-16 flex items-center justify-center">
 <span className="w-6 h-6 animate-spin rounded-full border-2 border-current/30 border-t-current text-blood-500" />
 </div>
 ) : filtered.length === 0 ? (
 <div className="p-8">
 <EmptyState title={isHi ? 'कोई संस्थान नहीं' : 'No institutions found'} hint={isHi ? 'फिल्टर बदलें' : 'Try adjusting filters'} isHi={isHi} />
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-ink-500 border-b border-ink-800">
 <th className="px-4 py-3">{isHi ? 'संगठन' : 'Organization'}</th>
 <th className="px-4 py-3">{isHi ? 'प्रकार' : 'Type'}</th>
 <th className="px-4 py-3">{isHi ? 'शहर' : 'City'}</th>
 <th className="px-4 py-3">{isHi ? 'संपर्क' : 'Contact'}</th>
 <th className="px-4 py-3">{isHi ? 'स्थिति' : 'Status'}</th>
 <th className="px-4 py-3 text-right">{isHi ? 'समीक्षा' : 'Review'}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-ink-800/60">
 {filtered.map(i => (
 <tr key={i.id} className="hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => setDetail(i)}>
 <td className="px-4 py-3">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-blood-600/15 border border-blood-500/20 flex items-center justify-center text-blood-400 text-xs font-bold shrink-0">
 <Building2 className="w-4 h-4" />
 </div>
 <div>
 <div className="font-semibold text-white">{i.org_name}</div>
 <div className="text-[11px] text-ink-500">{i.registration_number}</div>
 </div>
 </div>
 </td>
 <td className="px-4 py-3"><Badge tone="ink">{i.type}</Badge></td>
 <td className="px-4 py-3 text-ink-300 text-xs">{i.city}</td>
 <td className="px-4 py-3 text-ink-300 text-xs">{i.contact_person}<div className="text-[11px] text-ink-500">{i.phone}</div></td>
 <td className="px-4 py-3"><StatusPill status={i.verification_status} isHi={isHi} /></td>
  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
  <div className="flex justify-end gap-1.5 items-center">
  {onUpdateEmail && (
  <button onClick={() => { setEditingEmail(i); setEmailValue(i.email || ''); setEmailStatus(''); }}
  title={isHi ? 'ईमेल संपादित करें' : 'Edit email'}
  className="px-2.5 py-1.5 text-[11px] font-semibold text-ink-400 border border-ink-700 bg-transparent hover:border-blood-500/40 hover:text-blood-400 transition-colors cursor-pointer inline-flex items-center gap-1">
  <Pencil className="w-3 h-3" /> {isHi ? 'ईमेल' : 'Email'}
  </button>
  )}
  {i.verification_status === 'pending' && (
  <div className="flex justify-end gap-1.5">
  <button onClick={() => setRejecting(i)} title={isHi ? 'अस्वीकार' : 'Reject'}
  className="px-2.5 py-1.5 text-[11px] font-semibold text-blood-400 border border-blood-500/40 bg-transparent hover:bg-blood-500/10 transition-colors cursor-pointer">
  {isHi ? 'अस्वीकार' : 'Reject'}
  </button>
  <button onClick={() => onApprove(i.id)} title={isHi ? 'स्वीकृत' : 'Approve'}
  className="px-2.5 py-1.5 text-[11px] font-semibold text-vital-400 border border-vital-500/30 bg-transparent hover:bg-vital-500/10 transition-colors cursor-pointer flex items-center gap-1">
  <CheckCircle2 className="w-3 h-3" /> {isHi ? 'स्वीकृत' : 'Approve'}
  </button>
  </div>
  )}
  </div>
  </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 <EntityDrawer
 open={!!detail}
 onClose={() => setDetail(null)}
 title={detail?.org_name || ''}
 subtitle={detail?.type}
 badge={detail && <StatusPill status={detail.verification_status} isHi={isHi} />}
 rows={detail ? [
 { label: isHi ? 'पंजीकरण संख्या' : 'Registration No', value: detail.registration_number },
 { label: isHi ? 'संपर्क व्यक्ति' : 'Contact Person', value: detail.contact_person },
 { label: 'Email', value: detail.email },
 { label: 'Phone', value: detail.phone },
 { label: isHi ? 'पता' : 'Address', value: `${detail.address || ''} ${detail.city}, ${detail.pincode}`.trim() },
 { label: isHi ? 'समीक्षक' : 'Reviewed By', value: detail.reviewed_by || '—' },
 { label: isHi ? 'समीक्षा समय' : 'Reviewed At', value: detail.reviewed_at ? new Date(detail.reviewed_at).toLocaleString() : '—' },
 { label: isHi ? 'अस्वीकृति कारण' : 'Reject Reason', value: detail.rejection_reason || '—' },
 { label: isHi ? 'पंजीकृत' : 'Registered', value: new Date(detail.created_at).toLocaleString() },
 ] : []}
 isHi={isHi}
 />

 {/* Reject modal */}
 {rejecting && (
 <div
 ref={rejectTrapRef}
 role="dialog"
 aria-modal="true"
 aria-label={isHi ? 'संस्थान अस्वीकार करें' : 'Reject Institution'}
 className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-ink-950/70"
>
 <div className="relative z-[90] w-full max-w-md border border-ink-800 bg-ink-950 p-6">
 <h3 className="text-[15px] font-bold text-white">{isHi ? 'संस्थान अस्वीकार करें' : 'Reject Institution'}</h3>
 <p className="text-[12px] text-ink-400 mt-1.5">{rejecting.org_name}</p>
 <textarea
 value={rejectReason}
 onChange={e => setRejectReason(e.target.value)}
 placeholder={isHi ? 'अस्वीकृति का कारण (आवश्यक)...' : 'Rejection reason (required)...'}
 className="mt-4 w-full bg-ink-900 border border-ink-700 px-3 py-2 text-xs text-white placeholder:text-ink-500 focus:outline-none focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500 min-h-[90px] resize-none"
 />
 <div className="mt-5 flex justify-end gap-2">
 <button onClick={() => { setRejecting(null); setRejectReason(''); }}
 className="px-4 py-2 border border-white/20 text-white text-xs font-semibold hover:border-white hover:bg-white/10 transition-colors cursor-pointer">
 {isHi ? 'रद्द करें' : 'Cancel'}
 </button>
 <button onClick={() => { onReject(rejecting.id, rejectReason); setRejecting(null); setRejectReason(''); }}
 disabled={!rejectReason.trim()}
 className="px-4 py-2 bg-blood-600 hover:bg-blood-700 active:bg-blood-800 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600">
 {isHi ? 'अस्वीकार करें' : 'Confirm Reject'}
 </button>
 </div>
  </div>
  </div>
  )}

  {/* Email correction modal (§5 item 8 — fix a typo'd institution email) */}
  {editingEmail && (
  <div
  ref={emailTrapRef}
  role="dialog"
  aria-modal="true"
  aria-label={isHi ? 'संस्थान ईमेल संपादित करें' : 'Edit Institution Email'}
  className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-ink-950/70"
 >
  <div className="relative z-[90] w-full max-w-md border border-ink-800 bg-ink-950 p-6">
  <h3 className="text-[15px] font-bold text-white">{isHi ? 'संस्थान ईमेल संपादित करें' : 'Edit Institution Email'}</h3>
  <p className="text-[12px] text-ink-400 mt-1.5">{editingEmail.org_name}</p>
  <input
  type="email"
  value={emailValue}
  onChange={e => { setEmailValue(e.target.value); setEmailStatus(''); }}
  placeholder="admin@org.in"
  className="mt-4 w-full bg-ink-900 border border-ink-700 px-3 py-2 text-xs text-white placeholder:text-ink-500 focus:outline-none focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500"
  />
  {emailStatus === 'ok' && (
  <p className="mt-2 text-[11px] text-vital-400">{isHi ? 'ईमेल अपडेट हो गया।' : 'Email updated.'}</p>
  )}
  {emailStatus === 'err' && (
  <p className="mt-2 text-[11px] text-blood-400">{isHi ? 'ईमेल अपडेट विफल।' : 'Failed to update email.'}</p>
  )}
  <div className="mt-5 flex justify-end gap-2">
  <button onClick={() => { setEditingEmail(null); setEmailStatus(''); }}
  className="px-4 py-2 border border-white/20 text-white text-xs font-semibold hover:border-white hover:bg-white/10 transition-colors cursor-pointer">
  {isHi ? 'रद्द करें' : 'Cancel'}
  </button>
  <button
  onClick={async () => {
  if (!emailValue.trim() || emailSaving) return;
  setEmailSaving(true);
  try {
  const ok = onUpdateEmail ? await onUpdateEmail(editingEmail.id, emailValue.trim()) : false;
  if (ok) {
  if (detail?.id === editingEmail.id) setDetail({ ...detail, email: emailValue.trim() });
  setEmailStatus('ok');
  setTimeout(() => { setEditingEmail(null); setEmailStatus(''); }, 800);
  } else {
  setEmailStatus('err');
  }
  } catch {
  setEmailStatus('err');
  } finally {
  setEmailSaving(false);
  }
  }}
  disabled={!emailValue.trim() || emailSaving}
  className="px-4 py-2 bg-blood-600 hover:bg-blood-700 active:bg-blood-800 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600">
  {emailSaving ? (isHi ? 'सहेज रहे...' : 'Saving...') : (isHi ? 'सहेजें' : 'Save')}
  </button>
  </div>
  </div>
  </div>
  )}
  </div>
  );
}
