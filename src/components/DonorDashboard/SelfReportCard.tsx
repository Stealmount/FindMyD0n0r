import React from 'react';
import { Calendar, FileText, HeartPulse } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';

interface SelfReportCardProps {
  reporting: boolean;
  reportDate: string;
  reportNotes: string;
  onReportDateChange: (d: string) => void;
  onReportNotesChange: (n: string) => void;
  onReportSubmit: (e: React.FormEvent) => void;
}

/**
 * Primary "I donated" action (§5 item 9). Previously buried in the settings
 * right column, this is surfaced as a first-class action on the donor dashboard
 * so the 60-day cooldown is easy to trigger after an external donation.
 */
export function SelfReportCard({
  reporting, reportDate, reportNotes,
  onReportDateChange, onReportNotesChange, onReportSubmit,
}: SelfReportCardProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';

  return (
    <div className="border border-blood-500/30 bg-blood-500/5 p-4 sm:p-5 min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-[15px] tracking-tight text-ink-900">
            <HeartPulse className="w-5 h-5 text-blood-600" />
            {isHi ? 'दान की रिपोर्ट करें' : 'Report a Donation'}
          </h3>
          <p className="text-[11px] leading-relaxed text-ink-600 mt-1">
            {isHi
              ? 'बाहरी रूप से (अस्पताल या ब्लड बैंक में) दान किया? इसे लॉग करें ताकि आपका 60-दिन का सुरक्षा कूलडाउन तुरंत लागू हो।'
              : 'Donated externally at a hospital or blood bank? Log it to trigger your safety 60-day recovery cooldown.'}
          </p>
        </div>
      </div>

      <form onSubmit={onReportSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-3 items-end text-xs">
        <div className="space-y-1.5 min-w-0">
          <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            {isHi ? 'दान तिथि *' : 'Donation Date *'}
          </label>
          <input
            id="inp-report-date"
            type="date"
            required
            value={reportDate}
            onChange={e => onReportDateChange(e.target.value)}
            className="h-10 w-full border border-ink-300 bg-white px-3 text-sm font-medium text-ink-900 outline-none transition-colors duration-150 focus:border-blood-400 focus:outline-none min-w-0"
            style={{ colorScheme: 'light' }}
          />
        </div>
        <div className="space-y-1.5 min-w-0">
          <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            {isHi ? 'नोट्स / स्थान' : 'Notes / Location'}
          </label>
          <input
            id="inp-report-notes"
            type="text"
            value={reportNotes}
            onChange={e => onReportNotesChange(e.target.value)}
            placeholder={isHi ? 'ब्लड बैंक / अस्पताल का नाम...' : 'Blood bank / hospital name...'}
            className="h-10 w-full border border-ink-300 bg-white px-3 text-sm font-medium text-ink-900 placeholder:text-ink-400 outline-none transition-colors duration-150 focus:border-blood-400 focus:outline-none min-w-0"
          />
        </div>
        <button
          id="btn-report-submit"
          type="submit"
          disabled={reporting || !reportDate}
          className="flex h-10 sm:h-10 min-h-[44px] sm:min-h-0 items-center justify-center gap-2 bg-blood-600 text-white text-[13px] font-bold transition-colors hover:bg-blood-700 px-5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-500 w-full sm:w-auto"
        >
          {reporting ? <span className="h-4 w-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : <FileText className="w-4 h-4" />}
          {reporting ? (isHi ? 'लॉग हो रहा है...' : 'Logging...') : (isHi ? 'दान लॉग करें' : 'Log Donation')}
        </button>
      </form>
    </div>
  );
}
