import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplet, X, AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

// Status pill for admin entity states (bilingual).
const PILL_MAP: Record<string, { label: string; hi: string; cls: string }> = {
 active: { label: 'Active', hi: 'सक्रिय', cls: 'bg-vital-500/10 border-vital-500/30 text-vital-400' },
 available: { label: 'Available', hi: 'उपलब्ध', cls: 'bg-vital-500/10 border-vital-500/30 text-vital-400' },
 cooldown: { label: 'Cooldown', hi: 'कूलडाउन', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
 banned: { label: 'Banned', hi: 'प्रतिबंधित', cls: 'bg-blood-500/10 border-blood-500/30 text-blood-400' },
 deleted: { label: 'Deleted', hi: 'हटाया गया', cls: 'bg-blood-500/10 border-blood-500/30 text-blood-400' },
 pending: { label: 'Pending', hi: 'प्रतीक्षारत', cls: 'bg-white/5 border-white/10 text-ink-300' },
 verified: { label: 'Verified', hi: 'सत्यापित', cls: 'bg-vital-500/10 border-vital-500/30 text-vital-400' },
 rejected: { label: 'Rejected', hi: 'अस्वीकृत', cls: 'bg-blood-500/10 border-blood-500/30 text-blood-400' },
 open: { label: 'Open', hi: 'खुला', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
 broadcasting:{ label: 'Broadcasting', hi: 'प्रसारण', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
 matching: { label: 'Matching', hi: 'मिलान', cls: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
 fulfilled: { label: 'Fulfilled', hi: 'पूर्ण', cls: 'bg-vital-500/10 border-vital-500/30 text-vital-400' },
 cancelled: { label: 'Cancelled', hi: 'रद्द', cls: 'bg-blood-500/10 border-blood-500/30 text-blood-400' },
 expired: { label: 'Expired', hi: 'समाप्त', cls: 'bg-white/5 border-white/10 text-ink-300' },
 accepted: { label: 'Accepted', hi: 'स्वीकृत', cls: 'bg-vital-500/10 border-vital-500/30 text-vital-400' },
 responded: { label: 'Responded', hi: 'उत्तर दिया', cls: 'bg-vital-500/10 border-vital-500/30 text-vital-400' },
 declined: { label: 'Declined', hi: 'अस्वीकृत', cls: 'bg-blood-500/10 border-blood-500/30 text-blood-400' },
 donated: { label: 'Donated', hi: 'दान किया', cls: 'bg-vital-500/10 border-vital-500/30 text-vital-400' },
 sent: { label: 'Sent', hi: 'भेजा गया', cls: 'bg-vital-500/10 border-vital-500/30 text-vital-400' },
};

export function StatusPill({ status, isHi }: { status: string; isHi: boolean }) {
 const cfg = PILL_MAP[status] || PILL_MAP['pending'];
 return (
 <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] whitespace-nowrap ${cfg.cls}`}>
 {isHi ? cfg.hi : cfg.label}
 </span>
 );
}

// Small tonal badge (counts, labels).
export function Badge({ children, tone = 'ink' }: { children: React.ReactNode; tone?: 'blood' | 'amber' | 'emerald' | 'ink' }) {
 const tones = {
 blood: 'bg-blood-600 text-white',
 amber: 'bg-amber-500 text-black',
 emerald: 'bg-vital-600 text-white',
 ink: 'bg-white/10 text-white',
 };
 return (
 <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 leading-none ${tones[tone]}`}>
 {children}
 </span>
 );
}

export function EmptyState({ title, hint, isHi }: { title: string; hint: string; isHi: boolean }) {
 return (
 <div className="border border-ink-800 bg-ink-950 px-6 py-12 text-center">
 <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-blood-500/30 bg-blood-500/10">
 <Droplet className="h-6 w-6 text-blood-400" />
 </div>
 <p className="text-sm font-semibold text-white">{title}</p>
 <p className="text-[13px] text-ink-500 mt-1">{hint}</p>
 </div>
 );
}

// KPI stat card (mirrors hospital StatCard; used in Overview + view headers).
export function StatCard({ icon, label, value, tone = 'blood', isHi }: {
 icon: React.ReactNode; label: string; value: string | number; tone?: 'blood' | 'emerald' | 'amber' | 'ink' | 'blue'; isHi: boolean;
}) {
 const tones: Record<string, string> = {
 blood: 'text-blood-400 bg-blood-500/10 border-blood-500/20',
 emerald: 'text-vital-400 bg-vital-500/10 border-vital-500/20',
 amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
 blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
 ink: 'text-ink-300 bg-white/5 border-white/10',
 };
 return (
 <div className="border border-ink-800 bg-ink-900 p-4 sm:p-5 flex items-center gap-4">
 <div className={`grid h-10 w-10 place-items-center border shrink-0 ${tones[tone]}`}>{icon}</div>
 <div className="min-w-0">
 <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 truncate">{label}</div>
 <div className="font-display text-2xl sm:text-[28px] font-extrabold text-white tracking-tight leading-tight mt-0.5 tabular-nums">{value}</div>
 </div>
 </div>
 );
}

// Toast notifications — replaces alert().
export interface Toast { id: number; kind: 'success' | 'error' | 'info'; message: string }

export function ToastHost({ toasts, isHi }: { toasts: Toast[]; isHi: boolean }) {
 const styles = {
 success: 'border-l-vital-500',
 error: 'border-l-blood-500',
 info: 'border-l-blue-500',
 };
 return (
 <div className="fixed bottom-6 right-6 z-[100] space-y-2 w-80 pointer-events-none">
 <AnimatePresence>
 {toasts.map(t => (
 <motion.div
 key={t.id}
 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }}
 className={`border-l-[3px] bg-ink-950 p-3 pr-4 text-[13px] font-medium text-white ${styles[t.kind]}`}
 >
 {isHi ? t.message : t.message}
 </motion.div>
 ))}
 </AnimatePresence>
 </div>
 );
}

