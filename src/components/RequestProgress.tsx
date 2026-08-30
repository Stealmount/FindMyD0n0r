import { CheckCircle2, Search, Loader2, Users, Droplets } from 'lucide-react';
import { BloodRequest, Match } from '../types';

interface RequestProgressProps {
 request: BloodRequest;
 matches: Match[];
 isHi?: boolean;
}

type Step = 'submitted' | 'searching' | 'notified' | 'responded';

/**
 * RequestProgress — 8.1 post-submit progress indicator.
 * Shows the live donor-search journey: submitted → searching → X notified → Y responded.
 * Drives stage off real request/match state; terminal statuses stop the spinner.
 */
export default function RequestProgress({ request, matches, isHi = false }: RequestProgressProps) {
 const notifiedCount = matches.length;
 const respondedCount = matches.filter(m => m.donor_response === 'approved').length;
 const isEnded = request.status === 'fulfilled' || request.status === 'cancelled';

 const steps: { key: Step; label: string; stat: string }[] = [
 { key: 'submitted', label: isHi ? 'अनुरोध सबमिट किया गया' : 'Request submitted', stat: '' },
 { key: 'searching', label: isHi ? 'रक्तदाता खोजे जा रहे हैं' : 'Searching for donors…', stat: '' },
 { key: 'notified', label: isHi ? 'रक्तदाता सूचित' : 'donors notified', stat: String(notifiedCount) },
 { key: 'responded', label: isHi ? 'रक्तदाता ने उत्तर दिया' : 'donors responded', stat: String(respondedCount) },
 ];

 const stateFor = (key: Step): 'done' | 'active' | 'todo' => {
 if (key === 'submitted') return 'done';
 if (key === 'searching') return notifiedCount > 0 ? 'done' : isEnded ? 'done' : 'active';
 if (key === 'notified') return notifiedCount > 0 ? 'done' : 'todo';
 // responded
 if (respondedCount === 0) return notifiedCount > 0 ? 'active' : 'todo';
 return 'done';
 };

 return (
 <div className="bg-ink-50/70 border border-ink-100 p-5 sm:p-6">
 <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 flex items-center gap-2 mb-4">
 <Droplets className="w-4 h-4 text-blood-600" />
 {isHi ? 'रक्तदान प्रगति' : 'Request Progress'}
 </h3>

 <ol className="space-y-4">
 {steps.map(step => {
 const status = stateFor(step.key);
 return (
 <li key={step.key} className="flex items-center gap-3">
 <span
 className={`grid h-8 w-8 shrink-0 place-items-center border transition-colors ${
 status === 'done'
 ? 'border-vital-500 bg-vital-50 text-vital-700'
 : status === 'active'
 ? 'border-blood-600 bg-blood-600 text-white'
 : 'border-ink-200 bg-ink-100 text-ink-400'
 }`}
 >
 {status === 'active'
 ? <Loader2 className="w-4 h-4 animate-spin" />
 : status === 'done'
 ? <CheckCircle2 className="w-4 h-4" />
 : <Search className="w-4 h-4" />}
 </span>
 <div className="flex items-baseline gap-1.5 flex-1 min-w-0">
 <span className={`text-sm font-semibold ${status === 'todo' ? 'text-ink-400' : 'text-ink-900'}`}>
 {step.label}
 </span>
 {step.stat && (
 <span className="font-mono text-xs font-bold tabular-nums text-blood-600 shrink-0">{step.stat}</span>
 )}
 </div>
 </li>
 );
 })}
 </ol>

 {isEnded && respondedCount === 0 && (
 <p className="mt-4 text-xs font-medium text-ink-500">
 {isHi ? 'कोई रक्तदाता नहीं मिला। आप नया अनुरोध बना सकते हैं।' : 'No donors were found. You can raise a new request.'}
 </p>
 )}
 </div>
 );
}
