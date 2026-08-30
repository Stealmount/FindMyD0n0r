import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuth } from './lib/firebase';
import RequestForm from './components/RequestForm';
import RequestTracking from './components/RequestTracking';
import DonorDashboard from './components/DonorDashboard';
import DonorProfileSettings from './components/DonorDashboard/DonorProfileSettings';
import RequesterPortal from './components/RequesterPortal';
import ErrorBoundary from './components/ErrorBoundary';
import { Rev3AuthScreen } from './components/rev3/Rev3AuthScreen';
import AuthIntentSelector from './components/AuthHub/AuthIntentSelector';
import { DonorOnboardingWizard } from './components/rev3/DonorOnboardingWizard';
import { RequesterOnboardingWizard } from './components/rev3/RequesterOnboardingWizard';
import { OnboardingRoleGate } from './components/rev3/OnboardingRoleGate';
import NotificationSimulator from './components/NotificationSimulator';
import { FindMyDonorHome } from './components/home/FindMyDonorHome';
import { Navbar } from './components/home/Navbar';
import { MobileBottomNav } from './components/home/MobileBottomNav';
import { HospitalRegistration } from './components/hospital/HospitalRegistration';
import { InstitutionLogin } from './components/hospital/InstitutionLogin';
import { HospitalDashboard } from './components/hospital/HospitalDashboard';
const AdminLogin = React.lazy(()=>import('./components/admin/AdminLogin').then(m=>({default:m.AdminLogin})));
const AdminConsole = React.lazy(()=>import('./components/admin/AdminConsole').then(m=>({default:m.AdminConsole})));
import { BloodBankDirectory } from './components/BloodBankDirectory';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { TermsOfService } from './components/TermsOfService';
import { FAQPage } from './components/FAQPage';
import { CityDonorDirectory } from './components/CityDonorDirectory';
import { BloodCompatibilityPage } from './components/BloodCompatibilityPage';
import { GuidesPage } from './components/GuidesPage';
import { SupportPage } from './components/SupportPage';
import PublicRequestView from './components/PublicRequestView';
import { LanguageProvider } from './lib/LanguageContext';
import { useAuth, institutionToHospitalUser } from './lib/AuthContext';
import { fetchMe, toLegacy, saveOnboardingIntent } from './lib/rev3Auth';

// View → path mapping. Components still call onNavigate(view) — nav() bridges it
// to react-router navigate(). Added as Task 4.1; kept here for reference.
const ADMIN_EMAIL = import.meta.env?.VITE_ADMIN_EMAIL || 'admin@findmydonor.online';

const VIEW_PATHS: Record<string, string> = {
  'home': '/',
  'request': '/request',
  'tracking': '/track',
  'donor-register': '/auth/donor-register',
  'requester-register': '/auth/requester-register',
  'auth-signin': '/auth/signin',
  'auth-signup': '/auth/signup',
  'hospital-register': '/hospital/register',
  'hospital-dashboard': '/hospital/dashboard',
  'institution-register': '/institution/register',
  'institution-signup': '/institution/signup',
  'institution-login': '/institution/login',
  'institution-dashboard': '/institution/dashboard',
  'admin-login': '/admin/login',
  'admin-dashboard': '/admin/dashboard',
  'admin': '/admin/login',
  'blood-banks': '/blood-banks',
  'privacy': '/privacy',
  'terms': '/terms',
  'faq': '/faq',
  'donors': '/donors',
  'blood-compatibility': '/blood-compatibility',
  'guides': '/guides',
  'support': '/support',
  'donor-dashboard': '/donor-dashboard',
  'donor-profile': '/donor/profile',
  'requester-portal': '/requester-portal',
  'landing': '/',
};

export default function App() {
  return (
    <LanguageProvider>
      <AppRoutes />
    </LanguageProvider>
  );
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="h-8 w-8 rounded-full border-2 border-blood-600/30 border-t-blood-600 animate-spin" />
    </div>
  );
}

// ── Routes ────────────────────────────────────────────────────────────────────

