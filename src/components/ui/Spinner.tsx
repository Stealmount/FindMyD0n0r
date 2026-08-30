import { motion } from 'framer-motion';

interface SpinnerProps {
 label?: string;
 isHi?: boolean;
 className?: string;
}

/**
 * Spinner — bilingual loading indicator used across data-bearing views.
 * Kept dependency-free apart from framer-motion (already used app-wide).
 */
export function Spinner({ label, isHi = false, className = 'py-10' }: SpinnerProps) {
 return (
 <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status" aria-live="polite">
 <motion.div
 className="h-8 w-8 rounded-full border-2 border-blood-600/30 border-t-blood-600"
 animate={{ rotate: 360 }}
 transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
 aria-hidden
 />
 <p className="text-sm text-ink-500">{label ?? (isHi ? 'लोड हो रहा है…' : 'Loading…')}</p>
 </div>
 );
}
