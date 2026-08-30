import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Match, BloodRequest, User } from '../../types';
import { useLanguage } from '../../lib/LanguageContext';
import { getCoordinates } from '../../data/pincode_coords';
import HospitalMap from '../HospitalMap';
import {
  X,
  Droplet,
  MapPin,
  Clock,
  Calendar,
  Phone,
  MessageSquare,
  Check,
  Heart,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface RequestDetailDrawerProps {
  match: Match | null;
  request: BloodRequest | null;
  currentUser: User;
  loadingMatchId: string | null;
  onClose: () => void;
  onDecision: (matchId: string, decision: 'approved' | 'declined') => void;
}

function formatDt(iso?: string | null, isHi = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' }) +
    ', ' + d.toLocaleTimeString(isHi ? 'hi-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function RequestDetailDrawer({ match, request, currentUser, loadingMatchId, onClose, onDecision }: RequestDetailDrawerProps) {
  const { t, language } = useLanguage();
  const isHi = language === 'HI';
  const now = Date.now();

  const req = request;
  const m = match;

  const badge = (() => {
    if (!req || !m) return { label: '', cls: '' };
    if (req.status === 'cancelled') return { label: isHi ? 'रद्द' : 'Cancelled', cls: 'bg-ink-100 text-ink-600 border-ink-200' };
    if (req.status === 'expired' || (req.expires_at && new Date(req.expires_at).getTime() < now)) return { label: isHi ? 'समाप्त' : 'Expired', cls: 'bg-ink-100 text-ink-500 border-ink-200' };
    if (m.donor_response === 'declined') return { label: isHi ? 'अस्वीकार' : 'Declined', cls: 'bg-ink-50 text-ink-500 border-ink-200' };
    if (m.donor_response === 'timed_out') return { label: isHi ? 'समय समाप्त' : 'Timed Out', cls: 'bg-ink-50 text-ink-500 border-ink-200' };
    if (m.donor_response === 'approved') return { label: t.donorDashboard.acceptedChip, cls: 'bg-blood-50 text-blood-700 border-blood-200' };
    return { label: isHi ? 'कार्रवाई आवश्यक' : 'Action Required', cls: 'bg-blood-50 text-blood-700 border-blood-200' };
  })();

  const isPending = !!m && m.donor_response === 'pending';
  const isApproved = !!m && m.donor_response === 'approved';
  // Requester contact + patient PII are only ever present when the backend approved+shares (own match approved).
  const contactShared = isApproved && !!req?.requester_phone;

  // Real persisted timeline states only.
  const isMatching = !!req && ['open', 'broadcasting', 'matching'].includes(req.status);
  const isConfirmed = !!req && req.status === 'partially_matched';
  const isFulfilled = !!req && req.status === 'fulfilled';
  const isCompleted = !!m && m.outcome === 'donated';
  const responded = !!m && m.donor_response !== 'pending';

  const stepStates = [true, isMatching, responded, isConfirmed, isFulfilled, isCompleted];
  const steps = [
    { label: t.donorDashboard.stepRequestCreated, at: formatDt(req?.created_at, isHi) },
    { label: t.donorDashboard.stepLiveMatching, at: isMatching ? formatDt(req?.created_at, isHi) : '' },
    { label: t.donorDashboard.stepDonorResponded, at: formatDt(m?.donor_response_at, isHi) },
    { label: t.donorDashboard.stepMatchConfirmed, at: '' },
    { label: t.donorDashboard.stepRequestFulfilled, at: formatDt(req?.fulfilled_at, isHi) },
    { label: t.donorDashboard.stepDonationCompleted, at: formatDt(m?.outcome_confirmed_at, isHi) },
  ];

  if (!m || !req) return null;

  const hospitalCoords = getCoordinates(req.hospital_pincode);
  const donorCoords = currentUser?.pincode ? getCoordinates(currentUser.pincode) : undefined;
  const mapQuery = encodeURIComponent(`${req.hospital_name}, ${req.hospital_area}, ${req.hospital_city}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
  const trackUrl = `/track/${req.tracking_code}?role=donor&matchToken=${m.matchToken || m.id || ''}`;
  const waUrl = `https://wa.me/${String(req.requester_phone).replace(/\D/g, '')}`;

  return (
    <AnimatePresence>
      <motion.div
        key="rdd-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[80] bg-ink-950/60 sm:bg-ink-950/40"
        aria-hidden="true"
      />
      <motion.aside
        key="rdd-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t.donorDashboard.requestDetails}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.28, ease: 'easeInOut' }}
        className="fixed right-0 top-0 bottom-0 z-[90] flex h-full w-full flex-col border-l border-ink-200 bg-white sm:w-[26rem]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] font-bold tracking-tight text-ink-700">{req.tracking_code}</span>
              <span className={`inline-flex items-center whitespace-nowrap border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
            <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-ink-900">
              {req.blood_type_needed} {isHi ? 'रक्त की आवश्यकता' : 'blood needed'}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t.donorDashboard.close}
            className="grid h-9 w-9 shrink-0 place-items-center border border-ink-200 bg-white text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-6 min-w-0">
          {/* Details grid */}
          <section className="grid grid-cols-2 gap-3 min-w-0">
            <div className="border border-ink-100 bg-ink-50 p-3 min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500">
                <Droplet className="h-3.5 w-3.5 text-blood-400" /> {t.donorDashboard.bloodGroup}
              </div>
              <div className="mt-1 text-[15px] font-bold text-ink-900">{req.blood_type_needed}</div>
            </div>
            <div className="border border-ink-100 bg-ink-50 p-3 min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500">
                <Clock className="h-3.5 w-3.5 text-ink-400" /> {t.donorDashboard.units}
              </div>
              <div className="mt-1 text-[15px] font-bold text-ink-900">{req.units_required}</div>
            </div>
            {req.component_needed && (
              <div className="col-span-2 border border-ink-100 bg-ink-50 p-3 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500">{t.donorDashboard.componentLabel}</div>
                <div className="mt-1 text-[13px] font-semibold text-ink-900 break-words">{req.component_needed}</div>
              </div>
            )}
            <div className="col-span-2 border border-ink-100 bg-ink-50 p-3 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500">{t.donorDashboard.urgency} • {t.donorDashboard.location}</div>
              <div className="mt-1 text-[13px] font-semibold text-ink-900 break-words">{req.hospital_name}, {req.hospital_area}, {req.hospital_city}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-500">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-ink-400" />
                  {m.distance_km ? `${m.distance_km} ${t.donorDashboard.kmAway}` : (isHi ? 'आस-पास' : 'Nearby')}
                </span>
                <span className="inline-flex items-center gap-1 font-bold uppercase text-[11px] text-blood-600">
                  <Clock className="h-3.5 w-3.5" /> {req.urgency_level.toUpperCase()}
                </span>
              </div>
            </div>
          </section>

          {/* Patient + requester contact (backend-gated) */}
          <section className="border border-ink-100 bg-white min-w-0">
            {contactShared ? (
              <div className="p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-blood-700">
                  <Check className="h-4 w-4" /> {t.donorDashboard.contactRequester}
                </div>
                {req.requester_name && (
                  <div className="mt-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">{t.donorDashboard.requesterName}</div>
                    <div className="text-[14px] font-semibold text-ink-900">{req.requester_name}</div>
                  </div>
                )}
                <div className="mt-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">{t.donorDashboard.patientLabel}</div>
                  <div className="text-[14px] font-semibold text-ink-900">
                    {req.patient_name || '—'}
                    {req.patient_age || req.patient_gender
                      ? <span className="font-normal text-ink-500"> • {req.patient_age ? `${req.patient_age}${isHi ? ' वर्ष' : 'Y'}` : ''}{req.patient_gender ? ` / ${req.patient_gender}` : ''}</span>
                      : null}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <a
                    href={`tel:${req.requester_phone}`}
                    className="flex min-h-[44px] items-center justify-center gap-2 border border-ink-300 bg-white text-[13px] font-semibold text-ink-800 transition-colors hover:bg-ink-50 cursor-pointer"
                  >
                    <Phone className="h-4 w-4 text-ink-600" /> {t.donorDashboard.callRequester}
                  </a>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-[44px] items-center justify-center gap-2 bg-whatsapp text-[13px] font-semibold text-white transition-colors hover:bg-whatsapp/90 cursor-pointer"
                  >
                    <MessageSquare className="h-4 w-4" /> {t.donorDashboard.whatsappRequester}
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink-200 bg-ink-50 text-ink-400">
                    <Phone className="h-4 w-4" />
                  </span>
                  {t.donorDashboard.contactRequester}
                </div>
                {isPending ? (
                  <p className="mt-2.5 text-[12px] leading-relaxed text-ink-500">
                    {isHi ? 'स्वीकार करने पर अनुरोधकर्ता का संपर्क विवरण मिल जाएगा।' : 'Accept the request below to unlock the requester contact.'}
                  </p>
                ) : (
                  <p className="mt-2.5 text-[12px] leading-relaxed text-ink-500">
                    {isHi ? 'संपर्क जानकारी उपलब्ध नहीं है।' : 'Contact information is not available for this request.'}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Location */}
          <section className="min-w-0 space-y-2.5">
            <h4 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-ink-700">
              <MapPin className="h-4 w-4 text-blood-400" /> {t.donorDashboard.location}
            </h4>
            <HospitalMap
              hospitalLat={hospitalCoords.lat}
              hospitalLng={hospitalCoords.lng}
              hospitalName={req.hospital_name}
              donorLat={donorCoords?.lat}
              donorLng={donorCoords?.lng}
              distanceKm={m.distance_km}
            />
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] items-center justify-center gap-2 border border-ink-200 bg-white text-[13px] font-semibold text-ink-800 transition-colors hover:bg-ink-50 cursor-pointer"
            >
              <ExternalLink className="h-4 w-4" /> {t.donorDashboard.openInMap}
            </a>
          </section>

          {/* Timeline */}
          <section className="min-w-0">
            <h4 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-ink-700">
              <Calendar className="h-4 w-4 text-blood-400" /> {t.donorDashboard.timeline}
            </h4>
            <ol className="mt-3 space-y-0 min-w-0">
              {steps.map((step, i) => {
                const reached = stepStates.slice(i).some(Boolean);
                return (
                  <li key={i} className="relative flex gap-3 pb-4 last:pb-0 min-w-0">
                    <div className="flex flex-col items-center">
                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${reached ? 'border-blood-500 bg-blood-500 text-white' : 'border-ink-200 bg-white text-ink-300'}`}>
                        {reached ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-ink-300" />}
                      </span>
                      {i < steps.length - 1 && (
                        <span className={`w-px flex-1 ${reached ? 'bg-blood-300' : 'bg-ink-100'}`} />
                      )}
                    </div>
                    <div className="min-w-0 pb-0.5">
                      <div className={`text-[13px] font-semibold ${reached ? 'text-ink-900' : 'text-ink-400'}`}>{step.label}</div>
                      {step.at ? <div className="text-[11px] text-ink-500">{step.at}</div> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        {/* Footer actions */}
        <div
          className="border-t border-ink-100 bg-white px-5 pt-4 sm:px-6 space-y-2 min-w-0"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          {isPending ? (
            <>
              <button
                id="btn-rdd-donate"
                onClick={() => onDecision(m.id!, 'approved')}
                disabled={loadingMatchId === m.id}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 bg-blood-600 text-[13px] font-bold text-white transition-colors hover:bg-blood-700 active:bg-blood-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingMatchId === m.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Heart className="h-4 w-4" />}
                {t.donorDashboard.iCanDonate}
              </button>
              <button
                id="btn-rdd-pass"
                onClick={() => onDecision(m.id!, 'declined')}
                disabled={loadingMatchId === m.id}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 border border-ink-300 bg-white text-[13px] font-semibold text-ink-700 transition-colors hover:border-ink-900 hover:bg-ink-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.donorDashboard.pass}
              </button>
            </>
          ) : (
            isApproved && (
              <div className="flex items-center justify-between gap-2 border border-blood-100 bg-blood-50 px-3 py-2.5 min-w-0">
                <span className="flex items-center gap-2 text-[12px] font-semibold text-blood-700 min-w-0">
                  <Check className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t.donorDashboard.acceptedChip}</span>
                </span>
              </div>
            )
          )}
          <div className="flex flex-col sm:flex-row gap-2 min-w-0">
            <a
              href={trackUrl}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 border border-ink-200 bg-ink-50 text-[13px] font-semibold text-ink-800 transition-colors hover:bg-ink-100 cursor-pointer"
            >
              {t.donorDashboard.trackMatch}
              <ArrowRight className="h-4 w-4" />
            </a>
            {!isPending && (
              <button
                id="btn-rdd-close"
                onClick={onClose}
                className="flex min-h-[44px] items-center justify-center gap-2 border border-ink-300 bg-white px-4 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-ink-50 cursor-pointer"
              >
                {t.donorDashboard.close}
              </button>
            )}
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
