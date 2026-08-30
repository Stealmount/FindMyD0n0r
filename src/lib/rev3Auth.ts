// Rev 3 frontend auth client — thin typed wrappers over the frozen backend contract.
// Slices 1–5 all talk through these helpers so the API surface stays in one place
// and the components stay declarative.
import { signInWithPopup, signOut, signInWithCustomToken } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { ApiError } from './api';
import { resolveToken } from './authToken';
import type { Profile, DonorProfile, Institution, User } from '../types';

export type Rev3NextStep = 'basic' | 'intent' | 'complete' | 'contact' | 'donor-profile';

export interface Rev3Me {
  authUser: { id: string; email: string | null; provider: string | null };
  profile: Profile | null;
  donorProfile: DonorProfile | null;
  institution: Institution | null;
  nextStep: Rev3NextStep;
}

// ── Raw fetch helpers ─────────────────────────────────────────────────────────
async function postJson(path: string, body: unknown, token?: string, method: 'POST' | 'PATCH' = 'POST') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { method, headers, body: JSON.stringify(body) });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = payload.error || payload.message || 'Request failed. Please try again.';
    throw new ApiError(message, res.status, payload.code, payload.details);
  }
  return payload as any;
}

async function getJson(path: string, token: string) {
  const res = await fetch(path, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = payload.error || payload.message || 'Request failed. Please try again.';
    throw new ApiError(message, res.status, payload.code, payload.details);
  }
  return payload as any;
}

// Resolve the current Firebase ID token. Throws (locally, before any network
// request) when there is no authenticated Firebase user — so authenticated
// helpers never send a deliberately headerless request.
function getToken(): Promise<string> {
  return resolveToken(auth.currentUser);
}

// ── Google flow ───────────────────────────────────────────────────────────
export async function googleSignIn() {
  await signInWithPopup(auth, googleProvider);
}

/** Ensure a Google identity has a profile + link. Called after popup sign-in. */
export async function completeGoogle(email: string, fullName: string, intent?: 'donor' | 'requester') {
  const token = await getToken();
  const body: Record<string, unknown> = { email, fullName };
  if (intent) body.intent = intent;
  return postJson('/api/auth/complete-verification', body, token) as Promise<{
    profile?: Profile | null;
    donorProfile?: DonorProfile | null;
    isNewUser?: boolean;
    nextStep?: Rev3NextStep;
  }>;
}

// ── Session / me (all slices) ─────────────────────────────────────────────
let inFlightPromise: Promise<Rev3Me> | null = null;
export async function fetchMe() {
  if (inFlightPromise) return inFlightPromise;
  const promise = (async () => {
    const token = await getToken();
    return getJson('/api/auth/me', token) as Promise<Rev3Me>;
  })();
  inFlightPromise = promise;
  // Reset the memo ref on both outcomes WITHOUT a detached derived promise.
  // promise.finally(...) propagates a rejection to an unheld derived promise,
  // producing "Uncaught (in promise) ApiError". .then(onOk, onErr) with both
  // handlers returns a promise that always fulfills, so nothing leaks.
  void promise.then(
    () => { inFlightPromise = null; },
    () => { inFlightPromise = null; }
  );
  return promise;
}

// TODO(Phase6):
// Remove legacy compatibility layer after frontend cutover is complete.
/**
 * Map a Rev 3 /me payload onto the legacy dashboard shapes (User / Requester /
 * HospitalUser) so the existing donor/requester/hospital dashboards keep
 * working until the Phase 6 cleanup removes them.
 */
