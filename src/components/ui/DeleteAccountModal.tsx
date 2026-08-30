import React, { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { authenticatedApi } from '../../lib/api';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface DeleteAccountModalProps {
 open: boolean;
 onClose: () => void;
 onDeleted: () => void; // runs after successful deletion (e.g. sign out + redirect)
}

/** Type-to-confirm modal for permanent account deletion. */
export default function DeleteAccountModal({ open, onClose, onDeleted }: DeleteAccountModalProps) {
 const { t, language } = useLanguage();
 const trapRef = useFocusTrap<HTMLDivElement>(open);
 const isHi = language === 'HI';
 const [confirm, setConfirm] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');

 if (!open) return null;

 const confirmed = confirm.trim().toUpperCase() === 'DELETE';

 const handleDelete = async () => {
 if (!confirmed || loading) return;
 setLoading(true);
 setError('');
 try {
 await authenticatedApi<{ ok: boolean }>('/api/account/delete');
 onDeleted();
 } catch (err: any) {
 setError(err?.message || t.account.deleteError);
 } finally {
 setLoading(false);
 }
 };

 return (
 <div ref={trapRef} className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={t.account.deleteTitle}>
 <div className="absolute inset-0 bg-ink-950/70" aria-hidden />
 <div className="relative z-[90] flex h-full items-center justify-center p-4">
 <div className="w-full max-w-md border border-ink-200 bg-white p-6 animate-fade-in">
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-center gap-3">
 <div className="grid h-11 w-11 place-items-center border border-blood-200 bg-blood-50 text-blood-700">
 <AlertTriangle className="w-6 h-6" />
 </div>
 <h3 className="text-lg font-extrabold text-ink-900 tracking-tight">{t.account.deleteTitle}</h3>
 </div>
 <button
 onClick={onClose}
 disabled={loading}
 className="p-2 text-ink-400 hover:bg-ink-100 transition-colors cursor-pointer disabled:opacity-50"
 aria-label={t.account.deleteCancel}
>
 <X className="w-5 h-5" />
 </button>
 </div>

 <p className="mt-4 text-sm text-ink-600 leading-relaxed">{t.account.deleteWarning}</p>

 <label className="block mt-5">
 <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">{t.account.deleteConfirmPlaceholder}</span>
 <input
 type="text"
 value={confirm}
 onChange={(e) => setConfirm(e.target.value)}
 disabled={loading}
 placeholder="DELETE"
 className="mt-1.5 w-full h-11 border border-ink-300 bg-white px-3.5 text-sm font-medium text-ink-900 placeholder:text-ink-400 outline-none transition-colors focus:border-blood-600 disabled:opacity-50"
 />
 </label>

 {error && <p className="mt-3 text-sm font-semibold text-blood-600">{error}</p>}

 <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
 <button
 onClick={onClose}
 disabled={loading}
 className="flex-1 h-11 inline-flex items-center justify-center border border-ink-300 bg-white px-4 text-sm font-semibold text-ink-900 hover:border-ink-900 hover:bg-ink-50 transition-colors cursor-pointer disabled:opacity-50"
>
 {t.account.deleteCancel}
 </button>
 <button
 onClick={handleDelete}
 disabled={!confirmed || loading}
 className="flex-1 h-11 inline-flex items-center justify-center gap-2 bg-blood-600 hover:bg-blood-700 px-4 text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
>
 {loading && <Loader2 className="w-4 h-4 animate-spin" />}
 {loading ? t.account.deleteLoading : t.account.deleteConfirmButton}
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}
