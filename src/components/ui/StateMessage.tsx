import { AlertTriangle, Inbox, LucideIcon, RotateCcw } from 'lucide-react';

interface StateMessageProps {
 variant: 'error' | 'empty';
 icon?: LucideIcon;
 title: string;
 hint?: string;
 onRetry?: () => void;
 isHi?: boolean;
}

/**
 * StateMessage — shared error / empty-state card.
 * Renders a "Try again" button only when onRetry is provided.
 */
export function StateMessage({ variant, icon: Icon, title, hint, onRetry, isHi = false }: StateMessageProps) {
 const ResolvedIcon = Icon ?? (variant === 'error' ? AlertTriangle : Inbox);
 return (
 <div className="flex flex-col items-center justify-center gap-3 border border-ink-200 bg-white p-8 text-center">
 <div className={`grid h-12 w-12 place-items-center rounded-full border ${variant === 'error' ? 'bg-blood-50 border-blood-200' : 'bg-ink-50 border-ink-200'}`}>
 <ResolvedIcon className={`h-6 w-6 ${variant === 'error' ? 'text-blood-700' : 'text-ink-400'}`} />
 </div>
 <div>
 <p className="text-sm font-semibold text-ink-900">{title}</p>
 {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
 </div>
 {onRetry && (
 <button
 type="button"
 onClick={onRetry}
 className="inline-flex h-11 items-center justify-center gap-2 bg-blood-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blood-700"
 >
 <RotateCcw className="h-4 w-4" />
 {isHi ? 'फिर कोशिश करें' : 'Try again'}
 </button>
 )}
 </div>
 );
}