function AppRoutes() {
  const navigate = useNavigate();
  const auth = useAuth();

  // Firebase auth state — track whether a Firebase admin user is signed in.
  const [firebaseAdmin, setFirebaseAdmin] = useState(false);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setFirebaseAdmin(!!user && user.email === ADMIN_EMAIL);
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Legacy ?view=X / ?code=CODE URL redirect (WhatsApp links, old bookmarks).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const codeParam = params.get('code');
    if (viewParam && VIEW_PATHS[viewParam]) {
      const target = viewParam === 'tracking' && codeParam
        ? `/track/${encodeURIComponent(codeParam)}`
        : VIEW_PATHS[viewParam];
      navigate(target, { replace: true });
    }
  }, [navigate]);

  // Keep the onNavigate prop pattern — just call navigate() internally.
  const nav = (view: string, _pushHistory?: boolean, code?: string) => {
    const target = VIEW_PATHS[view] ?? '/';
    if (view === 'tracking' && code) {
      navigate(`/track/${encodeURIComponent(code)}`);
    } else {
      navigate(target);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { loggedInUser, loggedInRequester, loggedInHospital, loggedInAdmin, sessionLoading } = auth;

  return (
    <Routes>
      <Route path="/" element={<HomeView nav={nav} />} />

      <Route path="/request" element={
        <AppShell nav={nav} activeView="request">
          <ErrorBoundary fallbackMessage="The request form hit an unexpected error. Please try again.">
            {loggedInUser && !loggedInRequester ? (
              <Navigate to="/donor-dashboard" replace />
            ) : (
              <RequestForm
                onSuccess={(code) => nav('tracking', true, code)}
                loggedInRequester={loggedInRequester}
                onNavigate={nav}
              />
            )}
          </ErrorBoundary>
        </AppShell>
      } />

      <Route path="/track" element={
        <AppShell nav={nav} activeView="tracking">
          <TrackingView />
        </AppShell>
      } />

      <Route path="/track/:code" element={
        <AppShell nav={nav} activeView="tracking">
          <TrackingView />
        </AppShell>
      } />

      <Route path="/request/:requestId" element={
        <AppShell nav={nav} activeView="request">
          <PublicRequestView requestId={useParams<{ requestId: string }>().requestId!} />
        </AppShell>
      } />

      <Route path="/donor-dashboard" element={
        (loggedInRequester && !loggedInUser) ? (
          <Navigate to="/requester-portal" replace />
        ) : (
          <AppShell nav={nav} activeView="donor-dashboard">
            {sessionLoading ? (
              <LoadingScreen />
            ) : (
              <ErrorBoundary fallbackMessage="The donor dashboard hit an unexpected error. Your data is safe.">
                <DonorDashboard
                  currentUser={loggedInUser}
                  onLoginSuccess={(donor) => { auth.setLoggedInUser(donor); nav('donor-dashboard'); }}
                  onLogout={auth.logout}
                  onGoogleRegisterRedirect={() => navigate('/auth/donor-register')}
                  onNavigate={nav}
                />
              </ErrorBoundary>
            )}
          </AppShell>
        )
      } />

      <Route path="/donor/profile" element={
        (loggedInRequester && !loggedInUser) ? (
          <Navigate to="/requester-portal" replace />
        ) : !loggedInUser ? (
          <Navigate to="/donor-dashboard" replace />
        ) : (
          <AppShell nav={nav} activeView="donor-dashboard">
            {sessionLoading ? (
              <LoadingScreen />
            ) : (
              <ErrorBoundary fallbackMessage="Profile settings hit an unexpected error. Your data is safe.">
                <DonorProfileSettings
                  currentUser={loggedInUser}
                  onLoginSuccess={(donor) => { auth.setLoggedInUser(donor); }}
                  onNavigate={nav}
                />
              </ErrorBoundary>
            )}
          </AppShell>
        )
      } />

      <Route path="/requester-portal" element={
        (loggedInUser && !loggedInRequester) ? (
          <Navigate to="/donor-dashboard" replace />
        ) : (
          <AppShell nav={nav} activeView="requester-portal">
            {sessionLoading ? (
              <LoadingScreen />
            ) : (
              <ErrorBoundary fallbackMessage="The requester portal hit an unexpected error. Your data is safe.">
                <RequesterPortal
                  currentRequester={loggedInRequester}
                  onLoginSuccess={(requester) => { auth.setLoggedInRequester(requester); }}
                  onLogout={auth.logout}
                  onNavigateToRequest={() => nav('request')}
                  onNavigateToRegister={() => nav('requester-register')}
                />
              </ErrorBoundary>
            )}
          </AppShell>
        )
      } />

      <Route path="/auth/rev3" element={<Rev3AuthRoute nav={nav} />} />
      <Route path="/auth/rev3/onboarding" element={<Rev3OnboardingRoute nav={nav} />} />

      <Route path="/auth/signin" element={<Rev3AuthRoute nav={nav} />} />
      <Route path="/auth/signup" element={<Rev3AuthRoute nav={nav} />} />
      <Route path="/auth/donor-register" element={<Rev3AuthRoute nav={nav} intent="donor" />} />
      <Route path="/auth/requester-register" element={<Rev3AuthRoute nav={nav} intent="requester" />} />

      <Route path="/hospital/register" element={
        <FullScreenRoute nav={nav}>
          <HospitalRegistration
            onBack={() => nav('home')}
          />
        </FullScreenRoute>
      } />

      <Route path="/institution/register" element={
        <FullScreenRoute nav={nav}>
          <HospitalRegistration
            onBack={() => nav('home')}
          />
        </FullScreenRoute>
      } />

      <Route path="/institution/signup" element={
        <FullScreenRoute nav={nav}>
          <HospitalRegistration
            onBack={() => nav('home')}
          />
        </FullScreenRoute>
      } />

      <Route path="/institution/login" element={
        <FullScreenRoute nav={nav}>
          <InstitutionLogin
            onBack={() => nav('home')}
          />
        </FullScreenRoute>
      } />

      <Route path="/hospital/dashboard" element={
        loggedInHospital ? (
          <FullScreenRoute nav={nav}>
            <ErrorBoundary fallbackMessage="The hospital dashboard hit an unexpected error. Your data is safe.">
              <HospitalDashboard
                hospital={loggedInHospital}
                onLogout={() => { void auth.logout(); nav('home'); }}
              />
            </ErrorBoundary>
          </FullScreenRoute>
        ) : (
          <Navigate to="/hospital/register" replace />
        )
      } />

      <Route path="/institution/dashboard" element={
        loggedInHospital ? (
          <FullScreenRoute nav={nav}>
            <ErrorBoundary fallbackMessage="The institution dashboard hit an unexpected error. Your data is safe.">
              <HospitalDashboard
                hospital={loggedInHospital}
                onLogout={() => { void auth.logout(); nav('home'); }}
              />
            </ErrorBoundary>
          </FullScreenRoute>
        ) : (
          <Navigate to="/institution/register" replace />
        )
      } />

      <Route path="/admin/login" element={
        <FullScreenRoute nav={nav}>
          <React.Suspense fallback={<LoadingScreen/>}>
            <AdminLogin
              onLogin={(admin) => { auth.setLoggedInAdmin(admin); nav('admin-dashboard'); }}
              onBack={() => nav('home')}
            />
          </React.Suspense>
        </FullScreenRoute>
      } />

      <Route path="/admin/dashboard" element={
        (loggedInAdmin && firebaseAdmin) ? (
          <FullScreenRoute nav={nav}>
            <ErrorBoundary fallbackMessage="The admin dashboard hit an unexpected error. Your data is safe.">
              <React.Suspense fallback={<LoadingScreen/>}>
                <AdminConsole
                  admin={loggedInAdmin}
                  onLogout={() => { void auth.logout(); nav('home'); }}
                />
              </React.Suspense>
            </ErrorBoundary>
          </FullScreenRoute>
        ) : (
          <Navigate to="/admin/login" replace />
        )
      } />

      <Route path="/blood-banks" element={
        <AppShell nav={nav} activeView="blood-banks">
          <BloodBankDirectory onNavigate={nav} />
        </AppShell>
      } />

      <Route path="/privacy" element={
        <AppShell nav={nav} activeView="privacy">
          <PrivacyPolicy onNavigate={nav} />
        </AppShell>
      } />

      <Route path="/terms" element={
        <AppShell nav={nav} activeView="terms">
          <TermsOfService onNavigate={nav} />
        </AppShell>
      } />

      <Route path="/faq" element={
        <AppShell nav={nav} activeView="faq">
          <FAQPage onNavigate={nav} />
        </AppShell>
      } />

      <Route path="/donors" element={
        <AppShell nav={nav} activeView="donors">
          <CityDonorDirectory onNavigate={nav} />
        </AppShell>
      } />

      <Route path="/blood-compatibility" element={
        <AppShell nav={nav} activeView="blood-compatibility">
          <BloodCompatibilityPage onNavigate={nav} />
        </AppShell>
      } />

      <Route path="/guides" element={
        <AppShell nav={nav} activeView="guides">
          <GuidesPage onNavigate={nav} />
        </AppShell>
      } />

      <Route path="/support" element={
        <AppShell nav={nav} activeView="support">
          <SupportPage onNavigate={nav} />
        </AppShell>
      } />

      <Route path="*" element={<NotFoundRedirect />} />
    </Routes>
  );
}

// Legacy ?view= / unknown paths → home (replace so back button isn't polluted).
function NotFoundRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam && VIEW_PATHS[viewParam]) {
      const codeParam = params.get('code');
      const target = viewParam === 'tracking' && codeParam
        ? `/track/${encodeURIComponent(codeParam)}`
        : VIEW_PATHS[viewParam];
      navigate(target, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate]);
  return <LoadingScreen />;
}

