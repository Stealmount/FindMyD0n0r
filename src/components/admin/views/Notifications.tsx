import React from 'react';
import { Send, BellRing, Download } from 'lucide-react';
import { NotificationLog } from '../../../types';
import { StatusPill, EmptyState, downloadCSV } from '../widgets/Shared';

interface NotificationsProps {
 notifications: NotificationLog[];
 loading?: boolean;
 error?: string | null;
 onRetry?: () => void;
 isHi: boolean;
 // SOS broadcast form
 sosCity: string;
 sosBloodType: string;
 sosMessage: string;
 sosSending: boolean;
 sosStatus: string | null;
 onSosCityChange: (v: string) => void;
 onSosBloodTypeChange: (v: string) => void;
 onSosMessageChange: (v: string) => void;
 onSendSos: (e: React.FormEvent) => void;
}

const BLOOD = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function Notifications({
 notifications, loading, error, onRetry, isHi,
 sosCity, sosBloodType, sosMessage, sosSending, sosStatus,
 onSosCityChange, onSosBloodTypeChange, onSosMessageChange, onSendSos,
}: NotificationsProps) {
 const [eventFilter, setEventFilter] = React.useState('');

 const filtered = React.useMemo(() => {
 let list = notifications;
 if (eventFilter) list = list.filter(n => n.trigger_event === eventFilter);
 return [...list].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
 }, [notifications, eventFilter]);

 const events = React.useMemo(() => Array.from(new Set(notifications.map(n => n.trigger_event))), [notifications]);

 const exportCsv = () => {
 downloadCSV(`notifications_${new Date().toISOString().split('T')[0]}.csv`,
 ['ID', 'Type', 'Recipient', 'Trigger', 'Status', 'Sent', 'Created'],
 filtered.map(n => [n.id, n.type, n.recipient_id, n.trigger_event, n.status, n.sent_at || '', n.created_at]));
 };

 return (
 <div className="space-y-6">
 {/* SOS broadcast composer */}
 <div className="border border-ink-800 bg-ink-900 p-6">
 <div className="flex items-center gap-2 mb-4">
 <div className="w-9 h-9 bg-blood-500/10 border border-blood-500/30 flex items-center justify-center">
 <Send className="w-4 h-4 text-blood-400" />
 </div>
 <h3 className="text-[13px] font-bold text-white">{isHi ? 'आपातकालीन SOS प्रसारण' : 'Emergency SOS Broadcast'}</h3>
 <span className="ml-auto inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] bg-blood-500/10 border-blood-500/30 text-blood-400 animate-pulse">LIVE ALERT</span>
 </div>
 <form onSubmit={onSendSos} className="space-y-3">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <input value={sosCity} onChange={e => onSosCityChange(e.target.value)}
 placeholder={isHi ? 'शहर (वैकल्पिक)' : 'City (optional)'}
 className="bg-ink-950 border border-ink-700 px-3 py-2 text-xs text-white placeholder:text-ink-500 focus:outline-none focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500" />
 <select value={sosBloodType} onChange={e => onSosBloodTypeChange(e.target.value)} aria-label="blood type"
 className="bg-ink-950 border border-ink-700 px-3 py-2 text-xs text-white cursor-pointer focus:outline-none focus:border-blood-500">
 {BLOOD.map((b, i) => <option key={i} value={b}>{b || (isHi ? 'सभी रक्त प्रकार' : 'All blood types')}</option>)}
 </select>
 </div>
 <textarea value={sosMessage} onChange={e => onSosMessageChange(e.target.value)}
 placeholder={isHi ? 'प्रसारण संदेश...' : 'Broadcast message...'}
 className="w-full bg-ink-950 border border-ink-700 px-3 py-2 text-xs text-white placeholder:text-ink-500 focus:outline-none focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500 min-h-[80px] resize-none" />
 <div className="flex items-center justify-end gap-3">
 {sosStatus && <span className={`text-xs font-medium ${sosStatus.includes('Failed') ? 'text-blood-400' : 'text-vital-400'}`}>{sosStatus}</span>}
 <button type="submit" disabled={sosSending || !sosMessage.trim()}
 className="px-4 py-2 bg-blood-600 hover:bg-blood-700 active:bg-blood-800 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600">
 {sosSending ? <span className="w-3 h-3 rounded-full border-2 border-current/30 border-t-current animate-spin" /> : <Send className="w-3.5 h-3.5" />}
 {isHi ? 'प्रसारण भेजें' : 'Dispatch Broadcast'}
 </button>
 </div>
 </form>
 </div>

 {/* Notification log */}
 <div className="border border-ink-800 bg-ink-900 overflow-hidden">
 <div className="px-4 py-3 border-b border-ink-800 flex flex-wrap items-center gap-3">
 <div className="flex items-center gap-2">
 <BellRing className="w-4 h-4 text-blood-400" />
 <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">{isHi ? 'नोटिफिकेशन लॉग' : 'Notification Log'}</h3>
 <span className="text-[11px] text-ink-500">({filtered.length})</span>
 </div>
 <select value={eventFilter} onChange={e => setEventFilter(e.target.value)} aria-label="event filter"
 className="bg-ink-950 border border-ink-700 px-3 py-1.5 text-xs text-white cursor-pointer ml-auto focus:outline-none focus:border-blood-500">
 <option value="">{isHi ? 'सभी घटनाएं' : 'All events'}</option>
 {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
 </select>
 <button onClick={exportCsv} className="px-3 py-1.5 border border-white/20 hover:border-white hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5">
 <Download className="w-3.5 h-3.5" /> CSV
 </button>
 </div>
 {loading ? (
 <div className="p-12 flex flex-col items-center justify-center">
 <span className="w-6 h-6 animate-spin rounded-full border-2 border-current/30 border-t-current text-white inline-block mb-3"></span>
 <span className="text-xs font-semibold text-ink-500">{isHi ? 'सिंक हो रहा है...' : 'Syncing...'}</span>
 </div>
 ) : error ? (
 <div className="p-12 text-center">
 <p className="text-[13px] font-semibold text-white mb-4">{error}</p>
 {onRetry && (
 <button onClick={onRetry} className="px-4 py-2 border border-white/20 hover:border-white hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer">{isHi ? 'फिर कोशिश करें' : 'Try again'}</button>
 )}
 </div>
 ) : filtered.length === 0 ? (
 <div className="p-8">
 <EmptyState title={isHi ? 'कोई नोटिफिकेशन नहीं' : 'No notifications'} hint={isHi ? 'फिल्टर बदलें' : 'Try adjusting filters'} isHi={isHi} />
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="text-left text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-800">
 <th className="px-4 py-3">{isHi ? 'संदेश' : 'Message'}</th>
 <th className="px-4 py-3">{isHi ? 'प्रकार' : 'Type'}</th>
 <th className="px-4 py-3">{isHi ? 'घटना' : 'Event'}</th>
 <th className="px-4 py-3">{isHi ? 'स्थिति' : 'Status'}</th>
 <th className="px-4 py-3">{isHi ? 'समय' : 'Time'}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-ink-800/60">
 {filtered.map(n => (
 <tr key={n.id} className="hover:bg-white/[0.04] transition-colors">
 <td className="px-6 py-3 text-ink-200 text-xs max-w-lg line-clamp-2">{n.message_body || n.trigger_event}</td>
 <td className="px-4 py-3 text-[11px] text-ink-400">{n.type}</td>
 <td className="px-4 py-3 font-mono text-[11px] text-ink-300">{n.trigger_event}</td>
 <td className="px-4 py-3"><StatusPill status={n.status || 'sent'} isHi={isHi} /></td>
 <td className="px-4 py-3 text-[11px] text-ink-500">{n.sent_at ? new Date(n.sent_at).toLocaleString() : '—'}</td>
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
