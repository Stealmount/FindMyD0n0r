import React, { useState, useEffect } from 'react';
import { Users, FileSpreadsheet, Building2, UserRound, Clock, Activity } from 'lucide-react';
import { User, BloodRequest, Match, NotificationLog, DonationLog } from '../../../types';
import { StatCard, EmptyState, Badge } from '../widgets/Shared';
import { authenticatedApi } from '../../../lib/api';

interface Metrics {
  totalDonors: number;
  activeRequests: number;
  hospitals: number;
  totalUsers: number;
  recentActivity: { id: string; message: string; event: string; time: string }[];
}

interface OverviewProps {
  donors: User[];
  requests: BloodRequest[];
  matches: Match[];
  notifications: NotificationLog[];
  donationLogs: DonationLog[];
  institutions: any[];
  requesters: any[];
  telemetry: any;
  isHi: boolean;
  onExportCSV: () => void;
}

export default function Overview({ donors, requests, matches, notifications, donationLogs, institutions, requesters, telemetry, isHi, onExportCSV }: OverviewProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  useEffect(() => {
    authenticatedApi<{ metrics: Metrics }>('/api/admin/metrics', undefined, 'GET')
      .then(data => setMetrics(data.metrics))
      .catch(() => setMetrics(null))
      .finally(() => setMetricsLoading(false));
  }, []);

  const totalDonors = metrics?.totalDonors ?? donors.length;
  const activeRequests = metrics?.activeRequests ?? requests.filter(r => ['open', 'broadcasting', 'matching', 'partially_matched', 'secured', 'search_exhausted'].includes(r.status)).length;
  const hospitals = metrics?.hospitals ?? institutions.filter((i: any) => i.verification_status === 'verified').length;
  const totalUsers = metrics?.totalUsers ?? (donors.length + requesters.length);

  const recentFromNotifications = [...(notifications || [])]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 5);

  const recentActivity = metrics?.recentActivity ?? recentFromNotifications.map(n => ({
    id: n.id,
    message: n.message_body,
    event: n.trigger_event,
    time: n.created_at,
  }));

  const critical = requests.filter(r => r.urgency_level === 'critical').length;
  const fulfilled = matches.filter(m => m.outcome === 'donated').length;
  const pending = matches.filter(m => m.donor_response === 'pending').length;

  const byStatus = (['open', 'partially_matched', 'secured', 'search_exhausted', 'fulfilled', 'cancelled', 'expired'] as const).map(s => ({
    s, n: requests.filter(r => r.status === s).length,
  })).filter(x => x.n > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="h-5 w-5" />} label={isHi ? 'कुल दाता' : 'Total Donors'} value={metricsLoading ? '...' : totalDonors} tone="blood" isHi={isHi} />
        <StatCard icon={<FileSpreadsheet className="h-5 w-5" />} label={isHi ? 'सक्रिय अनुरोध' : 'Active Requests'} value={metricsLoading ? '...' : activeRequests} tone="amber" isHi={isHi} />
        <StatCard icon={<Building2 className="h-5 w-5" />} label={isHi ? 'अस्पताल' : 'Hospitals'} value={metricsLoading ? '...' : hospitals} tone="blue" isHi={isHi} />
        <StatCard icon={<UserRound className="h-5 w-5" />} label={isHi ? 'उपयोगकर्ता' : 'Users'} value={metricsLoading ? '...' : totalUsers} tone="emerald" isHi={isHi} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: isHi ? 'गंभीर मामले' : 'Critical Cases', value: critical, tone: critical > 0 ? 'text-blood-400' : 'text-vital-400' },
          { label: isHi ? 'लंबित उत्तर' : 'Pending Replies', value: pending, tone: 'text-amber-400' },
          { label: isHi ? 'पूर्ण दान' : 'Fulfilled Donations', value: fulfilled, tone: 'text-vital-400' },
          { label: isHi ? 'मिलान जोड़े' : 'Match Pairs', value: matches.length, tone: 'text-blue-400' },
        ].map((c, i) => (
 <div key={i} className="border border-ink-800 bg-ink-900 px-5 py-4">
 <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">{c.label}</div>
 <div className={`font-display text-xl font-extrabold tracking-tight mt-1 tabular-nums ${c.tone}`}>{metricsLoading ? '...' : c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <div className="border border-ink-800 bg-ink-900 p-5">
 <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400 mb-4">{isHi ? 'अनुरोध स्थिति' : 'Request Pipeline'}</h3>
          {byStatus.length === 0 ? (
            <EmptyState title={isHi ? 'कोई अनुरोध नहीं' : 'No requests'} hint={''} isHi={isHi} />
          ) : (
            <div className="space-y-2">
              {byStatus.map(({ s, n }) => (
                <div key={s} className="flex items-center justify-between text-xs">
 <span className="text-ink-300 capitalize">{s}</span>
 <div className="w-32 bg-ink-800 h-2 overflow-hidden">
                    <div className="h-full bg-blood-600" style={{ width: `${Math.min(100, (n / Math.max(1, requests.length)) * 100)}%` }} />
                  </div>
                  <span className="text-ink-100 font-bold tabular-nums">{n}</span>
                </div>
              ))}
            </div>
          )}
        </div>

 <div className="border border-ink-800 bg-ink-900 p-5">
 <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400 mb-4">{isHi ? 'मिलान उत्तर' : 'Match Responses'}</h3>
          <div className="space-y-2">
            {[
              { l: isHi ? 'स्वीकृत' : 'Accepted', n: matches.filter(m => ['accepted', 'responded', 'approved'].includes(m.donor_response)).length, c: 'bg-vital-500' },
              { l: isHi ? 'लंबित' : 'Pending', n: pending, c: 'bg-amber-500' },
              { l: isHi ? 'अस्वीकृत / समाप्त' : 'Dropped', n: matches.filter(m => ['declined', 'expired', 'no_response'].includes(m.donor_response)).length, c: 'bg-blood-500' },
            ].map(x => (
              <div key={x.l} className="flex items-center justify-between text-xs">
 <span className="text-ink-300">{x.l}</span>
 <div className="w-32 bg-ink-800 h-2 overflow-hidden">
                  <div className={`h-full ${x.c}`} style={{ width: `${Math.min(100, (x.n / Math.max(1, matches.length)) * 100)}%` }} />
                </div>
                <span className="text-ink-100 font-bold tabular-nums">{x.n}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-ink-800 text-xs text-ink-400">
            <div className="flex justify-between"><span>{isHi ? 'भेजे गए नोटिफिकेशन' : 'Notifications sent'}</span><b className="text-white">{notifications.filter(n => n.status === 'sent').length}</b></div>
            <div className="flex justify-between mt-1"><span>{isHi ? 'दान लॉग' : 'Donation logs'}</span><b className="text-white">{donationLogs.length}</b></div>
          </div>
        </div>

 <div className="border border-ink-800 bg-ink-900 p-5 flex flex-col">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">{isHi ? 'हाल की गतिविधि' : 'Recent Activity'}</h3>
 <button onClick={onExportCSV} className="px-3 py-1.5 border border-white/20 hover:border-white hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5">
              {isHi ? 'CSV निर्यात' : 'Export CSV'}
            </button>
          </div>
          {recentActivity.length === 0 ? (
            <EmptyState title={isHi ? 'कोई गतिविधि नहीं' : 'No activity yet'} hint="" isHi={isHi} />
          ) : (
            <div className="flex-1 space-y-3 overflow-hidden">
              {recentActivity.map((a, i) => (
                <div key={a.id || i} className="flex items-start gap-3">
                  <Activity className="w-3.5 h-3.5 text-ink-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-ink-100 line-clamp-2">{a.message}</div>
                    <div className="text-[10px] text-ink-500 font-mono">{a.event} · {a.time ? new Date(a.time).toLocaleString() : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

 <div className="border border-ink-800 bg-ink-900 p-5">
 <div className="flex items-center gap-2 mb-4">
 <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">{isHi ? 'इंफ्रास्ट्रक्चर स्वास्थ्य' : 'Infrastructure Health'}</h3>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
 <div className="bg-ink-950 p-4 border border-ink-800/60 space-y-1">
            <div className="text-ink-500 text-[11px]">{isHi ? 'सर्वर अपटाइम' : 'Server Uptime'}</div>
            <div className="text-sm font-semibold text-vital-400 tabular-nums">{telemetry?.server_uptime_seconds ? Math.floor(telemetry.server_uptime_seconds / 60) + ' min' : '—'}</div>
          </div>
 <div className="bg-ink-950 p-4 border border-ink-800/60 space-y-1">
 <div className="text-ink-500 text-[11px]">{isHi ? 'मेमोरी' : 'Memory RSS / Heap'}</div>
            <div className="text-sm font-semibold text-blue-400 tabular-nums">
              {telemetry?.memory?.rss_mb || '—'} MB / {telemetry?.memory?.heap_used_mb || '—'} MB
            </div>
          </div>
 <div className="bg-ink-950 p-4 border border-ink-800/60 space-y-1">
 <div className="text-ink-500 text-[11px]">{isHi ? 'सेवाएं' : 'Services'}</div>
            <div className="text-sm font-semibold text-ink-300">
              {telemetry?.services ? Object.entries(telemetry.services).map(([k, v]) => `${k}:${v}`).join(' · ') : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
