import React, { useState } from 'react';
import { Search, Download } from 'lucide-react';
import { BloodRequest, Match } from '../../../types';
import { StatusPill, EmptyState, EntityDrawer, downloadCSV, Badge } from '../widgets/Shared';
import { authenticatedApi } from '../../../lib/api';

interface RequestsProps {
  requests: BloodRequest[];
  matches: Match[];
  statusFilter: string;
  urgencyFilter: string;
  search: string;
  isHi: boolean;
  onStatusFilterChange: (v: string) => void;
  onUrgencyFilterChange: (v: string) => void;
  onSearchChange: (v: string) => void;
  onRefresh: () => void;
}

const STATUS_PILLS = [
  { value: '', label: 'All', hi: 'सभी' },
  { value: 'active', label: 'Active', hi: 'सक्रिय', statuses: ['open', 'broadcasting', 'matching', 'partially_matched'] },
  { value: 'fulfilled', label: 'Fulfilled', hi: 'पूर्ण', statuses: ['fulfilled'] },
  { value: 'cancelled', label: 'Cancelled', hi: 'रद्द', statuses: ['cancelled'] },
  { value: 'expired', label: 'Expired', hi: 'समाप्त', statuses: ['expired'] },
];

const URGENCY_OPTS = ['critical', 'urgent', 'planned'];

const QUICK_STATUSES = ['open', 'fulfilled', 'cancelled'] as const;

