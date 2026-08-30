import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Droplet, MapPin, Clock, User, Lock } from 'lucide-react';
import { BloodType } from '../../../types';
import { EmptyState } from '../widgets/Shared';

interface DonorsViewProps {
  users: Array<{
    id: string;
    full_name: string;
    blood_type?: string;
    city?: string;
    phone?: string;
    whatsapp_number?: string;
  }>;
  isHi: boolean;
}

const BLOOD_GROUPS: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export function DonorsView({ users, isHi }: DonorsViewProps) {
  const [search, setSearch] = useState('');
  const [selectedBlood, setSelectedBlood] = useState<BloodType | 'all'>('all');

  const filtered = useMemo(() => {
    return users.filter(d => {
      const matchesSearch = search === '' ||
        d.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (d.city && d.city.toLowerCase().includes(search.toLowerCase()));
      const matchesBlood = selectedBlood === 'all' || d.blood_type === selectedBlood;
      return matchesSearch && matchesBlood;
    });
  }, [users, search, selectedBlood]);

  const bloodCounts = useMemo(() => {
    const counts: Record<string, number> = { all: users.length };
    BLOOD_GROUPS.forEach(bg => { counts[bg] = users.filter(d => d.blood_type === bg).length; });
    return counts;
  }, [users]);

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-500">
          {isHi ? 'दाता निर्देशिका' : 'Donor Directory'}
        </h2>
        <span className="text-[11px] font-semibold text-ink-500">
          {filtered.length} {isHi ? 'दाता' : 'donors'}
        </span>
      </div>

      {/* Privacy note */}
      <p className="flex items-center gap-1.5 text-[11px] text-ink-500 leading-relaxed">
        <Lock className="w-3 h-3 shrink-0 text-ink-500" />
        {isHi
          ? 'दाता का संपर्क विवरण केवल तब दिखता है जब वे मैच स्वीकार करते हैं — जब तक वे उत्तर नहीं देते, वे निजी रहते हैं।'
          : "A donor's contact info appears only once they approve a match — until then they stay anonymous."}
      </p>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={isHi ? 'नाम या शहर से खोजें...' : 'Search by name or city...'}
          className="w-full h-11 border border-ink-300 bg-white pl-10 pr-3.5 text-sm font-medium text-ink-900 outline-none transition-colors duration-150 placeholder:text-ink-400 focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500"
        />
      </div>

      {/* Blood group filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedBlood('all')}
          className={`shrink-0 cursor-pointer border px-3 py-1.5 text-xs font-semibold transition-colors ${
            selectedBlood === 'all'
              ? 'border-blood-600 bg-blood-600 text-white'
              : 'border-ink-300 text-ink-600 hover:border-ink-400 hover:text-ink-900'
            }`}
          >
            {isHi ? 'सभी' : 'All'} ({bloodCounts.all})
        </button>
        {BLOOD_GROUPS.map(bg => (
          <button
            key={bg}
            onClick={() => setSelectedBlood(bg)}
            className={`shrink-0 cursor-pointer border px-3 py-1.5 text-xs font-semibold transition-colors ${
              selectedBlood === bg
                ? 'border-blood-600 bg-blood-600 text-white'
                : 'border-ink-300 text-ink-600 hover:border-ink-400 hover:text-ink-900'
            }`}
          >
            {bg} ({bloodCounts[bg]})
          </button>
        ))}
      </div>

      {/* Donor list */}
      {filtered.length === 0 ? (
        <EmptyState
          title={isHi ? 'कोई दाता नहीं मिला' : 'No donors found'}
          titleHi={isHi ? 'कोई दाता नहीं मिला' : 'No donors found'}
          hint={isHi ? 'फ़िल्टर बदलकर देखें।' : 'Try adjusting your filters.'}
          hintHi={isHi ? 'फ़िल्टर बदलकर देखें।' : 'Try adjusting your filters.'}
          isHi={isHi}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(donor => (
            <motion.div
              key={donor.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 border border-ink-200 bg-white p-4 transition-colors hover:bg-ink-100"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full border border-blood-500/30 bg-blood-500/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-blood-600">{donor.blood_type || '—'}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-ink-900 truncate">{donor.full_name}</div>
                  <div className="text-[11px] text-ink-500 mt-0.5 flex items-center gap-2">
                    {donor.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {donor.city}
                      </span>
                    )}
                    {donor.blood_type && (
                      <span className="flex items-center gap-1">
                        <Droplet className="w-3 h-3" />
                        {donor.blood_type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                {donor.phone && (
                  <div className="text-[11px] font-mono text-ink-500">{donor.phone}</div>
                )}
                <div className="text-[10px] text-ink-500 flex items-center gap-1 justify-end mt-0.5">
                  <Clock className="w-3 h-3" />
                  {isHi ? 'सक्रिय' : 'Active'}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
