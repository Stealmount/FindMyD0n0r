import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, MapPin, Phone, Tent, Send, CheckCircle, Tent as TentIcon, XCircle, Plus, Clock } from 'lucide-react';
import { authenticatedApi } from '../../../lib/api';
import { DonationCamp } from '../../../types';
import { EmptyState } from '../widgets/Shared';

interface CampsViewProps {
  hospital: { city: string; phone: string; hospital_name: string };
  isHi: boolean;
}

export function CampsView({ hospital, isHi }: CampsViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [camps, setCamps] = useState<DonationCamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [campForm, setCampForm] = useState({ title: '', venue: '', date: '', time: '' });
  const [campStatus, setCampStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [lastCampId, setLastCampId] = useState('');

  const fetchCamps = async () => {
    try {
      const data = await authenticatedApi<{ camps: DonationCamp[] }>('/api/camps', undefined, 'GET');
      setCamps(data.camps || []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCamps(); }, []);

  const handleCampSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCampStatus('submitting');
    try {
      const res = await authenticatedApi<{ success: boolean; camp: { id: string } }>(
        '/api/camps', campForm, 'POST'
      );
      setLastCampId(res.camp?.id || '');
      setCampStatus('success');
      setCampForm({ title: '', venue: '', date: '', time: '' });
      fetchCamps();
      setTimeout(() => { setCampStatus('idle'); setShowForm(false); }, 3000);
    } catch {
      setCampStatus('error');
      setTimeout(() => setCampStatus('idle'), 3000);
    }
  };

  const now = new Date();
  const upcoming = camps.filter(c => new Date(c.camp_date) >= now);
  const past = camps.filter(c => new Date(c.camp_date) < now);

  const CampCard = ({ camp }: { camp: DonationCamp }) => (
    <div className="border border-ink-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-ink-900">{camp.title}</div>
          <div className="text-[11px] text-ink-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {new Date(camp.camp_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {camp.start_time && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {camp.start_time}
                {camp.end_time && ` – ${camp.end_time}`}
              </span>
            )}
          </div>
          {camp.venue_address && (
            <div className="text-[11px] text-ink-500 mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {camp.venue_address}{camp.city ? `, ${camp.city}` : ''}
            </div>
          )}
        </div>
        <span className={`shrink-0 whitespace-nowrap border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
          camp.status === 'completed' ? 'border-vital-500/30 bg-vital-500/10 text-vital-600' :
          camp.status === 'cancelled' ? 'border-blood-500/30 bg-blood-500/10 text-blood-600' :
          new Date(camp.camp_date) >= now ? 'border-blue-500/30 bg-blue-500/10 text-blue-600' :
          'border-ink-200 bg-ink-100 text-ink-600'
        }`}>
          {camp.status || (new Date(camp.camp_date) >= now ? (isHi ? 'आगामी' : 'Upcoming') : (isHi ? 'पूर्ण' : 'Completed'))}
        </span>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-500">
          {isHi ? 'दान शिविर' : 'Donation Camps'}
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 bg-blood-600 px-3 py-1.5 text-xs font-bold text-white transition-colors duration-200 hover:bg-blood-700 select-none"
          >
            <Plus className="w-3 h-3" />
            {isHi ? 'नया शिविर' : 'New Camp'}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showForm && (
          <motion.div key="form"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border border-ink-200 bg-ink-50 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-ink-900">
                  {isHi ? 'शिविर की घोषणा करें' : 'Announce a Camp'}
                </h3>
                <button onClick={() => setShowForm(false)} className="cursor-pointer text-ink-500 transition-colors hover:text-ink-900">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {campStatus === 'error' && (
                <div className="p-3 bg-blood-500/10 text-blood-600 border border-blood-500/30 text-sm mb-4">
                  {isHi ? 'शिविर बनाने में विफल।' : 'Failed to create camp.'}
                </div>
              )}

              {campStatus === 'success' ? (
                <div className="py-6 text-center space-y-2">
                  <CheckCircle className="h-8 w-8 text-vital-600 mx-auto" />
                  <p className="text-sm font-bold text-ink-900">{isHi ? 'शिविर प्रकाशित हो गया!' : 'Camp Published!'}</p>
                </div>
              ) : (
                <form onSubmit={handleCampSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block">
                      {isHi ? 'शिविर का नाम' : 'Camp Title'}
                    </label>
                    <input type="text" required value={campForm.title}
                      onChange={e => setCampForm(p => ({ ...p, title: e.target.value }))}
                      placeholder={isHi ? 'जैसे: वार्षिक रक्तदान शिविर' : 'e.g. Annual Blood Donation Camp'}
                      className="w-full h-11 border border-ink-300 bg-white px-3.5 text-sm font-medium text-ink-900 outline-none transition-colors duration-150 placeholder:text-ink-400 focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block">
                      {isHi ? 'स्थान' : 'Venue'}
                    </label>
                    <input type="text" required value={campForm.venue}
                      onChange={e => setCampForm(p => ({ ...p, venue: e.target.value }))}
                      placeholder={isHi ? 'हॉल का नाम, गली' : 'Hall name, street'}
                      className="w-full h-11 border border-ink-300 bg-white px-3.5 text-sm font-medium text-ink-900 outline-none transition-colors duration-150 placeholder:text-ink-400 focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block">
                        {isHi ? 'तिथि' : 'Date'}
                      </label>
                      <input type="date" required value={campForm.date}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setCampForm(p => ({ ...p, date: e.target.value }))}
                        className="w-full h-11 border border-ink-300 bg-white px-3.5 text-sm font-medium text-ink-900 outline-none transition-colors duration-150 placeholder:text-ink-400 focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block">
                        {isHi ? 'समय' : 'Time'}
                      </label>
                      <input type="text" required value={campForm.time}
                        onChange={e => setCampForm(p => ({ ...p, time: e.target.value }))}
                        placeholder={isHi ? 'सुबह 9 – शाम 5' : '09:00 AM – 05:00 PM'}
                        className="w-full h-11 border border-ink-300 bg-white px-3.5 text-sm font-medium text-ink-900 outline-none transition-colors duration-150 placeholder:text-ink-400 focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block">
                        {isHi ? 'शहर' : 'City'}
                      </label>
                      <div className="h-11 border border-ink-300 bg-ink-100 px-3.5 text-sm leading-[2.75rem] text-ink-600">
                        {hospital.city}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 block">
                        {isHi ? 'संपर्क' : 'Contact'}
                      </label>
                      <div className="h-11 border border-ink-300 bg-ink-100 px-3.5 font-mono text-sm leading-[2.75rem] text-ink-600">
                        {hospital.phone}
                      </div>
                    </div>
                  </div>
                  <button type="submit"
                    disabled={campStatus === 'submitting'}
                    className="inline-flex h-12 w-full cursor-pointer select-none items-center justify-center bg-blood-600 px-6 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blood-700 active:bg-blood-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {campStatus === 'submitting' ? (isHi ? 'प्रकाशित हो रहा है...' : 'Publishing...') : (isHi ? 'शिविर प्रकाशित करें' : 'Publish Camp')}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camps list */}
      {loading ? (
        <div className="py-12 text-center text-ink-500 text-sm">
          <span className="animate-pulse">{isHi ? 'लोड हो रहा है...' : 'Loading...'}</span>
        </div>
      ) : camps.length === 0 ? (
        <EmptyState
          title={isHi ? 'कोई शिविर नहीं' : 'No camps yet'}
          titleHi={isHi ? 'कोई शिविर नहीं' : 'No camps yet'}
          hint={isHi ? 'ऊपर "नया शिविर" बटन से शुरू करें।' : 'Click "New Camp" above to get started.'}
          hintHi={isHi ? 'ऊपर "नया शिविर" बटन से शुरू करें।' : 'Click "New Camp" above to get started.'}
          isHi={isHi}
        />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-3">
                {isHi ? 'आगामी शिविर' : 'Upcoming Camps'} ({upcoming.length})
              </h3>
              <div className="space-y-3">
                {upcoming.map(camp => <CampCard key={camp.id} camp={camp} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-3">
                {isHi ? 'पिछले शिविर' : 'Past Camps'} ({past.length})
              </h3>
              <div className="space-y-3">
                {past.map(camp => <CampCard key={camp.id} camp={camp} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
