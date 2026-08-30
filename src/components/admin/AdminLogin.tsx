import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Mail, Lock, ArrowRight } from 'lucide-react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { AdminUser } from '../../types';
import { useLanguage } from '../../lib/LanguageContext';

const ADMIN_EMAIL = import.meta.env?.VITE_ADMIN_EMAIL || 'admin@findmydonor.online';

interface AdminLoginProps {
 onLogin: (admin: AdminUser) => void;
 onBack: () => void;
}

export function AdminLogin({ onLogin, onBack }: AdminLoginProps) {
 const { language, setLanguage } = useLanguage();
 const isHi = language === 'HI';
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [error, setError] = useState('');

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 const trimmedEmail = email.trim();
 if (!trimmedEmail || !password) {
 setError(isHi ? 'ईमेल और पासवर्ड दोनों दर्ज करें।' : 'Enter both email and password.');
 return;
 }
 try {
 const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
 if (userCredential.user.email !== ADMIN_EMAIL) {
 await signOut(auth);
 setError(isHi ? 'अनधिकृत: केवल व्यवस्थापक खाते इस पैनल तक पहुँच सकते हैं।' : 'Unauthorized: Only admin accounts can access this panel.');
 return;
 }
 sessionStorage.setItem('fmd_admin_secret', 'firebase-admin');
 const admin: AdminUser = {
 id: userCredential.user.uid,
 username: userCredential.user.email?.split('@')[0] || 'Admin',
 email: userCredential.user.email || undefined,
 role: 'superadmin',
 created_at: new Date().toISOString(),
 };
 onLogin(admin);
 } catch (err: any) {
 const code = err?.code;
 if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
 setError(isHi ? 'अमान्य ईमेल या पासवर्ड।' : 'Invalid email or password.');
 } else {
 setError(isHi ? 'लॉगिन विफल। पुनः प्रयास करें।' : 'Login failed. Please try again.');
 }
 }
 };

 return (
 <div className="min-h-screen bg-ink-950 flex flex-col items-center justify-center p-6 text-white overflow-hidden relative">
 {/* Dark glowing backdrop */}
 <div className="absolute inset-0 grid-pattern-dark opacity-30 pointer-events-none" />

 {/* Top right language switcher */}
 <div className="absolute top-6 right-6 z-20 flex items-center bg-ink-950 p-1 gap-1 border border-ink-800">
 <button
 onClick={() => setLanguage('EN')}
 className={`px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
 !isHi ? 'bg-blood-600 text-white' : 'text-ink-400 hover:text-white'
 }`}
 >
 EN
 </button>
 <button
 onClick={() => setLanguage('HI')}
 className={`px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
 isHi ? 'bg-blood-600 text-white' : 'text-ink-400 hover:text-white'
 }`}
 >
 HI
 </button>
 </div>

 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="w-full max-w-md relative z-10"
>
 <button
 onClick={onBack}
 className="mb-8 text-ink-400 hover:text-white transition flex items-center text-sm font-mono uppercase tracking-widest cursor-pointer"
>
 ← {isHi ? 'वापस जाएं' : 'Abort Access'}
 </button>

 <div className="bg-ink-900 border border-ink-800 p-8">
 <div className="flex justify-center mb-6">
 <div className="w-16 h-16 bg-blood-950 border border-blood-500/30 flex items-center justify-center">
 <ShieldAlert className="h-8 w-8 text-blood-400" />
 </div>
 </div>
 
 <div className="text-center mb-8">
 <h1 className="text-2xl font-bold font-mono tracking-tight text-white mb-2">
 {isHi ? 'प्रतिबंधित क्षेत्र' : 'Restricted Area'}
 </h1>
 <p className="text-sm text-ink-400 font-mono">
 {isHi ? 'नियंत्रण केंद्र तक पहुँचने के लिए ईमेल और पासवर्ड दर्ज करें।' : 'Enter admin credentials to access the control tower.'}
 </p>
 </div>

 <form onSubmit={handleSubmit} className="space-y-5">
 <div className="space-y-1">
 <label className="text-xs font-mono uppercase tracking-wider text-ink-400 ml-1">
 {isHi ? 'ईमेल' : 'Email'}
 </label>
 <div className="relative">
 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
 <Mail className="h-5 w-5 text-ink-500" />
 </div>
 <input
 type="email"
 value={email}
 onChange={(e) => { setEmail(e.target.value); setError(''); }}
 className="w-full bg-ink-950 border border-ink-700 pl-12 pr-4 py-3.5 text-white placeholder:text-ink-500 focus:outline-none focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500 transition-colors font-mono"
 placeholder="admin@findmydonor.online"
 required
 />
 </div>
 </div>

 <div className="space-y-1">
 <label className="text-xs font-mono uppercase tracking-wider text-ink-400 ml-1">
 {isHi ? 'पासवर्ड' : 'Password'}
 </label>
 <div className="relative">
 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
 <Lock className="h-5 w-5 text-ink-500" />
 </div>
 <input
 type="password"
 value={password}
 onChange={(e) => { setPassword(e.target.value); setError(''); }}
 className="w-full bg-ink-950 border border-ink-700 pl-12 pr-4 py-3.5 text-white placeholder:text-ink-500 focus:outline-none focus:border-blood-500 focus:outline-1 focus:outline-offset-0 focus:outline-blood-500 transition-colors font-mono"
 placeholder="••••••••"
 required
 />
 </div>
 </div>

 {error && (
 <motion.p 
 initial={{ opacity: 0 }} 
 animate={{ opacity: 1 }} 
 className="text-xs text-blood-400 font-mono"
>
 {error}
 </motion.p>
 )}

 <button
 type="submit"
 className="w-full flex items-center justify-center gap-2 bg-white text-ink-950 font-bold font-mono uppercase tracking-wider py-4 hover:bg-ink-100 transition-colors group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600"
>
 <Lock className="h-4 w-4" />
 {isHi ? 'प्रमाणित करें (Authenticate)' : 'Authenticate'}
 <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
 </button>
 </form>
 
 <div className="mt-8 text-center border-t border-ink-800 pt-6">
 <p className="text-[10px] text-ink-600 font-mono uppercase tracking-widest">
 {isHi ? 'अनधिकृत प्रवेश सख्त वर्जित है और निगरानी में है।' : 'Unauthorized access is strictly prohibited and monitored.'}
 </p>
 </div>
 </div>
 </motion.div>
 </div>
 );
}
