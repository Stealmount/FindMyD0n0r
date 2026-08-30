import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { auth } from './firebase';
import { authenticatedApi } from './api';
import { toLegacy } from './rev3Auth';
import { beginResolution, isCurrentResponse, isResolvableMe } from './authSession';
import type { User as DonorUser, Requester, HospitalUser, Institution, AdminUser, AuthState } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Institution row → HospitalUser view-model. */
export function institutionToHospitalUser(inst: Institution): HospitalUser {
  return {
    id: inst.id,
    institution_type: inst.type,
    hospital_name: inst.org_name,
    registration_number: inst.registration_number,
    admin_name: inst.contact_person,
    email: inst.email,
    phone: inst.phone,
    address: inst.address,
    pincode: inst.pincode,
    city: inst.city,
    status: inst.verification_status,
    created_at: inst.created_at,
    updated_at: inst.updated_at,
  };
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface AuthContextValue {
  loggedInUser: DonorUser | null;
  loggedInRequester: Requester | null;
  loggedInHospital: HospitalUser | null;
  loggedInAdmin: AdminUser | null;
  loggedInInstitution: Institution | null;
  sessionLoading: boolean;

  // Setters — for components that receive auth callbacks (AuthHub, dashboards)
  setLoggedInUser: (u: DonorUser | null) => void;
  setLoggedInRequester: (r: Requester | null) => void;
  setLoggedInHospital: (h: HospitalUser | null) => void;
  setLoggedInAdmin: (a: AdminUser | null) => void;
  setLoggedInInstitution: (i: Institution | null) => void;

  // High-level actions
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loggedInUser, setLoggedInUser] = useState<DonorUser | null>(null);
  const [loggedInRequester, setLoggedInRequester] = useState<Requester | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loggedInHospital, setLoggedInHospital] = useState<HospitalUser | null>(null);
  const [loggedInAdmin, setLoggedInAdmin] = useState<AdminUser | null>(null);
  const [loggedInInstitution, setLoggedInInstitution] = useState<Institution | null>(null);
  const lastResolvedUserIdRef = useRef<string | null>(null);
  const authRequestSeqRef = useRef(0);

  // Clear every role/identity slot — used on explicit logout and whenever
  // Firebase reports a null session (external sign-out, token/account revoked,
  // another tab). Prevents stale donor/requester/institution/admin state from
  // leaking into a future login.
  const clearAllAuthState = () => {
    setLoggedInUser(null);
    setLoggedInRequester(null);
    setLoggedInHospital(null);
    setLoggedInInstitution(null);
    setLoggedInAdmin(null);
  };

  async function handleAuthUser(authUser?: FirebaseUser, forceRefresh = false) {
    if (!authUser) return;
    // Begin a resolution request. If the same uid is already FULLY resolved (a
    // real donor/requester/institution was produced) and we aren't forcing,
    // skip — prevents a duplicate /api/auth/me per uid. Otherwise bump the
    // sequence so stale in-flight responses can never overwrite newer state.
    const { seq, proceeded } = beginResolution(
      authRequestSeqRef.current,
      lastResolvedUserIdRef.current,
      authUser.uid,
      forceRefresh
    );
    if (!proceeded) return;
    authRequestSeqRef.current = seq;

    try {
      const authState = await authenticatedApi<AuthState & { institution?: Institution | null }>(
        '/api/auth/me', undefined, 'GET'
      );

      // Stale guard: an older in-flight response (lower seq) must never write
      // auth state — e.g. a pre-provisioning profile:null arriving AFTER a
      // newer resolution already produced the populated profile.
      if (!isCurrentResponse(authRequestSeqRef.current, seq)) return;

      if (authState.institution) {
        setLoggedInInstitution(authState.institution);
        setLoggedInHospital(institutionToHospitalUser(authState.institution));
      } else {
        // No institution for the current identity — clear any stale hospital
        // state so a prior institutional session can't bleed into a
        // donor/requester resolution.
        setLoggedInInstitution(null);
        setLoggedInHospital(null);
      }

      // Donor/requester are resolved from `intent` via toLegacy() — the single
      // authoritative role-resolution path. Roles are strictly mutually
      // exclusive: a donor sets requester=null and vice-versa (never both).
      // If the identity is institution-linked, toLegacy() yields neither, so
      // donor/requester state is cleared (institutional is a separate path).
      const me = authState as unknown as Parameters<typeof toLegacy>[0];
      const legacyResolver = toLegacy(me);
      if (legacyResolver.donor) {
        setLoggedInUser(legacyResolver.donor);
        setLoggedInRequester(null);
      } else {
        setLoggedInUser(null);
        setLoggedInRequester(legacyResolver.requester);
      }

      // INVARIANT: only a RESOLVABLE outcome (donor / requester / institution)
      // marks the UID as fully resolved. A pre-provisioning profile:null must
      // NOT — otherwise the same UID could never resolve again after
      // complete-verification provisions the profile.
      if (isResolvableMe(me)) {
        lastResolvedUserIdRef.current = authUser.uid;
      }
    } catch {
      console.warn('[Auth] /api/auth/me failed, session may have expired');
      if (isCurrentResponse(authRequestSeqRef.current, seq) && !forceRefresh) {
        lastResolvedUserIdRef.current = null;
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    const resolveAndFinish = async (user: FirebaseUser | null) => {
      if (user) await handleAuthUser(user);
      else clearAllAuthState();
      if (!cancelled) setSessionLoading(false);
    };
    // Wait for the initial Firebase bootstrap (session restoration) to finish
    // BEFORE registering the observer. onAuthStateChanged then becomes the
    // SINGLE trigger that resolves the initial auth state and every subsequent
    // change. There is no separate manual initial-resolution path, so
    // /api/auth/me can never run before Firebase bootstrap is ready, and there
    // is no duplicate initial trigger.
    const unsubRef = { current: () => {} };
    void (async () => {
      await auth.authStateReady();
      if (cancelled) return;
      unsubRef.current = onAuthStateChanged(auth, (user) => {
        void resolveAndFinish(user);
      });
    })();

    return () => {
      cancelled = true;
      unsubRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    try {
      lastResolvedUserIdRef.current = null;
      await signOut(auth);
    } catch (error) {
      console.error('Firebase signOut failed:', error);
    }
    clearAllAuthState();
  };

  const refreshSession = async () => {
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);
      await handleAuthUser(auth.currentUser, true);
    }
  };

  return (
    <AuthContext.Provider value={{
      loggedInUser,
      loggedInRequester,
      loggedInHospital,
      loggedInAdmin,
      loggedInInstitution,
      sessionLoading,
      setLoggedInUser,
      setLoggedInRequester,
      setLoggedInHospital,
      setLoggedInAdmin,
      setLoggedInInstitution,
      logout,
      refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useAuth() — consume auth state and actions anywhere in the component tree
 * without prop drilling.
 *
 * Must be used inside <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>');
  return ctx;
}
