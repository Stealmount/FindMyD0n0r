// Institution sign-in — Part B. Dedicated email + 10-digit password surface,
// separate from the donor/requester Google flow. On success the Firebase
// custom token is exchanged for a session and AuthContext resolves the
// institution, so the existing /institution/dashboard guard takes over.
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight, Building2, Loader2, Lock, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { institutionLogin, completeInstitutionLogin } from '../../lib/rev3Auth';

interface InstitutionLoginProps {
  onBack: () => void;
}

export function InstitutionLogin({ onBack }: InstitutionLoginProps) {
  const navigate = useNavigate();
  const auth = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address (the one used during registration).');
      return;
    }
    if (!/^\d{10}$/.test(password)) {
      setError('Enter the 10-digit sign-in password (numbers only).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await institutionLogin(email.trim().toLowerCase(), password);
      await completeInstitutionLogin(res.customToken);
      // Let AuthContext re-resolve /api/auth/me for the new session before routing.
      try { await auth.refreshSession(); } catch { /* AuthContext effect also resolves it */ }
      navigate('/institution/dashboard');
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'INSTITUTION_PENDING_REVIEW') {
        setError('Your registration is pending review. You will be able to sign in once an administrator approves it.');
      } else if (code === 'INSTITUTION_REJECTED') {
        setError(err?.message || 'Your registration was not approved. Please re-register.');
      } else {
        setError(err?.message || 'Sign-in failed. Please try again.');
      }
      setSubmitting(false);
    }
  };

  const fieldClass =
    'w-full h-11 border border-ink-300 bg-white px-3.5 text-sm font-medium text-ink-900 outline-none transition-colors duration-150 placeholder:text-ink-400 focus:border-blood-600 focus:outline-1 focus:outline-offset-0 focus:outline-blood-600';
  const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-600 block';

  return (
    <div className="min-h-[85vh] py-12 px-4 sm:px-6 flex items-center justify-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md mx-auto">
        <button onClick={onBack}
          className="mb-6 flex cursor-pointer items-center text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-ink-900">
          ← Back to home
        </button>

        <div className="border border-ink-200 bg-white p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-10 w-10 place-items-center border border-blood-200 bg-blood-50">
              <Building2 className="w-5 h-5 text-blood-600" />
            </div>
            <div>
              <h1 className="font-display text-lg font-extrabold tracking-tight text-ink-900">
                Institution Sign In
              </h1>
              <p className="text-[11px] text-ink-400 mt-0.5">
                Approved hospitals, blood banks and NGOs
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="flex items-start gap-3 border border-blood-200 bg-blood-50 p-4 text-sm font-semibold text-blood-700">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className={labelClass}>Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@institution.org"
                  autoComplete="email"
                  className={`${fieldClass} pl-10`} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={labelClass}>10-digit Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input type="password" required inputMode="numeric" maxLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit numeric password"
                  autoComplete="current-password"
                  className={`${fieldClass} pl-10`} />
              </div>
              <p className="text-[11px] text-ink-400">Numbers only, exactly 10 digits.</p>
            </div>

            <button type="submit" disabled={submitting}
              className="mt-2 inline-flex h-12 w-full cursor-pointer select-none items-center justify-center gap-2 bg-blood-600 px-6 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blood-700 active:bg-blood-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-ink-100 pt-4 text-center">
            <p className="text-sm text-ink-500">
              Not registered yet?{' '}
              <button onClick={() => navigate('/institution/signup')}
                className="font-bold text-blood-600 hover:text-blood-800 cursor-pointer transition-colors">
                Register your institution
              </button>
            </p>
            <p className="text-[11px] text-ink-400 mt-2">
              Approval is required before you can sign in.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}