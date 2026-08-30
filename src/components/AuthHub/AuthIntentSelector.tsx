import React, { useState } from 'react';
import { Heart, UserCheck, ArrowRight } from 'lucide-react';
import { authenticatedApi } from '../../lib/api';

interface AuthIntentSelectorProps {
 onIntentSelected: (intent: 'donor' | 'requester') => void;
 loading?: boolean;
}

export default function AuthIntentSelector({ onIntentSelected, loading: externalLoading }: AuthIntentSelectorProps) {
 const [selectedIntent, setSelectedIntent] = useState<'donor' | 'requester' | null>(null);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedIntent) return;
 setError('');
 setLoading(true);
 try {
 // Save intent to DB profile and compute capabilities (can_donate / can_request)
 await authenticatedApi<{ profile: unknown }>('/api/auth/complete-verification', { intent: selectedIntent });
 onIntentSelected(selectedIntent);
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to save intent. Please try again.');
 } finally {
 setLoading(false);
 }
 };

 const isSubmitting = loading || externalLoading;

 return (
<div className="mx-auto w-full max-w-md border border-ink-200 bg-white p-6 sm:p-8">
  <div className="text-center mb-6">
  <div className="mx-auto mb-3 grid h-10 w-10 place-items-center bg-blood-600">
  <Heart className="h-5 w-5 fill-white text-white" />
  </div>
  <h2 className="font-display text-xl font-bold tracking-tight text-ink-900">I want to use FindMyDonor as:</h2>
 <p className="mt-1 text-xs text-ink-500">Select how you will participate in the network</p>
 </div>

 {error && (
 <div className="mb-4 bg-blood-50 border border-blood-200 p-4 text-sm font-semibold text-blood-700">
 {error}
 </div>
 )}

 <form onSubmit={handleSubmit} className="space-y-3">
 <button
 type="button"
 onClick={() => setSelectedIntent('donor')}
 className={`w-full flex items-center justify-between border p-4 transition-colors text-left cursor-pointer ${
 selectedIntent === 'donor'
? 'border-blood-600 bg-blood-50/60 text-ink-900'
  : 'border-ink-200 bg-white hover:border-ink-300 text-ink-900'
 }`}
>
 <div className="flex items-center gap-3">
 <div className={`p-2.5 ${selectedIntent === 'donor' ? 'bg-blood-600 text-white' : 'bg-ink-100 text-ink-600'}`}>
 <Heart className="h-5 w-5" />
 </div>
 <div>
 <div className="font-bold text-sm">Blood Donor</div>
 <div className="text-xs text-ink-500">Ready to donate and save lives in emergency</div>
 </div>
 </div>
 <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selectedIntent === 'donor' ? 'border-blood-600 bg-blood-600 text-white' : 'border-ink-300'}`}>
 {selectedIntent === 'donor' && <div className="h-2 w-2 rounded-full bg-white" />}
 </div>
 </button>

 <button
 type="button"
 onClick={() => setSelectedIntent('requester')}
 className={`w-full flex items-center justify-between border p-4 transition-colors text-left cursor-pointer ${
 selectedIntent === 'requester'
? 'border-blood-600 bg-blood-50/60 text-ink-900'
  : 'border-ink-200 bg-white hover:border-ink-300 text-ink-900'
 }`}
>
 <div className="flex items-center gap-3">
 <div className={`p-2.5 ${selectedIntent === 'requester' ? 'bg-blood-600 text-white' : 'bg-ink-100 text-ink-600'}`}>
 <UserCheck className="h-5 w-5" />
 </div>
 <div>
 <div className="font-bold text-sm">Blood Requester</div>
 <div className="text-xs text-ink-500">Request emergency blood for patient or family</div>
 </div>
 </div>
 <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selectedIntent === 'requester' ? 'border-blood-600 bg-blood-600 text-white' : 'border-ink-300'}`}>
 {selectedIntent === 'requester' && <div className="h-2 w-2 rounded-full bg-white" />}
 </div>
 </button>

<button
  type="submit"
  disabled={!selectedIntent || isSubmitting}
 className="mt-6 flex h-12 w-full items-center justify-center gap-2 bg-blood-600 hover:bg-blood-700 text-sm font-semibold text-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600 disabled:opacity-50 disabled:cursor-not-allowed select-none"
>
 {isSubmitting ? 'Saving...' : <>Continue to Dashboard <ArrowRight className="h-4 w-4" /></>}
 </button>
 </form>
 </div>
 );
}