// Confirmation modal for destructive actions (replaces window.confirm).
export function ConfirmModal({ open, title, body, confirmLabel, busy, isHi, onConfirm, onClose }: {
 open: boolean; title: string; body: string; confirmLabel: string; busy: boolean; isHi: boolean;
 onConfirm: () => void; onClose: () => void;
}) {
 const trapRef = useFocusTrap<HTMLDivElement>(open);
 return (
 <AnimatePresence>
 {open && (
 <>
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 onClick={onClose} className="fixed inset-0 z-[80] bg-ink-950/70" />
 <motion.div
 ref={trapRef} role="alertdialog" aria-modal="true" aria-label={title}
 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
 className="fixed inset-0 z-[90] flex items-center justify-center p-6"
 >
 <div className="w-full max-w-md border border-ink-800 bg-ink-950 p-6">
 <div className="flex items-start gap-4">
 <div className="w-10 h-10 bg-blood-500/10 border border-blood-500/30 flex items-center justify-center shrink-0">
 <AlertTriangle className="h-5 w-5 text-blood-400" />
 </div>
 <div className="min-w-0">
 <h3 className="text-[15px] font-bold text-white">{title}</h3>
 <p className="text-[12px] text-ink-400 mt-1.5">{body}</p>
 </div>
 </div>
 <div className="mt-6 flex justify-end gap-2">
 <button onClick={onClose} disabled={busy}
 className="px-4 py-2 border border-white/20 text-white text-xs font-semibold hover:border-white hover:bg-white/10 transition cursor-pointer">
 {isHi ? 'रद्द करें' : 'Cancel'}
 </button>
 <button onClick={onConfirm} disabled={busy}
 className="px-4 py-2 bg-blood-600 hover:bg-blood-700 active:bg-blood-800 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-2">
 {busy && <span className="w-3 h-3 rounded-full border-2 border-current/30 border-t-current animate-spin" />}
 {confirmLabel}
 </button>
 </div>
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>
 );
}

// ── Focus-trapped detail drawer ──────────────────────────────────────────────
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
 <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 onClick={onClose} className="fixed inset-0 z-[80] bg-ink-950/70" aria-hidden="true" />
 <motion.aside key="drawer" ref={trapRef} role="dialog" aria-modal="true" aria-label={title}
 initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
 transition={{ type: 'tween', duration: 0.28, ease: 'easeInOut' }}
 className="fixed right-0 top-0 bottom-0 z-[90] h-full w-full max-w-md bg-ink-950 border-l border-ink-800 flex flex-col">
 <div className="px-6 py-5 border-b border-ink-800 flex items-start justify-between gap-4">
 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="text-[15px] font-bold text-white tracking-tight truncate">{title}</h3>
 {badge}
 </div>
 {subtitle && <p className="text-[12px] text-ink-500 mt-1 truncate">{subtitle}</p>}
 </div>
 <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 text-ink-400 hover:text-white transition shrink-0 cursor-pointer"
 aria-label={isHi ? 'बंद करें' : 'Close'}>
 <X className="h-4 w-4" />
 </button>
 </div>
 <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
 {rows.map(r => (
 <div key={r.label}>
 <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">{r.label}</div>
 <div className="text-[13px] font-semibold text-white mt-0.5 break-words">{r.value || '—'}</div>
 </div>
 ))}
 {rows.length === 0 && <p className="text-[13px] text-ink-500">{isHi ? 'कोई विवरण उपलब्ध नहीं' : 'No details available'}</p>}
 </div>
 {actions && (
 <div className="px-6 py-5 border-t border-ink-800 bg-ink-950 space-y-2">
 {actions}
 </div>
 )}
 </motion.aside>
 </>
 )}
 </AnimatePresence>
 );
}

// Generic CSV export helper (browser side).
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
 const esc = (v: string | number) => {
 const s = String(v ?? '');
 return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
 };
 const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
 const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
}
