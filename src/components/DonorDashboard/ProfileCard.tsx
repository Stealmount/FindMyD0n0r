import React from 'react';
import { useState } from 'react';
import { User, Match, DonationLog } from '../../types';
import { useLanguage } from '../../lib/LanguageContext';
import {
 Heart,
 MapPin,
 Clock,
 Phone,
 User as UserIcon,
LogOut,
  Shield,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import DeleteAccountModal from '../ui/DeleteAccountModal';

interface ProfileCardProps {
 user: User;
 matches: Match[];
 donationLogs: DonationLog[];
 onLogout: () => void;
 onCompleteProfile: () => void;
}

/** Glass overview header, warning banners, medical summary, and donor stat strip. */
export default function ProfileCard({ user, matches, donationLogs, onLogout, onCompleteProfile }: ProfileCardProps) {
 const { t, language } = useLanguage();
 const isHi = language === 'HI';
 const isCooldown = user.account_status === 'cooldown';
 const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
  <>
  {/* Flat Brand Identity Header - compact + responsive */}
  <div className="bg-blood-700 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 min-w-0 overflow-hidden">
  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
  <div className="grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center border border-white/20 bg-black/20 text-white">
  <UserIcon className="w-6 h-6 sm:w-7 sm:h-7" />
  </div>
  <div className="min-w-0 flex-1">
  <div className="flex flex-wrap items-center gap-2">
  <h2 className="font-display text-lg sm:text-xl font-semibold tracking-tight text-white truncate max-w-[160px] sm:max-w-none">{user.full_name}</h2>
 {user.aadhaar_verified && (
 <div className="inline-flex items-center gap-1 border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
 <Shield className="w-3 h-3 text-blood-300 fill-blood-300/20" />
 <span>DigiLocker</span>
 </div>
 )}
 <span className={`inline-flex items-center border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
 isCooldown ? 'border-white/15 bg-white/10 text-white' :
 user.account_status === 'active' ? 'border-vital-400/30 bg-vital-500/20 text-vital-100' : 'border-white/10 bg-white/5 text-white/70'
 }`}>
 {isHi ? (user.account_status === 'active' ? 'सक्रिय' : user.account_status === 'cooldown' ? 'विश्राम अवधि' : 'निष्क्रिय') : user.account_status}
 </span>
 </div>
  <p className="text-[11px] sm:text-xs text-white/80 mt-1 truncate">{t.donorDashboard.memberSince} {new Date(user.created_at).toLocaleDateString()}</p>
  {user.email && (
  <p className="text-[11px] text-white/70 mt-0.5 truncate max-w-[200px] sm:max-w-[240px]">{user.email}</p>
  )}
 </div>
 </div>

  {/* Cooldown End Timer Display */}
  {isCooldown && user.cooldown_until && (
  <div id="cooldown-timer-badge" className="flex items-center gap-2.5 border border-white/15 bg-white/10 p-3 w-full sm:w-auto sm:max-w-xs min-w-0">
  <Clock className="w-4 h-4 text-white/90 flex-shrink-0" />
  <div className="text-xs text-white/90 leading-tight min-w-0">
  <span className="font-semibold text-white block mb-0.5 text-[11px]">{t.donorDashboard.cooldownActive}</span>
  <span className="text-[11px] break-words">{t.donorDashboard.backInPool} <strong className="font-mono font-bold tabular-nums">{user.cooldown_until}</strong></span>
  </div>
  </div>
  )}

  <div className="flex items-center gap-2 sm:gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
  <div className="border border-white/15 bg-white/10 px-3 py-1.5 sm:px-4 sm:py-2 text-center text-white min-w-[80px] sm:min-w-[90px] flex-1 sm:flex-none">
  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-white/60">{t.donorDashboard.bloodType}</span>
  <span className="font-mono text-lg sm:text-xl font-bold">{user.blood_type || '—'}</span>
  </div>
  <button
  id="btn-donor-delete-account"
  onClick={() => setShowDeleteModal(true)}
  className="border border-white/30 bg-transparent p-2.5 sm:p-3 text-white hover:bg-white/10 transition-colors cursor-pointer min-h-[44px] min-w-[44px] grid place-items-center shrink-0"
  title={isHi ? 'खाता हटाएं' : 'Delete Account'}
 >
  <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
  </button>
  <button
  id="btn-donor-logout"
  onClick={onLogout}
  className="bg-white p-2.5 sm:p-3 text-ink-950 transition-colors hover:bg-ink-100 cursor-pointer min-h-[44px] min-w-[44px] grid place-items-center shrink-0"
  title={isHi ? 'लॉग आउट' : 'Log Out'}
 >
  <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
  </button>
  </div>
  </div>

<DeleteAccountModal
 open={showDeleteModal}
 onClose={() => setShowDeleteModal(false)}
 onDeleted={onLogout}
 />

  {/* Donor Profile & Medical Details Summary Card - compact */}
  <div className="border border-ink-200 bg-white p-4 sm:p-5">
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-100 pb-3 mb-4">
  <div className="flex items-center gap-2.5 min-w-0">
  <div className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center bg-blood-600 text-white">
  <UserIcon className="w-4 h-4 sm:w-5 sm:h-5" />
  </div>
  <div className="min-w-0">
  <h3 className="text-[13px] sm:text-[14px] font-bold text-ink-900 tracking-tight leading-tight">
  {isHi ? 'मेरी डोनर प्रोफ़ाइल और मेडिकल विवरण' : 'My Donor Medical Profile & Details'}
  </h3>
  <p className="text-[11px] leading-snug text-ink-500 line-clamp-2">
  {isHi ? 'आपातकालीन मिलान और संपर्क के लिए आपके सहेजे गए विवरण' : 'Your registered blood group, location, weight, and emergency preferences'}
  </p>
  </div>
  </div>
   {(!user.blood_type || !user.pincode) && (
   <button
    type="button"
    onClick={onCompleteProfile}
    className="inline-flex shrink-0 items-center justify-center gap-1.5 border border-ink-300 bg-white px-3 py-2 text-xs font-bold text-ink-900 transition-colors hover:border-ink-900 hover:bg-ink-50 cursor-pointer min-h-[36px] w-full sm:w-auto"
   >
    <span>{isHi ? 'अपडेट करें' : 'Update Profile'}</span>
   </button>
   )}
  </div>

  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
 {/* Blood Group */}
 <div className="border border-ink-100 bg-ink-50 p-3.5 space-y-1">
 <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
 {isHi ? 'ब्लड ग्रुप' : 'Blood Group'}
 </span>
 <div className="flex items-center gap-1.5">
 <span className="font-mono text-lg font-bold text-blood-600">
 {user.blood_type || (isHi ? 'दर्ज नहीं ⚠️' : 'Not Set ⚠️')}
 </span>
 </div>
 </div>

 {/* Weight */}
 <div className="border border-ink-100 bg-ink-50 p-3.5 space-y-1">
 <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
 {isHi ? 'वजन (किग्रा)' : 'Weight (kg)'}
 </span>
 <span className="font-mono text-base font-bold tabular-nums text-ink-900">
 {user.weight_kg ? `${user.weight_kg} kg` : (isHi ? 'दर्ज नहीं ⚠️' : 'Not Set ⚠️')}
 </span>
 </div>

 {/* Location & Pincode */}
 <div className="border border-ink-100 bg-ink-50 p-3.5 space-y-1">
 <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
 {isHi ? 'स्थान / पिनकोड' : 'Pincode & Location'}
 </span>
 <div className="flex items-center gap-1 font-bold text-ink-900 truncate">
 <MapPin className="w-3.5 h-3.5 shrink-0 text-blood-600" />
 <span className="truncate">
 {user.pincode ? `${user.area || ''} (${user.pincode})` : (isHi ? 'दर्ज नहीं ⚠️' : 'Not Set ⚠️')}
 </span>
 </div>
 </div>

 {/* WhatsApp / Phone */}
 <div className="border border-ink-100 bg-ink-50 p-3.5 space-y-1">
 <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
 {isHi ? 'WhatsApp नंबर' : 'WhatsApp Contact'}
 </span>
 <div className="flex items-center gap-1 font-bold text-ink-900 truncate">
 <Phone className="w-3.5 h-3.5 shrink-0 text-blood-600" />
 <span className="truncate">
 {user.whatsapp_number || user.phone || '—'}
 </span>
 </div>
 </div>
 </div>
 </div>

  {/* Donor Stat Strip - responsive */}
  <div id="donor-stat-strip" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
  <div className="border border-ink-200 bg-white p-4 hover:border-ink-300 transition-colors min-w-0">
  <div className="flex items-center justify-between gap-2">
  <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-[0.14em] leading-tight">
  {isHi ? 'लंबित मिलान' : 'Pending Matches'}
  </span>
   <div className="grid h-8 w-8 shrink-0 place-items-center border border-ink-200 bg-ink-50 text-ink-600">
   <Clock className="w-4 h-4" />
   </div>
  </div>
  {(() => { const n = matches.filter(m => m.donor_response === 'pending').length; return <p className={`font-display text-xl sm:text-2xl tracking-tight tabular-nums mt-1.5 ${n === 0 ? 'text-ink-400 font-semibold' : 'text-ink-900 font-extrabold'}`}>{n}</p>; })()}
  <p className="text-[10px] leading-snug text-ink-400 mt-1">
  {isHi ? 'कार्रवाई की प्रतीक्षा में' : 'Awaiting your response'}
  </p>
  </div>

  <div className="border border-ink-200 bg-white p-4 hover:border-ink-300 transition-colors min-w-0">
  <div className="flex items-center justify-between gap-2">
  <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-[0.14em] leading-tight">
  {isHi ? 'कुल रक्तदान' : 'Total Donations'}
  </span>
  <div className="grid h-8 w-8 shrink-0 place-items-center border border-blood-200 bg-blood-50 text-blood-600">
  <Heart className="w-4 h-4 fill-blood-500/20" />
  </div>
  </div>
  <p className={`font-display text-xl sm:text-2xl tracking-tight tabular-nums mt-1.5 ${donationLogs.length === 0 ? 'text-ink-400 font-semibold' : 'text-ink-900 font-extrabold'}`}>
  {donationLogs.length}
  </p>
  <p className="text-[10px] leading-snug text-ink-400 mt-1">
  {isHi ? 'सफलतापूर्वक पूर्ण' : 'Completed lifetime'}
  </p>
  </div>

  <div className="border border-ink-200 bg-white p-4 hover:border-ink-300 transition-colors min-w-0">
  <div className="flex items-center justify-between gap-2">
  <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-[0.14em] leading-tight">
  {isHi ? 'बचाए गए जीवन' : 'Lives Saved'}
  </span>
  <div className="grid h-8 w-8 shrink-0 place-items-center border border-blood-200 bg-blood-50 text-blood-700">
  <Shield className="w-4 h-4" />
  </div>
  </div>
  <p className={`font-display text-xl sm:text-2xl tracking-tight tabular-nums mt-1.5 ${donationLogs.length * 3 === 0 ? 'text-ink-400 font-semibold' : 'text-blood-600 font-extrabold'}`}>
  {donationLogs.length * 3}
  </p>
  <p className="text-[10px] leading-snug text-ink-400 mt-1">
  {isHi ? 'अनुमानित प्रभाव (3 जीवन/रक्तदान)' : 'Estimated impact (3 lives/donation)'}
  </p>
  </div>
  </div>
 </>
 );
}
