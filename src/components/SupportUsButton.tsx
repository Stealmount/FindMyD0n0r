import React from 'react';
import { Heart } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface SupportUsButtonProps {
  onNavigate?: (view: string) => void;
  show?: boolean;
}

export default function SupportUsButton({ onNavigate, show = true }: SupportUsButtonProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';

  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
      <button
        onClick={() => {
          if (onNavigate) {
            onNavigate('support');
          } else {
            window.location.href = '/?view=support';
          }
        }}
        className="inline-flex items-center gap-2 h-9 px-4 bg-blood-600 hover:bg-blood-700 text-white text-[13px] font-semibold transition-colors cursor-pointer group"
      >
        <div className="flex h-6 w-6 items-center justify-center border border-white/20 bg-black/20 text-white">
          <Heart className="w-3.5 h-3.5 fill-white text-white animate-pulse" />
        </div>
        <span className="font-semibold">{isHi ? 'Support Us' : 'Support Us'}</span>
      </button>
    </div>
  );
}