// Tracking params (code from path, role/matchToken from query) → RequestTracking.
function TrackingView() {
  const { code } = useParams<{ code: string }>();
  const [params] = useSearchParams();
  const role = (params.get('role') as 'donor' | 'requester') || 'requester';
  const matchToken = params.get('matchToken') || params.get('matchId') || undefined;

  return (
    <ErrorBoundary fallbackMessage="Request tracking hit an unexpected error. Please refresh.">
      <RequestTracking initialCode={code} role={role} matchToken={matchToken} />
    </ErrorBoundary>
  );
}

// Rev 3 authentication route. After sign-in, resolve the user's profile from /me
// and route to the correct user dashboard (donor, requester, or hospital).
function Rev3AuthRoute({ nav, intent }: { nav: (view: string, push?: boolean, code?: string) => void; intent?: 'donor' | 'requester' }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const [showIntentSelector, setShowIntentSelector] = React.useState(false);

  const checkUserAndRoute = async () => {
    let me: Awaited<ReturnType<typeof fetchMe>> | undefined;
    try {
      me = await fetchMe();
    } catch { /* not signed in */ }
    if (!me || !me.authUser || !me.profile) return false;

    // Institution-linked identities stay on the institutional path (a fully
    // separate third path). They must never be funneled into donor/requester
    // onboarding — even a profile still at onboarding_step "basic" routes here.
    if (me.institution) {
      auth.setLoggedInInstitution(me.institution);
      auth.setLoggedInHospital(institutionToHospitalUser(me.institution));
      auth.setLoggedInUser(null);
      auth.setLoggedInRequester(null);
      navigate('/institution/dashboard', { replace: true });
      return true;
    }

    if (me.nextStep === 'basic' || me.nextStep === 'intent') {
      navigate('/auth/rev3/onboarding', { replace: true });
      return true;
    }

    const profile = me.profile as { intent?: string; can_donate?: boolean; can_request?: boolean };
    if (!profile.intent) {
      setShowIntentSelector(true);
      return true;
    }

    const legacy = toLegacy(me);
    // Donor/requester entry must never route to the institutional dashboard,
    // even if the profile is institution-linked. Institutional is a separate
    // third path reached only through its own Sign In section.
    if (legacy.donor) {
      auth.setLoggedInUser(legacy.donor);
      auth.setLoggedInRequester(null);
      navigate('/donor-dashboard', { replace: true });
      return true;
    }
    if (legacy.requester) {
      auth.setLoggedInRequester(legacy.requester);
      auth.setLoggedInUser(null);
      navigate('/requester-portal', { replace: true });
      return true;
    }
    nav('home');
    return true;
  };

  useEffect(() => {
    // Route donor/requester only — institutional state must never pre-empt the
    // donor/requester sign-in (stale loggedInHospital would otherwise hijack a
    // donor/requester tap to /hospital/dashboard).
    if (auth.loggedInUser && !auth.loggedInRequester) {
      navigate('/donor-dashboard', { replace: true });
    } else if (auth.loggedInRequester && !auth.loggedInUser) {
      navigate('/requester-portal', { replace: true });
    } else if (!auth.loggedInUser && !auth.loggedInRequester) {
      void checkUserAndRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loggedInUser, auth.loggedInRequester, navigate]);

  const handleContinue = async (step: string) => {
    if (step === 'basic' || step === 'intent') {
      navigate('/auth/rev3/onboarding');
      return;
    }
    // Post-provisioning: the sign-in screen awaited AuthContext.refreshSession()
    // before onContinue, so route from that canonical FRESH context state —
    // never a stale fetchMe() memo from an uncoordinated /api/auth/me.
    if (auth.loggedInUser && !auth.loggedInRequester) {
      navigate('/donor-dashboard', { replace: true });
    } else if (auth.loggedInRequester && !auth.loggedInUser) {
      navigate('/requester-portal', { replace: true });
    } else if (auth.loggedInInstitution) {
      navigate('/institution/dashboard', { replace: true });
    } else {
      // Edge: no resolvable role yet (e.g. intent selector / return visitor
      // without intent) — fall back to a fresh profile check.
      await checkUserAndRoute();
    }
  };

  const handleIntentSelected = async (_selectedIntent: 'donor' | 'requester') => {
    setShowIntentSelector(false);
    await checkUserAndRoute();
  };

  return (
    <AppShell nav={nav} activeView="auth-signin">
      {showIntentSelector ? (
        <main className="min-h-[85vh] px-4 py-12 flex items-center justify-center relative overflow-hidden">
          <AuthIntentSelector onIntentSelected={(selectedIntent) => { void handleIntentSelected(selectedIntent); }} />
        </main>
      ) : (
        <Rev3AuthScreen onContinue={(step) => { void handleContinue(step); }} initialIntent={intent} />
      )}
    </AppShell>
  );
}

// Rev 3 onboarding route (Slice 2). Basic profile step is shared; the intent step
// is role-specific (donor vs requester) and driven by the stored profile intent.
function Rev3OnboardingRoute({ nav }: { nav: (view: string, push?: boolean, code?: string) => void }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const [role, setRole] = React.useState<'donor' | 'requester' | null>(null);
  const [resolving, setResolving] = React.useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await fetchMe();
        if (mounted && me?.profile) {
          const intent = me.profile.intent;
          if (intent === 'requester' || intent === 'donor') setRole(intent);
        }
      } catch { /* not signed in */ }
      if (mounted) setResolving(false);
    })();
    return () => { mounted = false; };
  }, []);

  const handleComplete = async () => {
    try {
      const me = await fetchMe();
      if (!me || !me.authUser) {
        navigate('/auth/rev3');
        return;
      }
      const legacy = toLegacy(me);
      // Donor/requester onboarding never funnels an institution-linked profile
      // to the institutional dashboard — institutional is a separate path.
      if (legacy.donor) {
        auth.setLoggedInUser(legacy.donor);
        auth.setLoggedInRequester(null);
      } else if (legacy.requester) {
        auth.setLoggedInRequester(legacy.requester);
        auth.setLoggedInUser(null);
      }

      nav(legacy.donor ? 'donor-dashboard' : 'requester-portal');
    } catch {
      navigate('/auth/rev3');
    }
  };

  const handleRoleSelected = async (selected: 'donor' | 'requester') => {
    try {
      await saveOnboardingIntent(selected);
      setRole(selected);
    } catch { /* stay on the gate; the wizard surfaces errors on submit */ }
  };

  if (resolving) {
    return (
      <AppShell nav={nav} activeView="auth-signup">
        <LoadingScreen />
      </AppShell>
    );
  }

  return (
    <AppShell nav={nav} activeView="auth-signup">
      {role === 'donor' ? (
        <DonorOnboardingWizard onComplete={() => { void handleComplete(); }} />
      ) : role === 'requester' ? (
        <RequesterOnboardingWizard onComplete={() => { void handleComplete(); }} />
      ) : (
        <OnboardingRoleGate
          onSelect={(selected) => { void handleRoleSelected(selected); }}
          onBack={() => nav('home')}
        />
      )}
    </AppShell>
  );
}

