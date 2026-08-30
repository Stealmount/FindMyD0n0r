// Requester onboarding wizard — Basic Profile → Requester confirmation.
// Roles are exclusive; this wizard always completes as a requester.
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, UserCheck } from 'lucide-react';
import { completionWizard, submitIntent } from '../../lib/rev3Auth';
import { OnboardingBasicStep } from './OnboardingBasicStep';

interface RequesterOnboardingWizardProps {
  onComplete: () => void;
}

type RequesterStep = 'basic' | 'confirm';

export function RequesterOnboardingWizard({ onComplete }: RequesterOnboardingWizardProps) {
  const [step, setStep] = useState<RequesterStep>('basic');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await submitIntent({ intent: 'requester' });
      await completionWizard();
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'basic') {
    return (
      <OnboardingBasicStep
        step={1}
        totalSteps={2}
        onNext={() => { setError(''); setStep('confirm'); }}
      />
    );
  }

  return (
    <div className="min-h-[85vh] bg-[#FAFAFA] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-2 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700">
          Step 2 of 2
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink-900 tracking-tight">
          You're almost ready
          </h1>
          <p className="text-sm text-ink-500 mt-1">
          You are registering to request emergency blood for a patient or family member.
          </p>
          <div className="mt-4 h-1.5 w-full bg-ink-100 overflow-hidden">
          <motion.div
          className="h-full bg-blood-600"
          initial={false}
          animate={{ width: '100%' }}
          transition={{ duration: 0.3 }}
          />
          </div>
        </div>

        {error && (
          <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-start gap-2.5 border border-blood-200 bg-blood-50 p-4 text-sm font-semibold text-blood-700"
          >
          <AlertCircle className="h-4 w-4 shrink-0 text-blood-600 mt-0.5" />
          <span>{error}</span>
          </motion.div>
        )}

        <motion.div
        key="step-confirm"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="mx-auto w-full max-w-md border border-ink-200 bg-white p-6 sm:p-8"
        >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-start gap-4 border border-ink-200 bg-ink-50 p-4">
          <div className="grid h-12 w-12 place-items-center shrink-0 bg-blood-600 text-white">
          <UserCheck className="h-6 w-6" />
          </div>
          <div>
          <p className="text-sm font-bold text-ink-900">Blood Requester</p>
          <p className="text-xs text-ink-500 leading-relaxed mt-0.5">
          When you need blood, you can create a request and we'll notify nearby compatible donors. You don't need to donate to request blood.
          </p>
          </div>
          </div>
          <p className="text-xs text-ink-500">Complete your registration to open the requester dashboard.</p>

          <div className="pt-2 flex items-center gap-3">
          <button
          type="button"
          onClick={() => { setError(''); setStep('basic'); }}
          className="h-12 border border-ink-300 bg-white px-6 text-ink-900 font-semibold text-sm transition-colors hover:border-ink-900 hover:bg-ink-50 flex items-center justify-center gap-1.5 cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600"
          >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
          </button>

          <button
          type="submit"
          disabled={submitting}
          className="flex-1 h-12 bg-blood-600 hover:bg-blood-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600 disabled:opacity-50 disabled:cursor-not-allowed select-none"
          >
          {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
          <>
          <span>Complete Registration</span>
          <CheckCircle2 className="h-4 w-4" />
          </>
          )}
          </button>
          </div>
        </form>
        </motion.div>
      </div>
    </div>
  );
}