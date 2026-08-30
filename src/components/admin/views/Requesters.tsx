import React from 'react';
import { Search, Download, UserRound } from 'lucide-react';
import { Requester } from '../../../types';
import { StatusPill, EmptyState, EntityDrawer, downloadCSV } from '../widgets/Shared';

interface RequestersProps {
 requesters: Requester[];
 loading: boolean;
 showDeleted: boolean;
 search: string;
 isHi: boolean;
 onToggleDeleted: (v: boolean) => void;
 onSearchChange: (v: string) => void;
 onOpenDetail: (r: Requester) => void;
 onRestore: (id: string) => void;
}

export default function Requesters({
 requesters, loading, showDeleted, search, isHi,
 onToggleDeleted, onSearchChange, onOpenDetail, onRestore,
}: RequestersProps) {
 const filtered = React.useMemo(() => {
 let list = requesters;
 if (search) {
 const q = search.toLowerCase();
 list = list.filter(r => [r.full_name, r.phone, r.email].some(v => (v || '').toLowerCase().includes(q)));
 }
 return [...list].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
 }, [requesters, search]);

 const exportCsv = () => {
 downloadCSV(`requesters_${new Date().toISOString().split('T')[0]}.csv`,
 ['ID', 'Name', 'Phone', 'Email', 'Status', 'Created'],
 filtered.map(r => [r.id, r.full_name, r.phone, r.email, r.account_status, r.created_at]));
 };

 return (
 <div className="space-y-4">
 <div className="border border-ink-800 bg-ink-900 p-4 flex flex-wrap items-center gap-3">
 <div className="relative">
 <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
 <input value={search} onChange={e => onSearchChange(e.target.value)}
 placeholder={isHi ? 'नाम, फोन खोजें...' : 'Search name, phone...'}
 className="bg-ink-950 border border-ink-700 pl-9 pr-3 py-2 text-xs text-white placeholder:text-ink-500 focus:outline-none focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500 w-56" />
 </div>
 <label className="flex items-center gap-2 text-xs text-ink-300 cursor-pointer">
 <input type="checkbox" checked={showDeleted} onChange={e => onToggleDeleted(e.target.checked)} className="accent-blood-600 cursor-pointer" />
 {isHi ? 'हटाए गए दिखाएं' : 'Show deleted'}
 </label>
 <button onClick={exportCsv} className="ml-auto px-3 py-1.5 border border-white/20 hover:border-white hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5">
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
 <EmptyState title={isHi ? 'कोई अनुरोधकर्ता नहीं' : 'No requesters found'} hint={isHi ? 'फिल्टर बदलें' : 'Try adjusting filters'} isHi={isHi} />
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="text-left text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-800">
 <th className="px-4 py-3">{isHi ? 'अनुरोधकर्ता' : 'Requester'}</th>
 <th className="px-4 py-3">Email</th>
 <th className="px-4 py-3">{isHi ? 'स्थिति' : 'Status'}</th>
 <th className="px-4 py-3">{isHi ? 'पंजीकृत' : 'Registered'}</th>
 <th className="px-4 py-3 text-right">{isHi ? 'कार्रवाई' : 'Actions'}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-ink-800/60">
 {filtered.map(r => (
 <tr key={r.id} className="hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => onOpenDetail(r)}>
 <td className="px-4 py-3">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold shrink-0">
 {(r.full_name || '?').charAt(0).toUpperCase()}
 </div>
 <div>
 <div className="font-semibold text-white">{r.full_name || '—'}</div>
 <div className="text-[11px] text-ink-500">{r.phone}</div>
 </div>
 </div>
 </td>
 <td className="px-4 py-3 text-ink-300 text-xs">{r.email || '—'}</td>
 <td className="px-4 py-3"><StatusPill status={r.account_status || 'active'} isHi={isHi} /></td>
 <td className="px-4 py-3 text-ink-400 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
 <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
 <div className="flex justify-end gap-1">
 {r.account_status === 'deleted' && (
 <button onClick={() => onRestore(r.id)} title={isHi ? 'पुनर्स्थापित' : 'Restore'}
 className="px-2.5 py-1.5 text-[11px] font-semibold text-vital-400 border border-vital-500/30 bg-transparent hover:bg-vital-500/10 transition-colors cursor-pointer">
 {isHi ? 'पुनर्स्थापित' : 'Restore'}
 </button>
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
 <div className="text-[11px] text-ink-500 pl-1">{filtered.length} {isHi ? 'अनुरोधकर्ता' : 'requesters'}</div>
 </div>
 );
}
