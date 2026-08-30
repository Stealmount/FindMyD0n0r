import React from 'react';
import { Home, HeartPulse, Activity, UserPlus, UserCheck } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { useAuth } from '../../lib/AuthContext';

interface MobileBottomNavProps {
 activeView: string;
 onNavigate: (view: any) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
 activeView,
 onNavigate
}) => {
 const { loggedInUser, loggedInRequester } = useAuth();
 const { language } = useLanguage();
 const isHi = language === 'HI';

 const getDashboardView = () => {
 if (loggedInUser) return 'donor-dashboard';
 if (loggedInRequester) return 'requester-portal';
 return 'auth-signin';
 };

 const navItems = [
 {
 id: 'home',
 label: isHi ? 'होम' : 'Explore',
 icon: Home,
 view: 'home',
 activeColor: 'text-blood-600',
 },
 {
 id: 'request',
 label: isHi ? 'रक्त मांग' : 'Request Blood',
 icon: HeartPulse,
 view: 'request',
 isSOS: true,
 activeColor: 'text-blood-600',
 },
 {
 id: 'tracking',
 label: isHi ? 'ट्रैकिंग' : 'Track Code',
 icon: Activity,
 view: 'tracking',
 activeColor: 'text-blood-600',
 },
 {
 id: 'donor',
 label: isHi ? 'रक्तदाता' : 'Donor',
 icon: UserPlus,
 view: 'donor-register',
 activeColor: 'text-blood-600',
 },
 {
 id: 'dashboard',
 label: loggedInUser || loggedInRequester ? (isHi ? 'पोर्टल' : 'My Portal') : (isHi ? 'लॉग इन' : 'Sign In'),
 icon: UserCheck,
 view: getDashboardView(),
 activeColor: 'text-blood-600',
 },
 ];

 return (
 <nav
 id="mobile-bottom-nav"
 className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-ink-200 px-2 py-1.5 pb-[env(safe-area-inset-bottom)]"
>
 <div className="grid grid-cols-5 items-center justify-around max-w-md mx-auto">
 {navItems.map((item) => {
 const Icon = item.icon;
 const isActive = activeView === item.view;
 if (item.isSOS) {
 return (
 <button
 key={item.id}
 type="button"
 onClick={() => onNavigate(item.view)}
 className="flex flex-col items-center justify-center -mt-6 cursor-pointer group"
 >
 <div className="w-12 h-12 rounded-full bg-blood-600 text-white flex items-center justify-center group-active:scale-95 transition-transform border-4 border-[#FAFAFA]">
 <Icon className="w-6 h-6 animate-pulse" />
 </div>
 <span className="text-[10px] font-bold text-blood-600 mt-1 tracking-tight">
 {item.label}
 </span>
 </button>
 );
 }

 return (
 <button
 key={item.id}
 type="button"
 onClick={() => onNavigate(item.view)}
 className={`flex flex-col items-center justify-center py-1.5 px-1 transition-colors cursor-pointer min-h-[44px] min-w-[44px] ${
 isActive ? 'text-blood-600 font-bold' : 'text-ink-500 hover:text-ink-900'
 }`}
 >
 <Icon
 className={`w-5 h-5 transition-transform ${
 isActive ? 'scale-110 text-blood-600' : ''
 }`}
 />
 <span className={`text-[10px] tracking-tight mt-1 ${isActive ? 'font-bold' : 'font-medium'}`}>
 {item.label}
 </span>
 </button>
 );
 })}
 </div>
 </nav>
 );
};
