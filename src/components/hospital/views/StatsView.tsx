import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Radio, CalendarDays, Droplet, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { authenticatedApi } from '../../../lib/api';
import { BloodRequest, Match, User } from '../../../types';
import { StatCard } from '../widgets/Shared';

interface StatsViewProps {
  isHi: boolean;
}

interface DashboardData {
  requests: BloodRequest[];
  matches: Match[];
  users: User[];
}

export function StatsView({ isHi }: StatsViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await authenticatedApi<DashboardData>('/api/hospital/dashboard', undefined, 'GET');
        setData(res);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center text-ink-500 text-sm">
        <span className="animate-pulse">{isHi ? 'आंकड़े लोड हो रहे हैं...' : 'Loading stats...'}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-ink-500 text-sm">
        {isHi ? 'आंकड़े उपलब्ध नहीं हैं' : 'Stats unavailable'}
      </div>
    );
  }

  const totalDonors = data.users.length;
  const activeRequests = data.requests.filter(r =>
    r.status === 'open' || r.status === 'matching' || r.status === 'broadcasting' || r.status === 'partially_matched'
  ).length;
  const fulfilledRequests = data.requests.filter(r => r.status === 'fulfilled').length;
  const totalMatches = data.matches.length;
  const approvedMatches = data.matches.filter(m => m.donor_response === 'approved').length;
  const pendingMatches = data.matches.filter(m => m.donor_response === 'pending').length;

  const now = new Date();
  const thisMonth = data.requests.filter(r => {
    const d = new Date(r.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const metrics = [
    { icon: <Users className="h-5 w-5" />, label: isHi ? 'कुल दाता' : 'Total Donors', labelHi: 'कुल दाता', value: totalDonors, tone: 'emerald' as const },
    { icon: <Radio className="h-5 w-5" />, label: isHi ? 'सक्रिय अनुरोध' : 'Active Requests', labelHi: 'सक्रिय अनुरोध', value: activeRequests, tone: 'blood' as const },
    { icon: <CalendarDays className="h-5 w-5" />, label: isHi ? 'इस महीने अनुरोध' : 'Requests This Month', labelHi: 'इस महीने अनुरोध', value: thisMonth, tone: 'amber' as const },
    { icon: <CheckCircle className="h-5 w-5" />, label: isHi ? 'पूर्ण अनुरोध' : 'Fulfilled Requests', labelHi: 'पूर्ण अनुरोध', value: fulfilledRequests, tone: 'emerald' as const },
    { icon: <TrendingUp className="h-5 w-5" />, label: isHi ? 'कुल मैच' : 'Total Matches', labelHi: 'कुल मैच', value: totalMatches, tone: 'blood' as const },
    { icon: <Clock className="h-5 w-5" />, label: isHi ? 'प्रतीक्षारत मैच' : 'Pending Matches', labelHi: 'प्रतीक्षारत मैच', value: pendingMatches, tone: 'amber' as const },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-500">
        {isHi ? 'संस्थागत आंकड़े' : 'Institution Stats'}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map(m => (
          <StatCard key={m.label} {...m} isHi={isHi} />
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border border-ink-200 bg-ink-50 p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 mb-3">
            {isHi ? 'मैच दर' : 'Match Rate'}
          </h3>
          <div className="font-display text-3xl font-extrabold tracking-tight text-ink-900 tabular-nums">
            {totalMatches > 0 ? Math.round((approvedMatches / totalMatches) * 100) : 0}%
          </div>
          <p className="text-[11px] text-ink-500 mt-1">
            {approvedMatches} / {totalMatches} {isHi ? 'अनुमोदित' : 'approved'}
          </p>
        </div>
        <div className="border border-ink-200 bg-ink-50 p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 mb-3">
            {isHi ? 'पूर्णता दर' : 'Completion Rate'}
          </h3>
          <div className="font-display text-3xl font-extrabold tracking-tight text-ink-900 tabular-nums">
            {data.requests.length > 0 ? Math.round((fulfilledRequests / data.requests.length) * 100) : 0}%
          </div>
          <p className="text-[11px] text-ink-500 mt-1">
            {fulfilledRequests} / {data.requests.length} {isHi ? 'अनुरोध पूर्ण' : 'requests fulfilled'}
          </p>
        </div>
      </div>
    </div>
  );
}


