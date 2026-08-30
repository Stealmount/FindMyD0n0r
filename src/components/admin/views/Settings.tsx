import React from 'react';
import { Settings as SettingsIcon, Server, Database, RefreshCw, Download } from 'lucide-react';
import { downloadCSV } from '../widgets/Shared';

interface SettingsProps {
 isHi: boolean;
 telemetry: any;
 onRefresh: () => void;
 onExportAll: () => void;
 donorsCount: number;
 requestsCount: number;
 matchesCount: number;
 notificationsCount: number;
}

export default function Settings({ isHi, telemetry, onRefresh, onExportAll, donorsCount, requestsCount, matchesCount, notificationsCount }: SettingsProps) {
 const services = telemetry?.services || {};
 const serviceRows = Object.entries(services);

 return (
 <div className="space-y-6">
 {/* System health */}
 <div className="border border-ink-800 bg-ink-900 p-6">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <Server className="w-4 h-4 text-blood-400" />
 <h3 className="text-[13px] font-bold text-white">{isHi ? 'सिस्टम स्वास्थ्य' : 'System Health'}</h3>
 </div>
 <button onClick={onRefresh} className="px-3 py-1.5 bg-transparent border border-white/20 hover:border-white hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5">
 <RefreshCw className="w-3.5 h-3.5" /> {isHi ? 'रिफ्रेश' : 'Refresh'}
 </button>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
 <div className="bg-ink-950 p-4 border border-ink-800/60 space-y-1">
 <div className="text-ink-500 text-[11px]">{isHi ? 'अपटाइम' : 'Uptime'}</div>
 <div className="text-sm font-semibold text-vital-400 tabular-nums">{telemetry?.server_uptime_seconds ? Math.floor(telemetry.server_uptime_seconds / 60) + ' min' : '—'}</div>
 </div>
 <div className="bg-ink-950 p-4 border border-ink-800/60 space-y-1">
 <div className="text-ink-500 text-[11px]">{isHi ? 'मेमोरी' : 'Memory'}</div>
 <div className="text-sm font-semibold text-blue-400 tabular-nums">{telemetry?.memory?.rss_mb || '—'} MB / {telemetry?.memory?.heap_used_mb || '—'} MB</div>
 </div>
 <div className="bg-ink-950 p-4 border border-ink-800/60 space-y-1">
 <div className="text-ink-500 text-[11px]">{isHi ? 'पोर्ट' : 'Port'}</div>
 <div className="text-sm font-semibold text-white font-mono tabular-nums">{telemetry?.port || '—'}</div>
 </div>
 </div>
 {serviceRows.length > 0 && (
 <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
 {serviceRows.map(([k, v]) => (
 <div key={k} className="flex items-center justify-between bg-ink-950 px-3 py-2 border border-ink-800/60">
 <span className="text-[11px] text-ink-400 font-mono">{k}</span>
 <span className={`text-[11px] font-bold ${v === 'UP' || v === 'RUNNING' ? 'text-vital-400' : v === 'ACTIVE' ? 'text-vital-400' : 'text-amber-400'}`}>{String(v)}</span>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Data & database */}
 <div className="border border-ink-800 bg-ink-900 p-6">
 <div className="flex items-center gap-2 mb-4">
 <Database className="w-4 h-4 text-blood-400" />
 <h3 className="text-[13px] font-bold text-white">{isHi ? 'डेटा और डेटाबेस' : 'Data & Database'}</h3>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
 {[
 { l: isHi ? 'दाता' : 'Donors', n: donorsCount },
 { l: isHi ? 'अनुरोध' : 'Requests', n: requestsCount },
 { l: isHi ? 'मिलान' : 'Matches', n: matchesCount },
 { l: isHi ? 'नोटिफिकेशन' : 'Notifications', n: notificationsCount },
 ].map(c => (
 <div key={c.l} className="bg-ink-950 p-4 border border-ink-800/60">
 <div className="font-display text-2xl font-extrabold tracking-tight text-white tabular-nums">{c.n}</div>
 <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 mt-1">{c.l}</div>
 </div>
 ))}
 </div>
 <button onClick={onExportAll}
 className="mt-4 px-4 py-2 bg-transparent border border-white/20 hover:border-white hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5">
 <Download className="w-3.5 h-3.5" /> {isHi ? 'पूर्ण डेटा निर्यात (CSV)' : 'Export full dataset (CSV)'}
 </button>
 </div>

 <div className="border border-amber-500/30 bg-amber-500/10 p-5 text-xs">
 <h3 className="text-[12px] font-bold text-amber-400 mb-1.5">{isHi ? 'सुरक्षा नोट' : 'Security Note'}</h3>
 <p className="text-ink-400">
 {isHi
 ? 'सभी प्रशासनिक API कॉल सर्वर-साइड JWT + ADMIN_EMAILS द्वारा संरक्षित हैं। ब्राउज़र स्टोरेज में कोई कच्ची गुप्त कुंजी नहीं रखी जाती।'
 : 'All admin API routes are protected by the short-lived server JWT and ADMIN_EMAILS. Raw secrets never reach browser storage.'}
 </p>
 </div>
 </div>
 );
}
