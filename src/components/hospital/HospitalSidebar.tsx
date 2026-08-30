import React from 'react';
import { LayoutDashboard, Radio, History, Tent, Users, BarChart3, Bell, Shield, ClipboardList, ShieldCheck } from 'lucide-react';

export type HospitalView = 'dashboard' | 'requests' | 'donors' | 'live' | 'history' | 'camps' | 'stats' | 'settings';

interface HospitalSidebarProps {
  activeView: HospitalView;
  onNavigate: (v: HospitalView) => void;
  showCamps: boolean;
  pendingReplies: number;
  lowStockCount: number;
  isHi: boolean;
}

export function HospitalSidebar({ activeView, onNavigate, showCamps, pendingReplies, lowStockCount, isHi }: HospitalSidebarProps) {
  const groups: { label: string; labelHi: string; items: { id: HospitalView; label: string; labelHi: string; icon: React.ReactNode; badge?: number; badgeTone?: 'blood' | 'amber' }[] }[] = [
  {
    label: 'Overview', labelHi: 'अवलोकन',
    items: [
      { id: 'dashboard', label: 'Dashboard', labelHi: 'डैशबोर्ड', icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'stats', label: 'Stats', labelHi: 'आंकड़े', icon: <BarChart3 className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Operations', labelHi: 'संचालन',
    items: [
      { id: 'requests', label: 'Requests', labelHi: 'अनुरोध', icon: <ClipboardList className="w-4 h-4" /> },
      { id: 'donors', label: 'Donors', labelHi: 'दाता', icon: <Users className="w-4 h-4" /> },
      { id: 'live', label: 'Live Network', labelHi: 'लाइव नेटवर्क', icon: <Radio className="w-4 h-4" />, badge: pendingReplies, badgeTone: 'blood' },
      { id: 'history', label: 'Request History', labelHi: 'अनुरोध इतिहास', icon: <History className="w-4 h-4" /> },
      ...(lowStockCount > 0 ? [{ id: 'live' as HospitalView, label: 'Low Stock', labelHi: 'कम स्टॉक', icon: <Tent className="w-4 h-4" />, badge: lowStockCount, badgeTone: 'amber' as const }] : []),
    ],
  },
  ...(showCamps ? [{
    label: 'Outreach', labelHi: 'आउटरीच',
    items: [
      { id: 'camps' as HospitalView, label: 'Donation Camps', labelHi: 'दान शिविर', icon: <Tent className="w-4 h-4" /> },
    ],
  }] : []),
  {
    label: 'Account', labelHi: 'खाता',
    items: [
      { id: 'settings' as HospitalView, label: 'Profile & Verification', labelHi: 'प्रोफ़ाइल और सत्यापन', icon: <ShieldCheck className="w-4 h-4" /> },
    ],
  },
  ];

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-ink-200 bg-white relative z-10">
    {/* Brand */}
    <div className="px-5 py-5 border-b border-ink-200 flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center bg-blood-600">
        <Shield className="h-4 w-4 text-white" />
      </div>
      <div>
        <div className="text-sm font-bold text-ink-900 tracking-tight leading-none">FindMyDonor</div>
        <div className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
          {isHi ? 'संस्थागत CRM' : 'Institution CRM'}
        </div>
      </div>
    </div>

    {/* Nav */}
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label={isHi ? 'मुख्य नेविगेशन' : 'Main navigation'}>
      {groups.map(group => (
        <div key={group.label}>
          <div className="px-3 pb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            {isHi ? group.labelHi : group.label}
          </div>
          <div className="space-y-0.5">
            {group.items.map(item => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.label}
                  onClick={() => onNavigate(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full cursor-pointer items-center gap-2.5 border px-3 py-2 text-[13px] font-medium transition-colors ${
                    active
                      ? 'border-blood-500/30 bg-blood-600/15 text-blood-600'
                      : 'border-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                  }`}
                >
                  {item.icon}
                  <span className="flex-1 text-left truncate">{isHi ? item.labelHi : item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`flex h-[18px] min-w-[18px] items-center justify-center px-1 font-mono text-[10px] font-bold tabular-nums ${
                      item.badgeTone === 'amber'
                        ? 'bg-amber-500 text-white'
                        : 'bg-blood-600 text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>

    {/* Footer note */}
    <div className="px-5 py-4 border-t border-ink-200 flex items-center gap-2 text-[10px] text-ink-500">
      <Bell className="w-3 h-3" />
      {isHi ? 'रीयल-टाइम नेटवर्क सिंक' : 'Real-time network sync'}
    </div>
    </aside>
  );
}
