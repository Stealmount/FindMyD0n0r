// Rev 3 Authentication screen — Google sign-in only.
// Glassmorphic, mobile-first. Handles Google login and session restore.
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Heart, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../../lib/firebase';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { completeGoogle, fetchMe } from '../../lib/rev3Auth';
import type { Rev3NextStep } from '../../lib/rev3Auth';

interface Rev3AuthProps {
 onContinue: (step: Rev3NextStep) => void;
 initialIntent?: 'donor' | 'requester';
}

const card =
 'mx-auto w-full max-w-md border border-ink-200 bg-white p-6 sm:p-8';
const btnPrimary =
 'mt-6 flex h-12 w-full items-center justify-center gap-2 bg-blood-600 hover:bg-blood-700 text-sm font-semibold text-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600 disabled:opacity-50 disabled:cursor-not-allowed select-none';

export function Rev3AuthScreen({ onContinue, initialIntent }: Rev3AuthProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const startedRef = useRef(false);
  const [resolvedIntent, setResolvedIntent] = useState<'donor' | 'requester' | undefined>(initialIntent);
  useEffect(() => {
    if (initialIntent) setResolvedIntent(initialIntent);
  }, [initialIntent]);

 // Session restore — check if user is already signed in via Firebase
 useEffect(() => {
 if (startedRef.current) return;
 startedRef.current = true;
 const unsub = onAuthStateChanged(auth, async (user) => {
 if (user) {
 setLoading(true);
 try {
 const me = await fetchMe();
 if (me && me.authUser) {
 onContinue(me.nextStep);
 return;
 }
  // User exists in Firebase Auth but no profile yet — complete Google flow
  const name = String(user.displayName || '');
  const result = await completeGoogle(user.email || '', name, resolvedIntent);
  onContinue(result.nextStep || 'basic');
 } catch {
 // Fall through to auth UI
 }
 setLoading(false);
 }
 });
  return () => unsub();
  }, [onContinue, resolvedIntent]);

 async function handleGoogle() {
 setError('');
 setLoading(true);
 try {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const name = String(user.displayName || '');
  const profileResult = await completeGoogle(user.email || '', name, resolvedIntent);
 onContinue(profileResult.nextStep || (profileResult.isNewUser ? 'basic' : 'complete'));
 } catch (caught: any) {
 if (caught?.code === 'auth/popup-closed-by-user') {
 setLoading(false);
 return;
 }
 setError(caught instanceof Error ? caught.message : 'Google sign-in failed.');
 setLoading(false);
 }
 }

 return (
<main className="min-h-[85vh] bg-[#FAFAFA] px-4 py-12 flex items-center justify-center">
  <div className="w-full max-w-md">
 <header className="mb-8 text-center">
  <div className="mx-auto mb-4 grid h-10 w-10 place-items-center bg-blood-600">
  <Heart className="h-5 w-5 fill-white text-white" />
  </div>
  <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">Welcome to FindMyDonor</h1>
 <p className="mt-2 text-sm text-ink-500">Sign in with Google to get started.</p>
 </header>

 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className={card}
>
 <button
 id="auth-google"
 onClick={handleGoogle}
 disabled={loading}
 className="flex h-12 w-full items-center justify-center gap-2 border border-ink-300 bg-white text-sm font-semibold text-ink-900 transition-colors hover:border-ink-900 hover:bg-ink-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600 disabled:opacity-50 disabled:cursor-not-allowed select-none"
>
 <svg className="h-5 w-5" viewBox="0 0 24 24">
 <path fill="#4285F4" d="M21.35 11.1h-9.17v2.9h5.03c-.42 2.3-2.6 4.2-5.03 4.2a5 5 0 0 1 0-10c1.2 0 2.3.43 3.16 1.14l2.1-2.1A8 8 0 1 0 20 12c0-.35-.02-.7-.07-1.05Z" />
 </svg>
 {loading ? 'Signing in...' : 'Continue with Google'}
 </button>
 </motion.div>

 {error && (
 <div role="alert" className="mt-5 flex items-start gap-3 border border-blood-200 bg-blood-50 p-4 text-sm font-semibold text-blood-700">
 <AlertCircle className="h-5 w-5 shrink-0" />{error}
 </div>
 )}

 <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-ink-400">
 <ShieldCheck className="h-4 w-4" />Your data is treated as regulated and never shared.
 </p>
 </div>
 </main>
 );
}
