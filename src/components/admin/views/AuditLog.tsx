import React from 'react';
import { ScrollText, Download } from 'lucide-react';
import { AuditEntry } from '../types';
import { EmptyState, downloadCSV, Badge } from '../widgets/Shared';

interface AuditLogProps {
 audits: AuditEntry[];
 loading: boolean;
 actionFilter: string;
 isHi: boolean;
 onActionFilterChange: (v: string) => void;
}

export default function AuditLog({ audits, loading, actionFilter, isHi, onActionFilterChange }: AuditLogProps) {
 const actions = React.useMemo(() => Array.from(new Set(audits.map(a => a.action))), [audits]);
 const filtered = React.useMemo(() => {
 let list = audits;
 if (actionFilter) list = list.filter(a => a.action === actionFilter);
 return [...list].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
 }, [audits, actionFilter]);

 const exportCsv = () => {
 downloadCSV(`audit_${new Date().toISOString().split('T')[0]}.csv`,
 ['Actor', 'Action', 'Entity Type', 'Entity ID', 'Meta', 'Created'],
 filtered.map(a => [a.actor, a.action, a.entity_type, a.entity_id, a.meta || '', a.created_at]));
 };

 return (
 <div className="space-y-4">
 <div className="border border-ink-800 bg-ink-900 p-4 flex flex-wrap items-center gap-3">
 <div className="flex items-center gap-2">
 <ScrollText className="w-4 h-4 text-blood-400" />
 <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">{isHi ? 'ऑडिट लॉग' : 'Audit Trail'}</h3>
 <span className="text-[11px] text-ink-500">({filtered.length})</span>
 </div>
 <select value={actionFilter} onChange={e => onActionFilterChange(e.target.value)} aria-label="action filter"
 className="bg-ink-950 border border-ink-700 px-3 py-1.5 text-xs text-white cursor-pointer ml-auto focus:outline-none focus:border-blood-500">
 <option value="">{isHi ? 'सभी क्रियाएं' : 'All actions'}</option>
 {actions.map(a => <option key={a} value={a}>{a}</option>)}
 </select>
 <button onClick={exportCsv} className="px-3 py-1.5 border border-white/20 hover:border-white hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5">
 <Download className="w-3.5 h-3.5" /> CSV
 </button>
 </div>

 <div className="border border-ink-800 bg-ink-900 overflow-hidden">
 {loading ? (
 <div className="p-16 flex items-center justify-center">
 <span className="w-6 h-6 animate-spin rounded-full border-2 border-current/30 border-t-current text-blood-500" />
 </div>
 ) : filtered.length === 0 ? (
 <div className="p-8">
 <EmptyState title={isHi ? 'कोई ऑडिट प्रविष्टि नहीं' : 'No audit entries yet'} hint={isHi ? 'प्रशासनिक क्रियाएं यहां दर्ज होंगी' : 'Admin actions will be logged here'} isHi={isHi} />
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="text-left text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-800">
 <th className="px-4 py-3">{isHi ? 'अभिनेता' : 'Actor'}</th>
 <th className="px-4 py-3">{isHi ? 'क्रिया' : 'Action'}</th>
 <th className="px-4 py-3">{isHi ? 'इकाई' : 'Entity'}</th>
 <th className="px-4 py-3">{isHi ? 'लक्ष्य' : 'Target ID'}</th>
 <th className="px-4 py-3">{isHi ? 'विवरण' : 'Detail'}</th>
 <th className="px-4 py-3">{isHi ? 'समय' : 'Time'}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-ink-800/60">
 {filtered.map(a => (
 <tr key={a.id} className="hover:bg-white/[0.04] transition-colors">
 <td className="px-4 py-3 text-xs text-ink-200 font-medium">{a.actor}</td>
 <td className="px-4 py-3">
 <span className="inline-flex items-center border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] bg-blood-500/10 border-blood-500/30 text-blood-400">{a.action}</span>
 </td>
 <td className="px-4 py-3 text-[11px] text-ink-400">{a.entity_type}</td>
 <td className="px-4 py-3 font-mono text-[11px] text-ink-400">{a.entity_id?.slice(0, 12) || '—'}</td>
 <td className="px-4 py-3 text-[11px] text-ink-500 max-w-xs line-clamp-1">{a.meta || '—'}</td>
 <td className="px-4 py-3 text-[11px] text-ink-500 whitespace-nowrap">{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </div>
 );
}
