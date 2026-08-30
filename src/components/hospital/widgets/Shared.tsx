import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplet, X } from 'lucide-react';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

// Status pill helper (bilingual) shared across views.
export function StatusPill({ status, isHi }: { status: string; isHi: boolean }) {
 const map: Record<string, { label: string; hi: string; cls: string }> = {
 approved: { label: 'Approved', hi: 'स्वीकृत', cls: 'bg-vital-500/10 border-vital-500/30 text-vital-600' },
 declined: { label: 'Declined', hi: 'अस्वीकृत', cls: 'bg-blood-500/10 border-blood-500/30 text-blood-600' },
 pending: { label: 'Pending', hi: 'प्रतीक्षारत', cls: 'bg-ink-100 border-ink-200 text-ink-600' },
 open: { label: 'Active', hi: 'सक्रिय', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-600' },
 fulfilled: { label: 'Fulfilled', hi: 'पूर्ण', cls: 'bg-vital-500/10 border-vital-500/30 text-vital-600' },
 cancelled: { label: 'Cancelled', hi: 'रद्द', cls: 'bg-blood-500/10 border-blood-500/30 text-blood-600' },
 searching: { label: 'Searching', hi: 'खोज जारी', cls: 'bg-blue-500/10 border-blue-500/30 text-blue-600' },
 };
 const cfg = map[status] || map['pending'];
 return (
  <span className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] whitespace-nowrap ${cfg.cls}`}>
 {isHi ? cfg.hi : cfg.label}
 </span>
 );
}

// Empty state: friendly blood-drop card (Phase 8.2 pattern).
export function EmptyState({ title, titleHi, hint, hintHi, isHi }: { title: string; titleHi: string; hint: string; hintHi: string; isHi: boolean }) {
 return (
  <div className="border border-ink-200 bg-ink-50 px-6 py-12 text-center">
  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-ink-200 text-ink-400">
  <Droplet className="h-6 w-6" />
  </div>
  <p className="text-sm font-bold text-ink-900">{isHi ? titleHi : title}</p>
  <p className="mt-1 text-[13px] text-ink-500">{isHi ? hintHi : hint}</p>
  </div>
 );
}

// ── KPI stat card ──────────────────────────────────────────────────────────────
export function StatCard({ icon, label, labelHi, value, tone = 'blood', isHi }: {
 icon: React.ReactNode; label: string; labelHi: string; value: string | number; tone?: 'blood' | 'emerald' | 'amber' | 'ink'; isHi: boolean;
}) {
  const tones: Record<string, string> = {
  blood: 'text-blood-600 bg-blood-500/10 border-blood-500/30',
  emerald: 'text-vital-600 bg-vital-500/10 border-vital-500/30',
  amber: 'text-amber-600 bg-amber-500/10 border-amber-500/30',
  ink: 'text-ink-600 bg-ink-100 border-ink-200',
  };
  return (
  <div className="flex items-center gap-4 border border-ink-200 bg-ink-50 p-4 sm:p-5">
  <div className={`grid h-10 w-10 shrink-0 place-items-center border ${tones[tone]}`}>
  {icon}
  </div>
  <div className="min-w-0">
  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 truncate">
  {isHi ? labelHi : label}
  </div>
  <div className="mt-0.5 font-display text-2xl font-extrabold leading-tight tracking-tight text-ink-900 tabular-nums sm:text-[28px]">
  {value}
  </div>
  </div>
  </div>
  );
}

// ── Focus-trapped detail drawer for donor / request records ───────────────────
export interface EntityDrawerProps {
 open: boolean;
 onClose: () => void;
 title: string;
 subtitle?: string;
 badge?: React.ReactNode;
 rows: { label: string; value: string }[];
 actions?: React.ReactNode;
 isHi: boolean;
}

export function EntityDrawer({ open, onClose, title, subtitle, badge, rows, actions, isHi }: EntityDrawerProps) {
 const trapRef = useFocusTrap<HTMLElement>(open);
 return (
 <AnimatePresence>
 {open && (
 <>
 <motion.div
 key="backdrop"
 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 onClick={onClose}
  className="fixed inset-0 z-[80] bg-ink-950/70"
 aria-hidden="true"
 />
 <motion.aside
 key="drawer"
 ref={trapRef}
 role="dialog"
 aria-modal="true"
 aria-label={title}
 initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
 transition={{ type: 'tween', duration: 0.28, ease: 'easeInOut' }}
  className="fixed right-0 top-0 bottom-0 z-[90] h-full w-full max-w-md bg-white border-l border-ink-200 flex flex-col"
  >
  {/* Header */}
  <div className="px-6 py-5 border-b border-ink-200 flex items-start justify-between gap-4">
  <div className="min-w-0">
  <div className="flex items-center gap-2 flex-wrap">
  <h3 className="text-[15px] font-bold text-ink-900 tracking-tight truncate">{title}</h3>
  {badge}
  </div>
  {subtitle && <p className="text-[12px] text-ink-500 mt-1 truncate">{subtitle}</p>}
  </div>
  <button
  onClick={onClose}
  className="p-2 bg-ink-100 hover:bg-ink-200 text-ink-500 hover:text-ink-900 transition shrink-0 cursor-pointer"
 aria-label={isHi ? 'बंद करें' : 'Close'}
 >
 <X className="h-4 w-4" />
 </button>
 </div>

 {/* Rows */}
 <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
 {rows.map(r => (
 <div key={r.label}>
  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">{r.label}</div>
  <div className="text-[13px] font-semibold text-ink-900 mt-0.5 break-words">{r.value}</div>
 </div>
 ))}
 {rows.length === 0 && (
 <p className="text-[13px] text-ink-500">{isHi ? 'कोई विवरण उपलब्ध नहीं' : 'No details available'}</p>
 )}
 </div>

 {/* Actions */}
 {actions && (
  <div className="border-t border-ink-200 bg-ink-50 px-6 py-5 space-y-2">
 {actions}
 </div>
 )}
 </motion.aside>
 </>
 )}
 </AnimatePresence>
 );
}
