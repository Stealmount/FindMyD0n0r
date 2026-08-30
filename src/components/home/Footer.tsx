import React from "react";
import { Droplet, ArrowUpRight } from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

interface FooterProps {
 onNavigate: (view: any) => void;
}

const Twitter = (props: React.SVGProps<SVGSVGElement>) => (
 <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
 <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
 </svg>
);

const Instagram = (props: React.SVGProps<SVGSVGElement>) => (
 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
 <rect width="20" height="20" x="2" y="2" rx="5" />
 <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
 <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
 </svg>
);

const Linkedin = (props: React.SVGProps<SVGSVGElement>) => (
 <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
 <path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 1 1 8.3 6.5a1.78 1.78 0 0 1-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0 0 13 14.19a.66.66 0 0 0 0 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 0 1 2.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
 </svg>
);

const Github = (props: React.SVGProps<SVGSVGElement>) => (
 <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
 <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56C20.21 21.39 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5z" />
 </svg>
);

export function Footer({ onNavigate }: FooterProps) {
 const { t } = useLanguage();

 const columns = [
 {
 title: t.footer.col1Title,
 items: [
 { label: t.footer.col1Request, action: () => onNavigate('request') },
 { label: t.footer.col1Track, action: () => onNavigate('tracking') },
   { label: t.footer.col1SignIn, action: () => onNavigate('auth-signin') },
   { label: t.footer.col1ForInstitutions, action: () => onNavigate('institution-signup') },
  ],
 },
 {
 title: t.footer.col2Title,
 items: [
  { label: t.footer.col2HowItWorks, action: () => { window.location.hash = "how-it-works"; } },
  { label: t.footer.col2Features, action: () => { window.location.hash = "features"; } },
  ],
 },
 {
 title: "Legal & Policy",
 items: [
 { label: "Privacy Policy", action: () => onNavigate('privacy') },
 { label: "Terms of Service", action: () => onNavigate('terms') },
  { label: "Frequently Asked Questions", action: () => onNavigate('faq') },
  ],
  },
 ];

 return (
 <footer className="relative bg-ink-950 text-white border-t border-ink-800 pt-20 pb-10 overflow-hidden">
 <div
 className="absolute inset-0 grid-pattern-dark opacity-20"
 aria-hidden
 />
 <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
 <div className="grid gap-12 lg:grid-cols-12">
 <div className="lg:col-span-5">
 <div className="flex items-center gap-2">
 <div className="grid h-9 w-9 place-items-center bg-blood-600">
 <Droplet className="h-4 w-4 text-white fill-white" />
 </div>
 <span className="text-[17px] font-semibold tracking-tight">
 FindMyDonor™
 </span>
 </div>
 <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed text-ink-300">
 {t.footer.description}
 </p>

 <div className="mt-7 border border-ink-800 bg-ink-900 p-5">
 <p className="text-[12px] font-semibold uppercase tracking-wider text-blood-300">
 {t.footer.quickActions}
 </p>
 <div className="mt-3 flex flex-col sm:flex-row gap-2">
 <button
 onClick={() => onNavigate('request')}
 className="group inline-flex items-center justify-center gap-2 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-ink-950 hover:bg-ink-100 transition-colors cursor-pointer"
 >
 {t.footer.requestBloodNow}
 <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
 </button>
 <button
 onClick={() => onNavigate('auth-signup' as any)}
 className="group inline-flex items-center justify-center gap-2 border border-white/20 px-4 py-2.5 text-[12.5px] font-semibold text-white hover:border-white hover:bg-white/10 transition-colors cursor-pointer"
 >
 {t.footer.createAccount}
 <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
 </button>
 </div>
 </div>

 <div className="mt-7 flex items-center gap-2">
 {[
 { Icon: Twitter, label: "Twitter" },
 { Icon: Instagram, label: "Instagram" },
 { Icon: Linkedin, label: "LinkedIn" },
 { Icon: Github, label: "GitHub" },
 ].map(({ Icon, label }) => (
 <button
 key={label}
 aria-label={label}
 className="grid h-9 w-9 place-items-center border border-ink-700 text-ink-300 hover:border-white hover:text-white transition-colors cursor-pointer"
 >
 <Icon className="h-4 w-4" />
 </button>
 ))}
 </div>
 </div>

 <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-8">
 {columns.map((c) => (
 <div key={c.title}>
 <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-400">
 {c.title}
 </p>
 <ul className="mt-4 space-y-2.5">
 {c.items.map((item) => (
 <li key={item.label}>
 <button
 onClick={item.action}
 className="text-left text-[13.5px] text-ink-400 hover:text-white transition-colors cursor-pointer"
 >
 {item.label}
 </button>
 </li>
 ))}
 </ul>
 </div>
 ))}
 </div>
 </div>

 <div className="mt-16 flex flex-col gap-4 border-t border-ink-800 pt-7 sm:flex-row sm:items-center sm:justify-between">
 <p className="text-[12.5px] text-ink-400">
 {t.footer.copyright}
 </p>
 <div className="flex items-center gap-2 text-[12.5px] text-ink-400">
 <span className="relative flex h-2 w-2">
 <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vital-400 opacity-75" />
 <span className="relative inline-flex h-2 w-2 rounded-full bg-vital-400" />
 </span>
 All systems operational
 </div>
 </div>
 </div>
 </footer>
 );
}