// Full-screen views (no Navbar/AppShell) — admin/hospital standalone pages.
function FullScreenRoute({ children, nav }: { children: React.ReactNode; nav: (view: string, push?: boolean, code?: string) => void }) {
  return (
    <>
      {children}
      <NotificationSimulator onNavigate={(view) => nav(view as string)} showSupportUs={false} />
    </>
  );
}

// Shared shell for Navbar-backed views.
// Navbar and MobileBottomNav read auth state from useAuth() directly (Task 4.2).
// The floating Support Us CTA is hidden on authenticated/workflow views so it never
// overlaps dashboard actions (donor dashboard, donor profile, requester portal, auth).
const SUPPORT_US_HIDDEN_VIEWS = new Set(['donor-dashboard', 'donor-profile', 'requester-portal', 'auth-signin', 'auth-signup']);
function AppShell({ nav, activeView, children }: {
  nav: (view: string, push?: boolean, code?: string) => void;
  activeView: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col font-sans text-ink-900 relative">
      <Navbar onNavigate={(view) => nav(view)} />

      <main className="flex-1 max-w-6xl w-full mx-auto min-w-0 px-3 sm:px-4 lg:px-8 pt-20 sm:pt-24 lg:pt-28 pb-20 md:pb-16 overflow-x-hidden">
        {children}
      </main>

      <MobileBottomNav
        activeView={activeView}
        onNavigate={(view) => nav(view)}
      />

      <NotificationSimulator
        onNavigate={(view) => nav(view as string)}
        showSupportUs={!SUPPORT_US_HIDDEN_VIEWS.has(activeView)}
      />
    </div>
  );
}

// Home (special: no Navbar, own layout).
function HomeView({ nav }: { nav: (view: string, push?: boolean, code?: string) => void }) {
  return (
    <div className="relative pb-16 md:pb-0">
      <FindMyDonorHome onNavigate={nav} />
      <MobileBottomNav
        activeView="home"
        onNavigate={nav}
      />
      <NotificationSimulator />
    </div>
  );
}
