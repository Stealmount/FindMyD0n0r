import React, { useState } from 'react';
import { Users, Search, Download, Ban, RotateCcw, ShieldCheck, Clock4, AlertTriangle } from 'lucide-react';
import { User } from '../../../types';
import { StatusPill, EmptyState, EntityDrawer, downloadCSV, Badge, ConfirmModal } from '../widgets/Shared';
import { authenticatedApi } from '../../../lib/api';

interface DonorsProps {
  donors: User[];
  allDonors: User[];
  loading: boolean;
  showDeleted: boolean;
  bloodFilter: string;
  search: string;
  isHi: boolean;
  onToggleDeleted: (v: boolean) => void;
  onBloodFilterChange: (v: string) => void;
  onSearchChange: (v: string) => void;
  onOpenDetail: (d: User) => void;
  onForceCooldown: (id: string) => void;
  onLiftCooldown: (id: string) => void;
  onBulkApprove: (ids: string[]) => void;
  onBulkCooldown: (ids: string[]) => void;
  onRefresh: () => void;
}

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function Donors({
  donors, allDonors, loading, showDeleted, bloodFilter, search, isHi,
  onToggleDeleted, onBloodFilterChange, onSearchChange, onOpenDetail,
  onForceCooldown, onLiftCooldown, onBulkApprove, onBulkCooldown, onRefresh,
}: DonorsProps) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [sort, setSort] = React.useState<'name' | 'date' | 'blood'>('date');
  const [banTarget, setBanTarget] = useState<User | null>(null);
  const [unbanTarget, setUnbanTarget] = useState<User | null>(null);
  const [banLoading, setBanLoading] = useState(false);

  const filtered = React.useMemo(() => {
    let list = donors;
    if (bloodFilter) list = list.filter(d => d.blood_type === bloodFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d => [d.full_name, d.phone, d.pincode, d.city, d.email, d.blood_type].some(v => (v || '').toLowerCase().includes(q)));
    }
    const sorted = [...list].sort((a, b) => {
      if (sort === 'name') return (a.full_name || '').localeCompare(b.full_name || '');
      if (sort === 'blood') return (a.blood_type || '').localeCompare(b.blood_type || '');
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
    return sorted;
  }, [donors, bloodFilter, search, sort]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(d => d.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleBan = async () => {
    if (!banTarget) return;
    setBanLoading(true);
    try {
      await authenticatedApi(`/api/admin/donors/${banTarget.id}/ban`, { banReason: 'Admin ban from panel' }, 'PATCH');
      setBanTarget(null);
      onRefresh();
    } catch {
      setBanTarget(null);
    } finally {
      setBanLoading(false);
    }
  };

  const handleUnban = async () => {
    if (!unbanTarget) return;
    setBanLoading(true);
    try {
      await authenticatedApi(`/api/admin/donors/${unbanTarget.id}/approve`, {}, 'PATCH');
      setUnbanTarget(null);
      onRefresh();
    } catch {
      setUnbanTarget(null);
    } finally {
      setBanLoading(false);
    }
  };

  const exportCsv = () => {
    downloadCSV(`donors_${new Date().toISOString().split('T')[0]}.csv`,
      ['ID', 'Name', 'Phone', 'Blood', 'Pincode', 'City', 'Status', 'Last Donation', 'Last Active'],
      filtered.map(d => [d.id, d.full_name, d.phone, d.blood_type, d.pincode, d.city, d.account_status, d.last_donation_date || 'N/A', d.updated_at || 'N/A']));
  };

  return (
    <div className="space-y-4">
 <div className="border border-ink-800 bg-ink-900 p-4 flex flex-wrap items-center gap-3">
 <div className="relative">
 <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
 <input value={search} onChange={e => onSearchChange(e.target.value)}
 placeholder={isHi ? 'नाम, ईमेल, रक्त खोजें...' : 'Search name, email, blood group'}
 className="bg-ink-950 border border-ink-700 pl-9 pr-3 py-2 text-xs text-white placeholder:text-ink-500 focus:outline-none focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500 w-64" />
 </div>
 <select value={sort} onChange={e => setSort(e.target.value as any)} aria-label="sort"
 className="bg-ink-950 border border-ink-700 px-3 py-2 text-xs text-white cursor-pointer focus:outline-none focus:border-blood-500">
          <option value="date">{isHi ? 'नवीनतम' : 'Newest'}</option>
          <option value="name">{isHi ? 'नाम' : 'Name'}</option>
          <option value="blood">{isHi ? 'रक्त समूह' : 'Blood group'}</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-ink-300 cursor-pointer ml-1">
          <input type="checkbox" checked={showDeleted} onChange={e => onToggleDeleted(e.target.checked)}
            className="accent-blood-600 cursor-pointer" />
          {isHi ? 'हटाए गए दिखाएं' : 'Show deleted'}
        </label>
        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <span className="text-[11px] text-ink-300">{selected.size} {isHi ? 'चयनित' : 'selected'}</span>
              <button onClick={() => onBulkApprove([...selected])}
                className="px-3 py-1.5 bg-vital-500/10 border border-vital-500/30 text-vital-400 text-xs font-semibold hover:bg-vital-500/20 transition cursor-pointer">
                {isHi ? 'सक्रिय करें' : 'Approve'}
              </button>
              <button onClick={() => onBulkCooldown([...selected])}
                className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition cursor-pointer">
                {isHi ? 'कूलडाउन' : 'Cooldown'}
              </button>
            </>
          )}
 <button onClick={exportCsv}
 className="px-3 py-1.5 border border-white/20 hover:border-white hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onBloodFilterChange('')}
 className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer border ${
 !bloodFilter ? 'bg-blood-600 text-white border-blood-600' : 'text-ink-400 border-ink-700 hover:text-white hover:border-ink-500'
 }`}
 >
 {isHi ? 'सभी' : 'All'}
 </button>
 {BLOOD.map(b => (
 <button
 key={b}
 onClick={() => onBloodFilterChange(bloodFilter === b ? '' : b)}
 className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer border ${
 bloodFilter === b ? 'bg-blood-600 text-white border-blood-600' : 'text-ink-400 border-ink-700 hover:text-white hover:border-ink-500'
 }`}
 >
            {b}
          </button>
        ))}
      </div>

 <div className="border border-ink-800 bg-ink-900 overflow-hidden">
 {loading ? (
 <div className="p-16 flex items-center justify-center">
 <span className="w-6 h-6 animate-spin rounded-full border-2 border-current/30 border-t-current text-blood-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState title={isHi ? 'कोई दाता नहीं मिला' : 'No donors found'} hint={isHi ? 'फिल्टर बदलें' : 'Try adjusting filters'} isHi={isHi} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-800">
                  <th className="px-4 py-3"><input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={toggleAll} className="accent-blood-600 cursor-pointer" aria-label="select all" /></th>
                  <th className="px-4 py-3">{isHi ? 'दाता' : 'Donor'}</th>
                  <th className="px-4 py-3">{isHi ? 'रक्त' : 'Blood'}</th>
                  <th className="px-4 py-3">{isHi ? 'शहर' : 'City'}</th>
                  <th className="px-4 py-3">{isHi ? 'स्थिति' : 'Status'}</th>
                  <th className="px-4 py-3">{isHi ? 'अंतिम दान' : 'Last Donation'}</th>
                  <th className="px-4 py-3">{isHi ? 'अंतिम सक्रिय' : 'Last Active'}</th>
                  <th className="px-4 py-3 text-right">{isHi ? 'कार्रवाई' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800/60">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => onOpenDetail(d)}>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleOne(d.id)} className="accent-blood-600 cursor-pointer" aria-label="select row" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blood-600/15 border border-blood-500/20 flex items-center justify-center text-blood-400 text-xs font-bold shrink-0">
                          {(d.full_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-white">{d.full_name || '—'}</div>
                          <div className="text-[11px] text-ink-500">{d.email || d.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge tone="blood">{d.blood_type || '—'}</Badge></td>
                    <td className="px-4 py-3 text-ink-300 text-xs">{d.city || '—'}</td>
                    <td className="px-4 py-3"><StatusPill status={d.account_status || 'pending'} isHi={isHi} /></td>
                    <td className="px-4 py-3 text-ink-400 text-xs">{d.last_donation_date || '—'}</td>
                    <td className="px-4 py-3 text-ink-400 text-xs font-mono">{d.updated_at ? new Date(d.updated_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {d.account_status === 'banned' ? (
                          <button title={isHi ? 'अनबैन' : 'Unban'}
                            onClick={() => setUnbanTarget(d)}
                            className="p-1.5 text-ink-400 hover:text-vital-300 hover:bg-white/5 transition cursor-pointer">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button title={isHi ? 'बैन' : 'Ban'}
                            onClick={() => setBanTarget(d)}
                            className="p-1.5 text-ink-400 hover:text-blood-400 hover:bg-white/5 transition cursor-pointer">
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        <button title={isHi ? 'कूलडाउन' : 'Cooldown'} onClick={() => onForceCooldown(d.id)}
                          className="p-1.5 text-ink-400 hover:text-amber-300 hover:bg-white/5 transition cursor-pointer"><Clock4 className="w-4 h-4" /></button>
                        <button title={isHi ? 'सक्रिय करें' : 'Reactivate'} onClick={() => onLiftCooldown(d.id)}
                          className="p-1.5 text-ink-400 hover:text-vital-300 hover:bg-white/5 transition cursor-pointer"><ShieldCheck className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="text-[11px] text-ink-500 pl-1">{filtered.length} / {allDonors.length} {isHi ? 'दाता' : 'donors'}</div>

      <ConfirmModal
        open={!!banTarget}
        title={isHi ? 'दाता को बैन करें?' : 'Ban this donor?'}
        body={isHi ? `क्या आप ${banTarget?.full_name || ''} को बैन करना चाहते हैं? यह कार्रवाई पूर्ववत की जा सकती है।` : `Ban ${banTarget?.full_name || ''}? This can be reversed later.`}
        confirmLabel={isHi ? 'बैन करें' : 'Ban Donor'}
        busy={banLoading}
        isHi={isHi}
        onConfirm={handleBan}
        onClose={() => setBanTarget(null)}
      />

      <ConfirmModal
        open={!!unbanTarget}
        title={isHi ? 'बैन हटाएं?' : 'Unban this donor?'}
        body={isHi ? `क्या आप ${unbanTarget?.full_name || ''} का बैन हटाना चाहते हैं?` : `Unban ${unbanTarget?.full_name || ''} and restore active status?`}
        confirmLabel={isHi ? 'अनबैन' : 'Unban Donor'}
        busy={banLoading}
        isHi={isHi}
        onConfirm={handleUnban}
        onClose={() => setUnbanTarget(null)}
      />
    </div>
  );
}
