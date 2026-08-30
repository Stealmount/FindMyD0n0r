import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Droplets,
  Clock,
  MapPin,
  AlertTriangle,
  Lock,
  ExternalLink,
  Copy,
  CheckCircle,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface PublicRequest {
  id: string;
  code: string;
  blood_group: string;
  units_needed: number;
  patient_age: number | null;
  urgency: string;
  status: string;
  hospital_pincode: string;
  hospital_city: string;
  created_at: string;
  hospital_name?: string;
  hospital_area?: string;
}

interface PublicRequestViewProps {
  requestId: string;
}

const STATUS_LABELS: Record<string, { en: string; hi: string; color: string }> = {
  open: { en: 'Open', hi: 'खुला', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  matching: { en: 'Matching Donors', hi: 'दाता खोज रहे', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  broadcasting: { en: 'Broadcasting', hi: 'प्रसारण जारी', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  partially_matched: { en: 'Partially Matched', hi: 'आंशिक मिलान', color: 'bg-vital-50 text-vital-700 border-vital-200' },
  fulfilled: { en: 'Fulfilled', hi: 'पूर्ण', color: 'bg-vital-50 text-vital-700 border-vital-200' },
  cancelled: { en: 'Cancelled', hi: 'रद्द', color: 'bg-ink-100 text-ink-600 border-ink-200' },
  expired: { en: 'Expired', hi: 'समय सीमा समाप्त', color: 'bg-ink-100 text-ink-600 border-ink-200' },
};

const URGENCY_COLORS: Record<string, string> = {
  critical: 'bg-blood-50 text-blood-700 border-blood-200',
  urgent: 'bg-amber-50 text-amber-700 border-amber-200',
  planned: 'bg-ink-100 text-ink-600 border-ink-200',
};

export default function PublicRequestView({ requestId }: PublicRequestViewProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';

  const [request, setRequest] = useState<PublicRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/requests/public/${encodeURIComponent(requestId)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.request) {
          setError(data.error || (isHi ? 'अनुरोध नहीं मिला।' : 'Request not found.'));
        } else {
          setRequest(data.request);
        }
      } catch {
        if (!cancelled) setError(isHi ? 'लोड करने में विफल।' : 'Failed to load request.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [requestId, isHi]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-8 h-8 border-2 border-blood-500/30 border-t-blood-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-ink-500 mt-4 font-medium">{isHi ? 'लोड हो रहा है…' : 'Loading…'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="bg-blood-50 border border-blood-200 p-6">
          <AlertTriangle className="w-8 h-8 text-blood-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-blood-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!request) return null;

  const statusInfo = STATUS_LABELS[request.status] || STATUS_LABELS.open;
  const urgencyColor = URGENCY_COLORS[request.urgency] || URGENCY_COLORS.planned;
  const postedAgo = getRelativeTime(request.created_at);

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">

      {/* Header */}
      <div className="bg-white border border-ink-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center bg-blood-600 text-white">
              <Droplets className="w-7 h-7 font-display text-white" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-blood-700">
                {request.blood_group}
              </h1>
              <p className="text-xs text-ink-500 font-medium mt-0.5">
                {isHi ? 'रक्त समूह' : 'Blood Group'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold border ${statusInfo.color}`}>
              {statusInfo[isHi ? 'hi' : 'en']}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold border ${urgencyColor}`}>
              {request.urgency}
            </span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white border border-ink-200 p-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <DetailCell
            label={isHi ? 'यूनिट' : 'Units Needed'}
            value={String(request.units_needed)}
          />
          {request.patient_age != null && (
            <DetailCell
              label={isHi ? 'मरीज़ की आयु' : 'Patient Age'}
              value={`${request.patient_age} yrs`}
            />
          )}
          <DetailCell
            label={isHi ? 'शहर' : 'City'}
            value={request.hospital_city}
          />
          <DetailCell
            label={isHi ? 'पिनकोड' : 'Pincode'}
            value={request.hospital_pincode}
          />
          <DetailCell
            label={isHi ? 'पोस्ट किया गया' : 'Posted'}
            value={postedAgo}
            icon={<Clock className="w-3.5 h-3.5 text-ink-400" />}
          />
        </div>
      </div>

      {/* Tracking Code */}
      <div className="bg-white border border-ink-200 p-6">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-1">
          {isHi ? 'ट्रैकिंग कोड' : 'Tracking Code'}
        </span>
        <p className="text-lg font-extrabold font-mono tracking-wider text-ink-900">
          {request.code}
        </p>
      </div>

      {/* Hospital details — gated by auth */}
      {request.hospital_name ? (
        <div className="bg-white border border-ink-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-vital-600" />
            <span className="text-xs font-semibold text-vital-700 uppercase tracking-wider">
              {isHi ? 'अस्पताल विवरण' : 'Hospital Details'}
            </span>
          </div>
          <p className="text-sm font-bold text-ink-900">{request.hospital_name}</p>
          {request.hospital_area && (
            <p className="text-xs text-ink-500 font-medium mt-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-ink-400" />
              {request.hospital_area}, {request.hospital_city}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-ink-50 border border-ink-200 p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center bg-ink-100">
              <Lock className="w-5 h-5 text-ink-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-700">
                {isHi ? 'अस्पताल विवरण लॉक है' : 'Hospital details are locked'}
              </p>
              <Link
                to="/auth/signin"
                className="text-xs font-semibold text-blood-600 hover:text-blood-700 inline-flex items-center gap-1 mt-0.5 transition-colors"
              >
                {isHi ? 'साइन इन करें' : 'Sign in to view'}
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* CTA row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to={`/track/${encodeURIComponent(request.code)}`}
          className="flex-1 py-3 px-4 bg-ink-900 hover:bg-black text-white font-semibold text-sm text-center transition-all"
        >
          {isHi ? 'इस अनुरोध को ट्रैक करें' : 'Track this request'}
        </Link>
        <button
          onClick={handleCopyLink}
          className="py-3 px-4 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700 font-semibold text-sm flex items-center justify-center gap-2 transition-all"
        >
          {copied ? (
            <>
              <CheckCircle className="w-4 h-4 text-vital-600" />
              {isHi ? 'कॉपी हो गया!' : 'Copied!'}
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              {isHi ? 'लिंक कॉपी करें' : 'Copy Link'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function DetailCell({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block mb-0.5">
        {label}
      </span>
      <p className="text-sm font-bold text-ink-900 flex items-center gap-1.5">
        {icon}
        {value}
      </p>
    </div>
  );
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
