import React from 'react';
import { Match, BloodRequest, User } from '../../types';
import { useLanguage } from '../../lib/LanguageContext';
import {
  Heart,
  Droplet,
  MapPin,
  Clock,
  Calendar,
  Eye,
  ChevronRight,
  X,
} from 'lucide-react';

interface MatchListProps {
  matches: Match[];
  requests: BloodRequest[];
  currentUser: User;
  loadingMatchId: string | null;
  onViewDetails: (match: Match) => void;
  onPass: (matchId: string) => void;
}

function formatCreated(iso: string | undefined, isHi: boolean): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(isHi ? 'hi-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

export default function MatchList({ matches, requests, loadingMatchId, onViewDetails, onPass }: MatchListProps) {
  const { t, language } = useLanguage();
  const isHi = language === 'HI';
  const now = Date.now();

  const statusBadge = (req: BloodRequest, match: Match) => {
    if (req.status === 'cancelled') {
      return { label: isHi ? 'रद्द' : 'Cancelled', cls: 'bg-ink-100 text-ink-600 border-ink-200' };
    }
    if (req.status === 'expired' || (req.expires_at && new Date(req.expires_at).getTime() < now)) {
      return { label: isHi ? 'समाप्त' : 'Expired', cls: 'bg-ink-100 text-ink-500 border-ink-200' };
    }
    if (match.donor_response === 'declined') {
      return { label: isHi ? 'आपने अस्वीकार किया' : 'Declined', cls: 'bg-ink-50 text-ink-500 border-ink-200' };
    }
    if (match.donor_response === 'timed_out') {
      return { label: isHi ? 'समय समाप्त' : 'Timed Out', cls: 'bg-ink-50 text-ink-500 border-ink-200' };
    }
    if (match.donor_response === 'approved') {
      return { label: t.donorDashboard.acceptedChip, cls: 'bg-blood-50 text-blood-700 border-blood-200' };
    }
    return { label: isHi ? 'कार्रवाई आवश्यक' : 'Action Required', cls: 'bg-blood-50 text-blood-700 border-blood-200' };
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-ink-200 pb-3 min-w-0">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-ink-900 truncate min-w-0">
          <Heart className="w-4 h-4 text-blood-400 shrink-0" />
          <span className="truncate">{t.donorDashboard.liveMatchingRequests} ({matches.length})</span>
        </h3>
      </div>

      {matches.length === 0 ? (
        <div className="border border-ink-200 bg-ink-50 px-4 py-10 sm:py-12 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-blood-500/30 bg-blood-500/10">
            <Droplet className="w-6 h-6 text-blood-400" />
          </div>
          <p className="text-[13px] font-semibold text-ink-900">{t.donorDashboard.noActiveRequests}</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-500 px-2">
            {t.donorDashboard.noActiveRequestsSub}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map(match => {
            const req = requests.find(r => r.id === match.request_id);
            if (!req) return null;

            const badge = statusBadge(req, match);
            const isPending = match.donor_response === 'pending';
            const isResponded = match.donor_response === 'approved' || match.donor_response === 'declined';

            return (
              <div
                key={match.id}
                className={`relative overflow-hidden border p-4 transition-colors min-w-0 ${
                  isResponded ? 'border-ink-200 bg-ink-50/40' : 'border-ink-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] font-semibold tracking-tight text-ink-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-blood-500" />
                    {req.tracking_code}
                  </span>
                  <span className={`inline-flex items-center whitespace-nowrap border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>

                <h4 className="mt-2.5 text-lg sm:text-xl font-semibold tracking-tight truncate text-ink-900">
                  {req.blood_type_needed} {isHi ? 'रक्त की आवश्यकता' : 'blood needed'}
                </h4>

                <p className="mt-1 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-600 min-w-0">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                  <span className="truncate min-w-0">
                    {req.hospital_name}, {req.hospital_area}, {req.hospital_city}
                  </span>
                </p>

                <div className="mt-3.5 flex flex-wrap items-center gap-2 min-w-0">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] border-ink-200 bg-ink-50 text-ink-700">
                    <MapPin className="w-3.5 h-3.5 text-ink-400" />
                    {match.distance_km ? `${match.distance_km} ${t.donorDashboard.kmAway}` : (isHi ? 'आस-पास' : 'Nearby')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] border-ink-200 bg-ink-50 text-ink-700">
                    <Droplet className="w-3.5 h-3.5 text-ink-400" />
                    {req.units_required} {t.donorDashboard.units}
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] border-ink-200 bg-ink-50 text-ink-700">
                    <Clock className="w-3.5 h-3.5 text-ink-400" />
                    {req.urgency_level.toUpperCase()}
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] border-ink-200 bg-ink-50 text-ink-600">
                    <Calendar className="w-3.5 h-3.5 text-ink-400" />
                    {formatCreated(req.created_at, isHi)}
                  </span>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  {isPending && (
                    <button
                      id={`btn-dash-pass-${match.id}`}
                      onClick={() => onPass(match.id)}
                      disabled={loadingMatchId === match.id}
                      className="flex items-center justify-center gap-2 border border-ink-300 bg-white py-2.5 sm:py-3 px-4 text-[12.5px] font-semibold text-ink-700 transition-colors hover:border-ink-900 hover:bg-ink-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] order-2 sm:order-2 w-full sm:w-auto"
                    >
                      {loadingMatchId === match.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-200 border-t-ink-900" /> : <X className="h-4 w-4" />}
                      {t.donorDashboard.pass}
                    </button>
                  )}
                  <button
                    id={`btn-dash-view-${match.id}`}
                    onClick={() => onViewDetails(match)}
                    disabled={loadingMatchId === match.id}
                    className="flex flex-1 items-center justify-center gap-2 bg-ink-900 py-2.5 sm:py-3 px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-ink-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] order-1 sm:order-1 w-full sm:w-auto"
                  >
                    <Eye className="h-4 w-4" />
                    {t.donorDashboard.viewDetails}
                    <ChevronRight className="ml-auto h-4 w-4 shrink-0" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
