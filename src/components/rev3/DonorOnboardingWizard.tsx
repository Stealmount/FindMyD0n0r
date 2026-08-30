// Donor onboarding wizard — Basic Profile → Donor medical details.
// Roles are exclusive; this wizard always completes as a donor.
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ArrowLeft, CheckCircle2, Heart, Loader2, ShieldCheck } from 'lucide-react';
import { BloodType } from '../../types';
import { completionWizard, submitIntent } from '../../lib/rev3Auth';
import { OnboardingBasicStep } from './OnboardingBasicStep';

interface DonorOnboardingWizardProps {
  onComplete: () => void;
}

type DonorStep = 'basic' | 'donor';

export function DonorOnboardingWizard({ onComplete }: DonorOnboardingWizardProps) {
  const [step, setStep] = useState<DonorStep>('basic');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [bloodGroup, setBloodGroup] = useState<BloodType | ''>('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [healthSelfDeclaration, setHealthSelfDeclaration] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!bloodGroup) {
      setError('Please select your blood group.');
      return;
    }
    if (!healthSelfDeclaration) {
      setError('Please accept the health self-declaration to register as a donor.');
      return;
    }

    setSubmitting(true);
    try {
      await submitIntent({
        intent: 'donor',
        bloodGroup,
        isAvailable,
        healthSelfDeclaration,
      });
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
        onNext={() => { setError(''); setStep('donor'); }}
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
          Donor Medical Details
          </h1>
          <p className="text-sm text-ink-500 mt-1">
          You are registering as a volunteer blood donor. Your blood group and declaration help us match you safely.
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
        key="step-donor"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="mx-auto w-full max-w-md border border-ink-200 bg-white p-6 sm:p-8"
        >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-700 mb-1.5">
          Blood Group <span className="text-blood-600">*</span>
          </label>
          <select
          value={bloodGroup}
          onChange={(e) => setBloodGroup(e.target.value as BloodType)}
          className="h-11 w-full border border-ink-300 bg-white px-3 text-sm font-semibold text-ink-900 transition-colors duration-150 focus:border-blood-600 focus:outline-none"
          >
          <option value="">Select Blood Group</option>
          {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
          <option key={bg} value={bg}>
          {bg}
          </option>
          ))}
          </select>
          </div>

          <div className="flex items-center gap-3 bg-ink-50 border border-ink-100 p-4">
          <input
          type="checkbox"
          id="isAvailable"
          checked={isAvailable}
          onChange={(e) => setIsAvailable(e.target.checked)}
          className="h-4 w-4 accent-blood-600 cursor-pointer"
          />
          <label htmlFor="isAvailable" className="text-xs font-medium text-ink-800 cursor-pointer">
          I am available to donate blood immediately when notified.
          </label>
          </div>

          <div className="flex items-start gap-3 bg-ink-50 border border-ink-100 p-4">
          <input
          type="checkbox"
          id="healthSelfDeclaration"
          checked={healthSelfDeclaration}
          onChange={(e) => setHealthSelfDeclaration(e.target.checked)}
          className="h-4 w-4 mt-0.5 accent-blood-600 cursor-pointer shrink-0"
          />
          <label htmlFor="healthSelfDeclaration" className="text-xs font-medium text-ink-800 leading-relaxed cursor-pointer">
          <span className="mb-0.5 flex items-center gap-1 font-bold text-blood-900">
          <ShieldCheck className="h-3.5 w-3.5 text-blood-600" />
          Clinical Self-Declaration
          </span>
          I declare that I am between 18–65 years old, weigh at least 45 kg, and have no major health contraindications for blood donation.
          </label>
          </div>

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