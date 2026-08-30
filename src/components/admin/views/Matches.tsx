import React from 'react';
import { CheckCircle, X, Download } from 'lucide-react';
import { Match } from '../../../types';
import { StatusPill, EmptyState, downloadCSV, Badge } from '../widgets/Shared';

interface MatchesProps {
 matches: Match[];
 isHi: boolean;
 onOverrideOutcome: (matchId: string, outcome: 'donated' | 'cancelled') => void;
}

const RESP_FILTERS = ['pending', 'approved', 'declined', 'timed_out'];

export default function Matches({ matches, isHi, onOverrideOutcome }: MatchesProps) {
 const [respFilter, setRespFilter] = React.useState('');
 const [outcomeFilter, setOutcomeFilter] = React.useState('');

 const filtered = React.useMemo(() => {
 let list = matches;
 if (respFilter) list = list.filter(m => m.donor_response === respFilter);
 if (outcomeFilter) list = list.filter(m => m.outcome === outcomeFilter);
 return [...list].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
 }, [matches, respFilter, outcomeFilter]);

 const exportCsv = () => {
 downloadCSV(`matches_${new Date().toISOString().split('T')[0]}.csv`,
 ['Match ID', 'Request', 'Donor', 'Blood', 'Distance', 'Response', 'Outcome', 'Channel', 'Created'],
 filtered.map(m => [m.id || '', m.request_id || '', m.donor_name || m.donor_id || '', m.blood_type || '', m.distance_km ?? '', m.donor_response, m.outcome || '', m.notification_channel || '', m.created_at || '']));
 };

 return (
 <div className="space-y-4">
 <div className="border border-ink-800 bg-ink-900 p-4 flex flex-wrap items-center gap-3">
 <select value={respFilter} onChange={e => setRespFilter(e.target.value)} aria-label="response filter"
 className="bg-ink-950 border border-ink-700 px-3 py-2 text-xs text-white cursor-pointer focus:outline-none focus:border-blood-500">
 <option value="">{isHi ? 'सभी उत्तर' : 'All responses'}</option>
 {RESP_FILTERS.map(s => <option key={s} value={s}>{s}</option>)}
 </select>
 <select value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)} aria-label="outcome filter"
 className="bg-ink-950 border border-ink-700 px-3 py-2 text-xs text-white cursor-pointer focus:outline-none focus:border-blood-500">
 <option value="">{isHi ? 'सभी परिणाम' : 'All outcomes'}</option>
 <option value="donated">donated</option>
 <option value="cancelled">cancelled</option>
 </select>
 <button onClick={exportCsv} className="ml-auto px-3 py-1.5 border border-white/20 hover:border-white hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5">
 <Download className="w-3.5 h-3.5" /> CSV
 </button>
 </div>

 <div className="border border-ink-800 bg-ink-900 overflow-hidden">
 {filtered.length === 0 ? (
 <div className="p-8">
 <EmptyState title={isHi ? 'कोई मिलान नहीं' : 'No matches found'} hint={isHi ? 'फिल्टर बदलें' : 'Try adjusting filters'} isHi={isHi} />
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="text-left text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-800">
 <th className="px-4 py-3">{isHi ? 'अनुरोध' : 'Request'}</th>
 <th className="px-4 py-3">{isHi ? 'दाता' : 'Donor'}</th>
 <th className="px-4 py-3">{isHi ? 'रक्त / दूरी' : 'Blood / Distance'}</th>
 <th className="px-4 py-3">{isHi ? 'उत्तर' : 'Response'}</th>
 <th className="px-4 py-3">{isHi ? 'परिणाम' : 'Outcome'}</th>
 <th className="px-4 py-3">{isHi ? 'चैनल' : 'Channel'}</th>
 <th className="px-4 py-3 text-right">{isHi ? 'कार्रवाई' : 'Actions'}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-ink-800/60">
 {filtered.map(m => (
 <tr key={m.id || m.matchToken} className="hover:bg-white/[0.04] transition-colors">
 <td className="px-4 py-3 font-mono text-[11px] text-ink-300">{m.request_id?.slice(0, 12) || '—'}</td>
 <td className="px-4 py-3">
 <div className="font-semibold text-white">{m.donor_name || m.donor_id || 'donor'}</div>
 <div className="text-[11px] text-ink-500">{m.area}{m.city ? `, ${m.city}` : ''}</div>
 </td>
 <td className="px-4 py-3"><Badge tone="blood">{m.blood_type || '—'}</Badge> {m.distance_km !== undefined && <span className="text-[11px] text-ink-500">{m.distance_km} km</span>}</td>
 <td className="px-4 py-3"><StatusPill status={m.donor_response || 'pending'} isHi={isHi} /></td>
 <td className="px-4 py-3">{m.outcome ? <StatusPill status={m.outcome} isHi={isHi} /> : <span className="text-[11px] text-ink-500">—</span>}</td>
 <td className="px-4 py-3 text-[11px] text-ink-400">{m.notification_channel || '—'}</td>
 <td className="px-4 py-3">
 {!m.outcome && m.donor_response === 'approved' && (
 <div className="flex justify-end gap-1">
 <button onClick={() => onOverrideOutcome(m.id || '', 'donated')} title={isHi ? 'दान पूर्ण' : 'Mark donated'}
 className="p-1.5 text-vital-400 hover:bg-vital-500/10 transition cursor-pointer"><CheckCircle className="w-4 h-4" /></button>
 <button onClick={() => onOverrideOutcome(m.id || '', 'cancelled')} title={isHi ? 'रद्द करें' : 'Cancel'}
 className="p-1.5 text-blood-400 hover:bg-blood-500/10 transition cursor-pointer"><X className="w-4 h-4" /></button>
 </div>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 <div className="text-[11px] text-ink-500 pl-1">{filtered.length} / {matches.length} {isHi ? 'मिलान' : 'matches'}</div>
 </div>
 );
}