export function toLegacy(me: Rev3Me) {
  const { authUser, profile, donorProfile, institution } = me;
  if (institution) {
    return {
      institution,
      donor: null,
      requester: null,
    } as const;
  }
  // Intent is authoritative (Part A split). No intent ⇒ default to donor, and a
  // legacy dual-flag account with no intent resolves as a donor (never both).
  const intent = profile?.intent;
  const isDonor = intent ? intent === 'donor' : !!profile?.can_donate;
  const isRequester = intent ? intent === 'requester' : (!!profile?.can_request && !profile?.can_donate);

  const donorObj = isDonor ? {
    id: authUser.id,
    full_name: profile?.full_name || '',
    email: profile?.email || '',
    phone: profile?.phone || null,
    whatsapp_number: profile?.whatsapp_phone || null,
    blood_type: (donorProfile?.blood_group as User['blood_type']) || 'O+',
    donation_frequency: 'first_time',
    last_donation_date: donorProfile?.last_donation_date || null,
    cooldown_until: donorProfile?.cooldown_until || null,
    pincode: donorProfile?.pincode || '',
    area: donorProfile?.area || '',
    city: donorProfile?.city || '',
    weight_kg: (donorProfile as any)?.weight_kg ?? null,
    availability_status: donorProfile?.is_available ? 'available' : 'unavailable',
    number_sharing_pref: 'on_approval',
    emergency_only: donorProfile?.emergency_only || false,
    account_status: 'active',
    whatsapp_verified: profile?.whatsapp_verified || false,
    profile_complete: donorProfile?.profile_complete,
    is_available: donorProfile?.is_available,
    created_at: profile?.created_at || new Date().toISOString(),
    updated_at: profile?.updated_at || new Date().toISOString(),
  } : null;

  const requesterObj = isRequester ? {
    id: authUser.id,
    full_name: profile?.full_name || '',
    email: profile?.email || '',
    phone: profile?.phone || null,
    whatsapp_number: profile?.whatsapp_phone || null,
    created_at: profile?.created_at || new Date().toISOString(),
    updated_at: profile?.updated_at || new Date().toISOString(),
  } : null;

  return {
    institution: null,
    donor: donorObj,
    requester: requesterObj,
  };
}

export async function rev3Logout() {
  try {
    const token = await getToken();
    void fetch('/api/account/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch { /* non-blocking */ }
  await signOut(auth);
}

// ── Onboarding (Slice 2) ──────────────────────────────────────────────────
export function submitBasic(payload: {
  fullName?: string;
  whatsappPhone?: string;
  pincode?: string;
  city?: string;
  district?: string;
  state?: string;
  area?: string;
  notificationChannel?: 'whatsapp' | 'email' | 'both';
  verifyLater?: boolean;
}) {
  return postAuth('/api/onboarding/basic', payload);
}
export function submitIntent(payload: {
  intent: 'donor' | 'requester';
  bloodGroup?: string;
  isAvailable?: boolean;
  healthSelfDeclaration?: boolean;
}) {
  return postAuth('/api/onboarding/intent', payload);
}
export function completionWizard() {
  return postAuth('/api/onboarding/completion-wizard', {});
}

/** Resolve a profile that has no intent yet (legacy / edge case). Sets exclusive roles. */
export function saveOnboardingIntent(intent: 'donor' | 'requester') {
  return postAuth('/api/auth/complete-verification', { intent });
}

// ── Account settings ──────────────────────────────────────────────────────
export function exportAccount() {
  return getAuth('/api/account/export');
}

// ── Institutions (Slice 5) ─────────────────────────────────────────────────
export function myInstitutions() {
  return getAuth('/api/institutions/me');
}
export function registerInstitution(payload: Record<string, unknown>) {
  return postAuth('/api/institutions/register', payload);
}

/** Part C: update contact fields on the institution the profile is linked to. */
export function updateInstitution(payload: {
  contactPerson?: string;
  phone?: string;
  address?: string;
  city?: string;
  pincode?: string;
}) {
  return patchAuth('/api/institutions/me', payload);
}

// ── Institutions (Part B: 10-digit password sign-in) ─────────────────────────
/**
 * POST /api/institutions/login — no Firebase session required. Returns a
 * Firebase custom token for the linked auth identity; exchange it with
 * completeInstitutionLogin() so the standard /api/auth/me session resolves.
 */
export function institutionLogin(email: string, password: string) {
  return postJson('/api/institutions/login', { email, password }) as Promise<{
    success: boolean;
    customToken: string;
    institution?: Institution | null;
  }>;
}

/** Exchange a custom token from institutionLogin() for a real Firebase session. */
export async function completeInstitutionLogin(customToken: string) {
  await signInWithCustomToken(auth, customToken);
}

// ── Internal: protected POST/GET ───────────────────────────────────────────
async function postAuth(path: string, body: unknown) {
  const token = await getToken();
  return postJson(path, body, token);
}
async function getAuth(path: string) {
  const token = await getToken();
  return getJson(path, token);
}
async function patchAuth(path: string, body: unknown) {
  const token = await getToken();
  return postJson(path, body, token, 'PATCH');
}
