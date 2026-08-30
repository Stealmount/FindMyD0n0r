import React from 'react';
import { useLanguage } from '../../lib/LanguageContext';
import { Heart, Clock } from 'lucide-react';

interface TabBarProps {
 active: 'requests' | 'history';
 matchCount: number;
 historyCount: number;
 onSelect: (tab: 'requests' | 'history') => void;
}

/** Segmented control between live match requests and donation history tabs. */
export default function TabBar({ active, matchCount, historyCount, onSelect }: TabBarProps) {
 const { t } = useLanguage();

   return (
   <div className="flex border border-ink-200 bg-ink-50 p-1 gap-1 mx-1 mt-1 min-w-0">
   <button
   id="btn-tab-requests"
   type="button"
   onClick={() => onSelect('requests')}
   className={`flex-1 min-w-0 py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-[11px] sm:text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] ${
   active === 'requests'
   ? 'bg-white text-ink-950 border border-ink-200'
   : 'text-ink-500 hover:text-ink-700 hover:bg-ink-100'
   }`}
   >
   <Heart className={`w-4 h-4 shrink-0 ${active === 'requests' ? 'text-blood-400 animate-pulse' : 'text-ink-400'}`} />
   <span className="truncate">{t.donorDashboard.liveMatchingRequests} ({matchCount})</span>
   </button>
   <button
   id="btn-tab-history"
   type="button"
   onClick={() => onSelect('history')}
   className={`flex-1 min-w-0 py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-[11px] sm:text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] ${
   active === 'history'
   ? 'bg-white text-ink-950 border border-ink-200'
   : 'text-ink-500 hover:text-ink-700 hover:bg-ink-100'
   }`}
   >
  <Clock className={`w-4 h-4 shrink-0 ${active === 'history' ? 'text-blood-400' : 'text-ink-400'}`} />
  <span className="truncate">{t.donorDashboard.donationHistory} ({historyCount})</span>
  </button>
  </div>
  );
}
