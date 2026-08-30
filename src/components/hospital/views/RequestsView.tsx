import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, MapPin, Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import { authenticatedApi } from '../../../lib/api';
import { BloodRequest, Match } from '../../../types';
import { EmptyState, StatusPill } from '../widgets/Shared';

interface RequestsViewProps {
  requests: BloodRequest[];
  matches: Match[];
  users: Array<{ id: string; full_name: string; blood_type?: string; phone?: string }>;
  isHi: boolean;
  onRequestFulfilled: () => void;
}

export function RequestsView({ requests, matches, users, isHi, onRequestFulfilled }: RequestsViewProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'fulfilled' | 'cancelled'>('all');
  const [fulfilling, setFulfilling] = useState<string | null>(null);

  const filtered = requests.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'active') return r.status === 'open' || r.status === 'matching' || r.status === 'broadcasting' || r.status === 'partially_matched';
    if (filter === 'fulfilled') return r.status === 'fulfilled';
    if (filter === 'cancelled') return r.status === 'cancelled' || r.status === 'expired';
    return true;
  });

  const counts = {
    all: requests.length,
    active: requests.filter(r => r.status === 'open' || r.status === 'matching' || r.status === 'broadcasting' || r.status === 'partially_matched').length,
    fulfilled: requests.filter(r => r.status === 'fulfilled').length,
    cancelled: requests.filter(r => r.status === 'cancelled' || r.status === 'expired').length,
  };

  const handleFulfill = async (requestId: string) => {
    setFulfilling(requestId);
    try {
      await authenticatedApi(`/api/requests/${requestId}/status`, { status: 'fulfilled' }, 'PATCH');
      onRequestFulfilled();
    } catch { /* silent */ } finally {
      setFulfilling(null);
    }
  };

  const getMatchedDonors = (requestId: string) => {
    return matches
      .filter(m => m.request_id === requestId)
      .map(m => {
        const user = users.find(u => u.id === m.donor_id);
        return { ...m, donorName: user?.full_name || 'Volunteer Donor', donorBlood: user?.blood_type || '—' };
      });
  };

  const filters: Array<{ key: typeof filter; label: string; labelHi: string }> = [
    { key: 'all', label: 'All', labelHi: 'सभी' },
    { key: 'active', label: 'Active', labelHi: 'सक्रिय' },
    { key: 'fulfilled', label: 'Fulfilled', labelHi: 'पूर्ण' },
    { key: 'cancelled', label: 'Cancelled', labelHi: 'रद्द' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-500">
          {isHi ? 'अनुरोध प्रबंधन' : 'Request Management'}
        </h2>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`cursor-pointer border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.key
                ? 'border-blood-600 bg-blood-600 text-white'
                : 'border-ink-300 text-ink-600 hover:border-ink-400 hover:text-ink-900'
            }`}
          >
            {isHi ? f.labelHi : f.label}
            <span className="ml-1.5 text-[10px] opacity-70">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={isHi ? 'कोई अनुरोध नहीं' : 'No requests'}
          titleHi={isHi ? 'कोई अनुरोध नहीं' : 'No requests'}
          hint={isHi ? 'Live टैब से अनुरोध बनाएं।' : 'Create requests from the Live tab.'}
          hintHi={isHi ? 'Live टैब से अनुरोध बनाएं।' : 'Create requests from the Live tab.'}
          isHi={isHi}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const matchedDonors = getMatchedDonors(req.id);
            const isPending = req.status === 'open' || req.status === 'matching' || req.status === 'broadcasting' || req.status === 'partially_matched';
            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-ink-200 bg-ink-50 p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-12 h-12 bg-blood-500/10 border border-blood-500/30 flex items-center justify-center shrink-0">
                      <span className="text-sm font-extrabold text-blood-600">{req.blood_type_needed}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-ink-900">
                        {req.patient_name || (isHi ? 'अनाम रोगी' : 'Unnamed Patient')} · {req.units_required} {isHi ? 'यूनिट' : 'units'}
                      </div>
                      <div className="text-[11px] text-ink-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {req.hospital_city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {req.hospital_city}
                          </span>
                        )}
                        {req.tracking_code && (
                          <span className="font-mono text-ink-500">{req.tracking_code}</span>
                        )}
                      </div>
                      {req.urgency_level && (
                        <span className={`mt-1.5 inline-block border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${
                          req.urgency_level === 'critical' ? 'border-blood-500/30 bg-blood-500/10 text-blood-600' :
                          req.urgency_level === 'urgent' ? 'border-amber-500/30 bg-amber-500/10 text-amber-600' :
                          'border-ink-200 bg-ink-100 text-ink-600'
                        }`}>
                          {req.urgency_level}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill status={req.status} isHi={isHi} />
                    {isPending && (
                      <button
                        onClick={() => handleFulfill(req.id)}
                        disabled={fulfilling === req.id}
                        className="inline-flex cursor-pointer items-center gap-1 bg-vital-600 px-3 py-1.5 text-xs font-bold text-white transition-colors duration-200 hover:bg-vital-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle className="w-3 h-3" />
                        {isHi ? 'पूर्ण' : 'Fulfilled'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Matched donors inline */}
                {matchedDonors.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-ink-200">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users className="w-3 h-3 text-ink-500" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                        {isHi ? 'मैच किए गए दाता' : 'Matched Donors'}
                      </span>
                      <span className="text-[10px] text-ink-500">({matchedDonors.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {matchedDonors.map(m => (
                        <div key={m.id || m.donor_id} className="flex items-center gap-2 border border-ink-200 bg-white px-2.5 py-1.5">
                          <div className="w-6 h-6 rounded-full bg-blood-500/15 flex items-center justify-center text-[9px] font-bold text-blood-600">
                            {m.donorName.charAt(0)}
                          </div>
                          <span className="text-xs font-medium text-ink-800">{m.donorName}</span>
                          <span className="text-[9px] font-bold text-ink-500">{m.donorBlood}</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            m.donor_response === 'approved' ? 'bg-vital-600' :
                            m.donor_response === 'declined' ? 'bg-blood-500' :
                            'bg-amber-600'
                          }`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
