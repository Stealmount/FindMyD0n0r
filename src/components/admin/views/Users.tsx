import React, { useMemo } from 'react';
import { Search, Download, UserRound, Users as UsersIcon, Shield } from 'lucide-react';
import { User, Requester } from '../../../types';
import { StatusPill, EmptyState, downloadCSV, Badge } from '../widgets/Shared';

type UserRole = 'all' | 'donor' | 'requester' | 'admin';

interface UnifiedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Donor' | 'Requester' | 'Admin';
  bloodType?: string;
  city?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

interface UsersProps {
  donors: User[];
  requesters: Requester[];
  loading: boolean;
  search: string;
  isHi: boolean;
  onSearchChange: (v: string) => void;
}

const ROLE_PILLS: { value: UserRole; label: string; hi: string }[] = [
  { value: 'all', label: 'All Users', hi: 'सभी उपयोगकर्ता' },
  { value: 'donor', label: 'Donors', hi: 'दाता' },
  { value: 'requester', label: 'Requesters', hi: 'अनुरोधकर्ता' },
  { value: 'admin', label: 'Admins', hi: 'व्यवस्थापक' },
];

const ROLE_COLORS: Record<string, string> = {
  Donor: 'bg-blood-600/15 border border-blood-500/20 text-blood-400',
  Requester: 'bg-blue-500/15 border border-blue-500/20 text-blue-400',
  Admin: 'bg-amber-500/15 border border-amber-500/20 text-amber-400',
};

export default function Users({ donors, requesters, loading, search, isHi, onSearchChange }: UsersProps) {
  const [roleFilter, setRoleFilter] = React.useState<UserRole>('all');

  const unified = useMemo<UnifiedUser[]>(() => {
    const ADMIN_EMAIL = import.meta.env?.VITE_ADMIN_EMAIL || 'admin@findmydonor.online';
    const donorUsers: UnifiedUser[] = donors.map(d => ({
      id: d.id,
      name: d.full_name || '—',
      email: d.email || '—',
      phone: d.phone || '—',
      role: d.email === ADMIN_EMAIL ? 'Admin' as const : 'Donor' as const,
      bloodType: d.blood_type,
      city: d.city,
      status: d.account_status || 'active',
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
    const requesterUsers: UnifiedUser[] = requesters.map(r => ({
      id: r.id,
      name: r.full_name || '—',
      email: r.email || '—',
      phone: r.phone || '—',
      role: 'Requester' as const,
      city: (r as any).city,
      status: r.account_status || 'active',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    const all = [...donorUsers, ...requesterUsers];
    const seen = new Set<string>();
    return all.filter(u => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
  }, [donors, requesters]);

  const filtered = useMemo(() => {
    let list = unified;
    if (roleFilter !== 'all') {
      const roleMap: Record<string, string> = { donor: 'Donor', requester: 'Requester', admin: 'Admin' };
      list = list.filter(u => u.role === roleMap[roleFilter]);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u => [u.name, u.email, u.phone, u.bloodType, u.city, u.role].some(v => (v || '').toLowerCase().includes(q)));
    }
    return [...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [unified, roleFilter, search]);

  const roleCounts = useMemo(() => ({
    all: unified.length,
    donor: unified.filter(u => u.role === 'Donor').length,
    requester: unified.filter(u => u.role === 'Requester').length,
    admin: unified.filter(u => u.role === 'Admin').length,
  }), [unified]);

  const exportCsv = () => {
    downloadCSV(`users_${new Date().toISOString().split('T')[0]}.csv`,
      ['ID', 'Name', 'Email', 'Phone', 'Role', 'Blood', 'City', 'Status', 'Created', 'Last Active'],
      filtered.map(u => [u.id, u.name, u.email, u.phone, u.role, u.bloodType || 'N/A', u.city || 'N/A', u.status, u.createdAt, u.updatedAt || 'N/A']));
  };

  return (
    <div className="space-y-4">
 <div className="border border-ink-800 bg-ink-900 p-4 flex flex-wrap items-center gap-3">
 <div className="relative">
 <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
 <input value={search} onChange={e => onSearchChange(e.target.value)}
 placeholder={isHi ? 'नाम, ईमेल, फोन खोजें...' : 'Search name, email, phone...'}
 className="bg-ink-950 border border-ink-700 pl-9 pr-3 py-2 text-xs text-white placeholder:text-ink-500 focus:outline-none focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500 w-64" />
 </div>
 <button onClick={exportCsv} className="ml-auto px-3 py-1.5 border border-white/20 hover:border-white hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {ROLE_PILLS.map(pill => (
          <button
            key={pill.value}
            onClick={() => setRoleFilter(roleFilter === pill.value ? 'all' : pill.value)}
 className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer border flex items-center gap-1.5 ${
 roleFilter === pill.value ? 'bg-blood-600 text-white border-blood-600' : 'text-ink-400 border-ink-700 hover:text-white hover:border-ink-500'
 }`}
          >
            {isHi ? pill.hi : pill.label}
            <span className={`text-[10px] tabular-nums ${roleFilter === pill.value ? 'text-white/70' : 'text-ink-500'}`}>{roleCounts[pill.value]}</span>
          </button>
        ))}
      </div>

 <div className="border border-ink-800 bg-ink-900 overflow-hidden">
 {loading ? (
 <div className="p-16 flex items-center justify-center">
 <span className="w-6 h-6 animate-spin rounded-full border-2 border-current/30 border-t-current text-blood-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState title={isHi ? 'कोई उपयोगकर्ता नहीं' : 'No users found'} hint={isHi ? 'फिल्टर बदलें' : 'Try adjusting filters'} isHi={isHi} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-800">
                  <th className="px-4 py-3">{isHi ? 'उपयोगकर्ता' : 'User'}</th>
                  <th className="px-4 py-3">{isHi ? 'भूमिका' : 'Role'}</th>
                  <th className="px-4 py-3">{isHi ? 'रक्त' : 'Blood'}</th>
                  <th className="px-4 py-3">{isHi ? 'शहर' : 'City'}</th>
                  <th className="px-4 py-3">{isHi ? 'स्थिति' : 'Status'}</th>
                  <th className="px-4 py-3">{isHi ? 'पंजीकृत' : 'Registered'}</th>
                  <th className="px-4 py-3">{isHi ? 'अंतिम सक्रिय' : 'Last Active'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800/60">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-white/[0.04] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          u.role === 'Admin' ? 'bg-amber-500/15 border border-amber-500/20 text-amber-400'
                            : u.role === 'Donor' ? 'bg-blood-600/15 border border-blood-500/20 text-blood-400'
                            : 'bg-blue-500/15 border border-blue-500/20 text-blue-400'
                        }`}>
                          {(u.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-white">{u.name}</div>
                          <div className="text-[11px] text-ink-500">{u.email !== '—' ? u.email : u.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] border ${ROLE_COLORS[u.role] || ''}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">{u.bloodType ? <Badge tone="blood">{u.bloodType}</Badge> : <span className="text-ink-500">—</span>}</td>
                    <td className="px-4 py-3 text-ink-300 text-xs">{u.city || '—'}</td>
                    <td className="px-4 py-3"><StatusPill status={u.status} isHi={isHi} /></td>
                    <td className="px-4 py-3 text-ink-400 text-xs font-mono">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-ink-400 text-xs font-mono">{u.updatedAt ? new Date(u.updatedAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="text-[11px] text-ink-500 pl-1">{filtered.length} / {unified.length} {isHi ? 'उपयोगकर्ता' : 'users'}</div>
    </div>
  );
}
