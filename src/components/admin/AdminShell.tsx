import React from 'react';
import { motion } from 'framer-motion';
import {
 LayoutDashboard, Users, UserRound, FileSpreadsheet, GitFork, Building2,
 BellRing, ScrollText, HelpCircle, ShieldCheck, Settings, Send, Zap, LogOut,
 Search, Droplets, Menu, X, Activity,
} from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';

export type AdminTab =
  | 'overview' | 'donors' | 'requesters' | 'users' | 'requests' | 'matches'
  | 'institutions' | 'notifications' | 'audit' | 'faq' | 'roles' | 'settings';

interface AdminShellProps {
 children: React.ReactNode;
 activeTab: AdminTab;
 badges: Partial<Record<AdminTab, number>>;
 telemetry: any;
 onTabChange: (tab: AdminTab) => void;
 onLoadRequesters: () => void;
 onLoadInstitutions: () => void;
 onSweep: () => void;
 onLogout: () => void;
 adminEmail?: string;
 globalSearch: string;
 onGlobalSearchChange: (v: string) => void;
}

interface NavItem {
 tab: AdminTab;
 icon: React.ReactNode;
 label: string;
 hi: string;
 group: 'operations' | 'directory' | 'governance' | 'system';
}

export default function AdminShell({
 children, activeTab, badges, telemetry, onTabChange, onLoadRequesters,
 onLoadInstitutions, onSweep, onLogout, adminEmail, globalSearch, onGlobalSearchChange,
}: AdminShellProps) {
 const { language, setLanguage } = useLanguage();
 const isHi = language === 'HI';
 const [mobileOpen, setMobileOpen] = React.useState(false);

 const groups: { key: NavItem['group']; title: string; hi: string }[] = [
 { key: 'operations', title: 'Operations', hi: 'संचालन' },
 { key: 'directory', title: 'Directory', hi: 'निर्देशिका' },
 { key: 'governance', title: 'Governance', hi: 'प्रशासन' },
 { key: 'system', title: 'System', hi: 'प्रणाली' },
 ];

 const items: NavItem[] = [
 { tab: 'overview', icon: <LayoutDashboard className="w-4 h-4" />, label: 'Overview', hi: 'अवलोकन', group: 'operations' },
 { tab: 'requests', icon: <FileSpreadsheet className="w-4 h-4" />, label: 'Blood Requests', hi: 'रक्त अनुरोध', group: 'operations' },
 { tab: 'matches', icon: <GitFork className="w-4 h-4" />, label: 'Match Monitor', hi: 'मिलान निगरानी', group: 'operations' },
 { tab: 'notifications', icon: <Send className="w-4 h-4" />, label: 'Broadcast & SOS', hi: 'प्रसारण और SOS', group: 'operations' },
 { tab: 'donors', icon: <Users className="w-4 h-4" />, label: 'Donors', hi: 'दाता', group: 'directory' },
    { tab: 'requesters', icon: <UserRound className="w-4 h-4" />, label: 'Requesters', hi: 'अनुरोधकर्ता', group: 'directory' },
    { tab: 'users', icon: <Users className="w-4 h-4" />, label: 'All Users', hi: 'सभी उपयोगकर्ता', group: 'directory' },
 { tab: 'institutions', icon: <Building2 className="w-4 h-4" />, label: 'Institutions', hi: 'संस्थान', group: 'directory' },
 { tab: 'audit', icon: <ScrollText className="w-4 h-4" />, label: 'Audit Log', hi: 'ऑडिट लॉग', group: 'governance' },
 { tab: 'faq', icon: <HelpCircle className="w-4 h-4" />, label: 'Content & FAQ', hi: 'सामग्री और FAQ', group: 'governance' },
 { tab: 'roles', icon: <ShieldCheck className="w-4 h-4" />, label: 'Roles & Access', hi: 'भूमिकाएं', group: 'system' },
 { tab: 'settings', icon: <Settings className="w-4 h-4" />, label: 'Settings', hi: 'सेटिंग्स', group: 'system' },
 ];

 const navBtn = (item: NavItem) => {
 const active = activeTab === item.tab;
 const badge = badges[item.tab];
 return (
 <button
 key={item.tab}
    onClick={() => {
      if (item.tab === 'requesters') onLoadRequesters();
      if (item.tab === 'users') onLoadRequesters();
      if (item.tab === 'institutions') onLoadInstitutions();
 onTabChange(item.tab);
 setMobileOpen(false);
 }}
 aria-current={active ? 'page' : undefined}
 className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium border transition-colors cursor-pointer ${
 active
 ? 'bg-blood-600/15 text-blood-400 border border-blood-500/30'
 : 'text-ink-400 hover:text-white hover:bg-white/5 border border-transparent'
 }`}
 >
 <span className={active ? 'text-blood-400' : 'text-ink-500'}>{item.icon}</span>
 <span className="flex-1 text-left">{isHi ? item.hi : item.label}</span>
 {badge !== undefined && badge > 0 && (
 <span className="bg-blood-600 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{badge}</span>
 )}
 </button>
 );
 };

 const rail = (
 <aside className="w-full md:w-64 bg-ink-950 border-r border-ink-800 flex flex-col shrink-0 h-full">
 <div className="p-5 space-y-1">
 <div className="flex items-center gap-3 px-2 py-1">
 <div className="w-9 h-9 bg-blood-600 flex items-center justify-center text-white">
 <Droplets className="w-5 h-5" strokeWidth={2} />
 </div>
 <div>
 <div className="text-sm font-bold text-white tracking-tight">FindMyDonor</div>
 <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">Admin Console</div>
 </div>
 </div>
 <div className="mt-4 flex items-center gap-2 px-2 py-1.5 bg-vital-500/10 border border-vital-500/20">
 <span className="w-2 h-2 rounded-full bg-vital-400 animate-pulse" />
 <span className="text-[10px] font-bold text-vital-400 uppercase tracking-widest">
 {isHi ? 'सिस्टम ऑनलाइन' : 'System Online'}
 </span>
 {telemetry?.server_uptime_seconds !== undefined && (
 <span className="ml-auto text-[10px] text-ink-500 font-mono tabular-nums">
 {Math.floor(telemetry.server_uptime_seconds / 60)}m
 </span>
 )}
 </div>
 </div>

 <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-4" aria-label={isHi ? 'मुख्य नेविगेशन' : 'Main navigation'}>
 {groups.map(g => (
 <div key={g.key}>
 <div className="px-3 pb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-600">
 {isHi ? g.hi : g.title}
 </div>
 <div className="space-y-0.5">
 {items.filter(i => i.group === g.key).map(navBtn)}
 </div>
 </div>
 ))}
 </nav>

 <div className="p-3 border-t border-ink-800">
 <button onClick={onLogout}
 className="w-full flex items-center justify-between px-3 py-2 text-[13px] text-ink-400 hover:text-white hover:bg-white/5 transition cursor-pointer">
 <span className="font-medium">{isHi ? 'सत्र समाप्त करें' : 'End Session'}</span>
 <LogOut className="w-4 h-4" />
 </button>
 </div>
 </aside>
 );

 return (
 <div className="min-h-screen bg-ink-950 text-white font-sans flex flex-col md:flex-row antialiased relative">
 {/* Ambient background */}
 <div className="fixed inset-0 grid-pattern-dark pointer-events-none opacity-40" />

 {/* Mobile rail toggle */}
 <div className="md:hidden fixed top-4 left-4 z-[45]">
 <button onClick={() => setMobileOpen(v => !v)} aria-label={isHi ? 'मेनू' : 'Menu'}
 className="p-2.5 bg-ink-900 border border-ink-700 text-white cursor-pointer">
 {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
 </button>
 </div>
 {mobileOpen && (
 <div className="fixed inset-0 z-40 md:hidden bg-ink-950/70" onClick={() => setMobileOpen(false)} />
 )}

 <div className={`relative z-30 fixed md:static inset-y-0 left-0 w-72 md:w-64 transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
 {rail}
 </div>

 {/* Main canvas */}
 <main className="relative z-10 flex-1 flex flex-col min-w-0 h-screen md:overflow-hidden">
 <header className="sticky top-0 z-20 bg-ink-950 border-b border-ink-800 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
 <div className="flex items-center gap-2 text-xs md:pl-0">
 <span className="text-ink-500">Admin</span>
 <span className="text-ink-700">/</span>
 <span className="text-white font-semibold">
 {isHi ? (items.find(i => i.tab === activeTab)?.hi || activeTab) : (items.find(i => i.tab === activeTab)?.label || activeTab)}
 </span>
 </div>

 <div className="flex items-center gap-3">
 {/* Global search */}
 <div className="relative hidden sm:block">
 <Search className="w-3.5 h-3.5 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
 <input
 type="text"
 value={globalSearch}
 onChange={e => onGlobalSearchChange(e.target.value)}
 placeholder={isHi ? 'दाता, पिनकोड खोजें...' : 'Search donors, pincode...'}
 className="bg-ink-900 border border-ink-700 pl-9 pr-10 py-2 text-xs text-white placeholder:text-ink-500 focus:outline-none focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500 w-56 transition-colors"
 aria-label={isHi ? 'खोज' : 'Search'}
 />
 <kbd className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-ink-400 bg-ink-900 px-1.5 py-0.5 border border-ink-700">⌘K</kbd>
 </div>

 {/* Run match engine */}
 <button onClick={onSweep}
 className="px-3 py-2 bg-blood-600 hover:bg-blood-700 active:bg-blood-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600">
 <Zap className="w-3.5 h-3.5" /> {isHi ? 'मिलान इंजन चलाएं' : 'Run Match Engine'}
 </button>

 {/* EN/HI toggle */}
 <div className="flex items-center bg-ink-950 p-1 gap-1 border border-ink-800">
 <button onClick={() => setLanguage('EN')}
 className={`px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${!isHi ? 'bg-blood-600 text-white' : 'text-ink-400 hover:text-white'}`}>EN</button>
 <button onClick={() => setLanguage('HI')}
 className={`px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${isHi ? 'bg-blood-600 text-white' : 'text-ink-400 hover:text-white'}`}>HI</button>
 </div>

 {/* Signed-in admin identity (hidden on very small screens) */}
 {adminEmail && (
 <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 border border-white/10 text-ink-300">
 <UserRound className="w-3.5 h-3.5 text-blood-400 shrink-0" />
 <span className="text-[11px] truncate max-w-[200px]">{adminEmail}</span>
 </div>
 )}

 <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-vital-500/10 border border-vital-500/30 text-vital-400 text-[10px] font-bold tracking-widest">
 <Activity className="w-3 h-3" /> {isHi ? 'सक्रिय' : 'LIVE'}
 </div>
 </div>
 </header>

 <div className="flex-1 overflow-y-auto p-4 md:p-6">
 <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
 className="max-w-[1400px] mx-auto space-y-6 animate-fade-in">
 {children}
 </motion.div>
 </div>
 </main>
 </div>
 );
}
