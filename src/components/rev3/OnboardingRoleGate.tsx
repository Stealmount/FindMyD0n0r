// Two-way role gate for profiles that reach onboarding without a stored intent
// (legacy / edge case). Roles are exclusive — pick donor or requester.
import React, { useState } from 'react';
import { Heart, Loader2, UserCheck } from 'lucide-react';
import { saveOnboardingIntent } from '../../lib/rev3Auth';

interface OnboardingRoleGateProps {
  onSelect: (role: 'donor' | 'requester') => void;
  onBack: () => void;
}

export function OnboardingRoleGate({ onSelect, onBack }: OnboardingRoleGateProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSelect = async (role: 'donor' | 'requester') => {
    setError('');
    setSubmitting(true);
    try {
      await saveOnboardingIntent(role);
      onSelect(role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save your role. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink-900 tracking-tight">
          How would you like to participate?
          </h1>
          <p className="mt-1 text-sm text-ink-500">
          Choose your primary role. You can add the other later by signing up separately.
          </p>
        </div>

        {error && (
          <div className="mb-4 border border-blood-200 bg-blood-50 p-4 text-sm font-semibold text-blood-700">
          {error}
          </div>
        )}

        <div className="space-y-3">
          <button
          type="button"
          disabled={submitting}
          onClick={() => void handleSelect('donor')}
          className="w-full border p-4 text-left transition-colors flex items-start gap-3.5 cursor-pointer border-ink-200 bg-white hover:border-ink-300 disabled:opacity-50"
          >
          <div className="p-2.5 shrink-0 bg-ink-100 text-ink-600">
          <Heart className="h-5 w-5" />
          </div>
          <div>
          <div className="font-bold text-sm text-ink-900">Volunteer Blood Donor</div>
          <p className="text-xs text-ink-500 mt-0.5">
          I want to register to donate blood when compatible emergencies arise nearby.
          </p>
          </div>
          </button>

          <button
          type="button"
          disabled={submitting}
          onClick={() => void handleSelect('requester')}
          className="w-full border p-4 text-left transition-colors flex items-start gap-3.5 cursor-pointer border-ink-200 bg-white hover:border-ink-300 disabled:opacity-50"
          >
          <div className="p-2.5 shrink-0 bg-ink-100 text-ink-600">
          <UserCheck className="h-5 w-5" />
          </div>
          <div>
          <div className="font-bold text-sm text-ink-900">Blood Requester / Caregiver</div>
          <p className="text-xs text-ink-500 mt-0.5">
          I am looking for voluntary blood donors for a patient or hospital request.
          </p>
          </div>
          </button>

          {submitting && (
          <div className="flex items-center justify-center gap-2 text-xs text-ink-500 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-blood-600" />
          Saving your role...
          </div>
          )}

          <button
          type="button"
          onClick={onBack}
          className="w-full h-11 border border-ink-300 bg-white text-ink-900 font-semibold text-sm transition-colors hover:border-ink-900 hover:bg-ink-50 cursor-pointer select-none"
          >
          Cancel
          </button>
        </div>
      </div>
    </div>
  );
}