export default function Requests({ requests, matches, statusFilter, urgencyFilter, search, isHi,
  onStatusFilterChange, onUrgencyFilterChange, onSearchChange, onRefresh }: RequestsProps) {
  const [selected, setSelected] = useState<BloodRequest | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const filtered = React.useMemo(() => {
    let list = requests;
    if (statusFilter) {
      const pill = STATUS_PILLS.find(p => p.value === statusFilter);
      if (pill && pill.statuses) {
        list = list.filter(r => pill.statuses!.includes(r.status));
      }
    }
    if (urgencyFilter) list = list.filter(r => r.urgency_level === urgencyFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => [r.tracking_code, r.patient_name, r.hospital_name, r.blood_type_needed, r.hospital_city, r.requester_name, r.requester_email]
        .some(v => (v || '').toLowerCase().includes(q)));
    }
    return [...list].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }, [requests, statusFilter, urgencyFilter, search]);

  const linkedFor = (rid: string) => matches.filter(m => m.request_id === rid);

  const handleStatusUpdate = async (requestId: string, newStatus: string) => {
    setStatusUpdating(true);
    try {
      await authenticatedApi(`/api/admin/requests/${requestId}`, { status: newStatus }, 'PATCH');
      onRefresh();
      if (selected && selected.id === requestId) {
        setSelected({ ...selected, status: newStatus as any });
      }
    } catch { /* silent */ } finally {
      setStatusUpdating(false);
    }
  };

  const exportCsv = () => {
    downloadCSV(`requests_${new Date().toISOString().split('T')[0]}.csv`,
      ['Tracking', 'Patient', 'Blood', 'Units', 'Hospital', 'City', 'Requester', 'Urgency', 'Status', 'Created'],
      filtered.map(r => [r.tracking_code, r.patient_name, r.blood_type_needed, r.units_required, r.hospital_name, r.hospital_city, r.requester_name, r.urgency_level, r.status, r.created_at]));
  };

  return (
    <div className="space-y-4">
 <div className="border border-ink-800 bg-ink-900 p-4 flex flex-wrap items-center gap-3">
 <div className="relative">
 <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
 <input value={search} onChange={e => onSearchChange(e.target.value)}
 placeholder={isHi ? 'ट्रैकिंग, मरीज, शहर, अनुरोधकर्ता...' : 'Search tracking, patient, city, requester'}
 className="bg-ink-950 border border-ink-700 pl-9 pr-3 py-2 text-xs text-white placeholder:text-ink-500 focus:outline-none focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500 w-64" />
 </div>
 <select value={urgencyFilter} onChange={e => onUrgencyFilterChange(e.target.value)} aria-label="urgency filter"
 className="bg-ink-950 border border-ink-700 px-3 py-2 text-xs text-white cursor-pointer focus:outline-none focus:border-blood-500">
 <option value="">{isHi ? 'सभी गंभीरता' : 'All urgency'}</option>
 {URGENCY_OPTS.map(u => <option key={u} value={u}>{u}</option>)}
 </select>
 <button onClick={exportCsv} className="ml-auto px-3 py-1.5 border border-white/20 hover:border-white hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_PILLS.map(pill => {
          let count = 0;
          if (pill.value === '') count = requests.length;
          else if (pill.statuses) count = requests.filter(r => pill.statuses!.includes(r.status)).length;
          return (
            <button
              key={pill.value}
              onClick={() => onStatusFilterChange(statusFilter === pill.value ? '' : pill.value)}
 className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer border flex items-center gap-1.5 ${
 statusFilter === pill.value ? 'bg-blood-600 text-white border-blood-600' : 'text-ink-400 border-ink-700 hover:text-white hover:border-ink-500'
 }`}
            >
              {isHi ? pill.hi : pill.label}
              <span className={`text-[10px] tabular-nums ${statusFilter === pill.value ? 'text-white/70' : 'text-ink-500'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="border border-ink-800 bg-ink-900 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState title={isHi ? 'कोई अनुरोध नहीं' : 'No requests found'} hint={isHi ? 'फिल्टर बदलें' : 'Try adjusting filters'} isHi={isHi} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-800">
                  <th className="px-4 py-3">{isHi ? 'ट्रैकिंग' : 'Tracking'}</th>
                  <th className="px-4 py-3">{isHi ? 'मरीज़' : 'Patient'}</th>
                  <th className="px-4 py-3">{isHi ? 'रक्त / यूनिट' : 'Blood / Units'}</th>
                  <th className="px-4 py-3">{isHi ? 'अस्पताल' : 'Hospital'}</th>
                  <th className="px-4 py-3">{isHi ? 'अनुरोधकर्ता' : 'Requester'}</th>
                  <th className="px-4 py-3">{isHi ? 'गंभीरता' : 'Urgency'}</th>
                  <th className="px-4 py-3">{isHi ? 'स्थिति' : 'Status'}</th>
                  <th className="px-4 py-3">{isHi ? 'मिलान' : 'Matches'}</th>
                  <th className="px-4 py-3">{isHi ? 'बनाया' : 'Created'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800/60">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => setSelected(r)}>
                    <td className="px-4 py-3 font-mono text-xs text-blood-300">{r.tracking_code || r.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{r.patient_name}</div>
                    </td>
                    <td className="px-4 py-3"><Badge tone="blood">{r.blood_type_needed}</Badge> <span className="text-[11px] text-ink-500 ml-1">{r.units_required}u</span></td>
                    <td className="px-4 py-3 text-ink-300 text-xs">{r.hospital_name}<div className="text-[11px] text-ink-500">{r.hospital_city}</div></td>
                    <td className="px-4 py-3 text-ink-300 text-xs">{r.requester_name}<div className="text-[11px] text-ink-500">{r.requester_phone}</div></td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${r.urgency_level === 'critical' ? 'text-blood-400' : r.urgency_level === 'urgent' ? 'text-amber-400' : 'text-ink-400'}`}>
                        {r.urgency_level}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusPill status={r.status} isHi={isHi} /></td>
                    <td className="px-4 py-3"><Badge tone="ink">{linkedFor(r.id).length}</Badge></td>
                    <td className="px-4 py-3 text-ink-400 text-xs font-mono">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EntityDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.tracking_code || ''}
        subtitle={selected?.patient_name}
        badge={selected && <StatusPill status={selected.status} isHi={isHi} />}
        rows={selected ? [
          { label: isHi ? 'मरीज़' : 'Patient', value: `${selected.patient_name} (${selected.patient_age ?? '—'}${selected.patient_gender ? ', ' + selected.patient_gender : ''})` },
          { label: isHi ? 'रक्त समूह' : 'Blood Group', value: `${selected.blood_type_needed} · ${selected.units_required} units` },
          { label: isHi ? 'अस्पताल' : 'Hospital', value: selected.hospital_name },
          { label: 'Location', value: `${selected.hospital_area}, ${selected.hospital_city} (${selected.hospital_pincode})` },
          { label: isHi ? 'गंभीरता' : 'Urgency', value: selected.urgency_level },
          { label: isHi ? 'अनुरोधकर्ता' : 'Requester', value: `${selected.requester_name} · ${selected.requester_phone}` },
          { label: isHi ? 'अनुरोधकर्ता ईमेल' : 'Requester Email', value: selected.requester_email || '—' },
          { label: isHi ? 'बनाया गया' : 'Created', value: selected.created_at ? new Date(selected.created_at).toLocaleString() : '—' },
          { label: isHi ? 'समाप्ति' : 'Expires', value: selected.expires_at ? new Date(selected.expires_at).toLocaleString() : '—' },
          { label: isHi ? 'पुष्ट यूनिट' : 'Confirmed Units', value: String(selected.units_confirmed ?? 0) },
        ] : []}
        actions={selected && (
          <div className="space-y-4">
            <div>
 <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 mb-2">{isHi ? 'स्थिति अपडेट' : 'Update Status'}</div>
 <div className="flex gap-2 flex-wrap">
 {QUICK_STATUSES.map(s => (
 <button
 key={s}
 disabled={statusUpdating || selected.status === s}
 onClick={() => handleStatusUpdate(selected.id, s)}
 className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 ${
 selected.status === s
 ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
 : 'border border-transparent bg-blue-600 hover:bg-blue-700 text-white'
 }`}
 >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[11px] text-ink-400 space-y-1">
              <div className="font-bold uppercase tracking-[0.14em] text-ink-500 text-[10px]">{isHi ? 'लिंक किए गए मिलान' : 'Matched Donors'} ({linkedFor(selected.id).length})</div>
              {linkedFor(selected.id).length === 0 && <p>{isHi ? 'कोई मिलान नहीं' : 'No matches yet'}</p>}
              {linkedFor(selected.id).slice(0, 6).map(m => (
                <div key={m.id} className="flex items-center justify-between text-xs py-1 border-t border-ink-800/50">
                  <span className="text-ink-200">{m.donor_name || m.blood_type || m.donor_id?.slice(0,8) || 'donor'}</span>
                  <StatusPill status={m.donor_response || 'pending'} isHi={isHi} />
                </div>
              ))}
            </div>
          </div>
        )}
        isHi={isHi}
      />
    </div>
  );
}
