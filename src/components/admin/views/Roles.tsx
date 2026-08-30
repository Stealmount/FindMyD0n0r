import React from 'react';
import { ShieldCheck, Lock, Check, Minus } from 'lucide-react';

interface RolesProps {
 isHi: boolean;
}

// Read-only permissions matrix. Server-side enforcement stays in adminCheck
// (admin-server.ts). This is a visibility surface, not a security boundary.
const MATRIX: { module: string; hi: string; superadmin: boolean; moderator: boolean }[] = [
 { module: 'Dashboard & telemetry', hi: 'डैशबोर्ड और टेलीमेट्री', superadmin: true, moderator: true },
 { module: 'Donor management', hi: 'दाता प्रबंधन', superadmin: true, moderator: true },
 { module: 'Requester management', hi: 'अनुरोधकर्ता प्रबंधन', superadmin: true, moderator: true },
 { module: 'Blood request oversight', hi: 'रक्त अनुरोध निगरानी', superadmin: true, moderator: true },
 { module: 'Match outcome override', hi: 'मिलान परिणाम ओवरराइड', superadmin: true, moderator: false },
 { module: 'Institution approval', hi: 'संस्थान अनुमोदन', superadmin: true, moderator: true },
 { module: 'SOS broadcast', hi: 'SOS प्रसारण', superadmin: true, moderator: false },
 { module: 'Audit log access', hi: 'ऑडिट लॉग पहुंच', superadmin: true, moderator: true },
 { module: 'Content / FAQ', hi: 'सामग्री / FAQ', superadmin: true, moderator: true },
 { module: 'System settings', hi: 'सिस्टम सेटिंग्स', superadmin: true, moderator: false },
];

export default function Roles({ isHi }: RolesProps) {
 return (
 <div className="space-y-6">
 <div className="border border-ink-800 bg-ink-900 p-6">
 <div className="flex items-center gap-3 mb-2">
 <div className="w-10 h-10 bg-blood-600/15 border border-blood-500/30 flex items-center justify-center">
 <ShieldCheck className="w-5 h-5 text-blood-400" />
 </div>
 <div>
 <h3 className="text-[15px] font-bold text-white">{isHi ? 'भूमिकाएं और पहुंच' : 'Roles & Access'}</h3>
 <p className="text-[11px] text-ink-500">
 {isHi
 ? 'पहुंच मैट्रिक्स — वास्तविक प्रवर्तन सर्वर-साइड (adminCheck) पर है'
 : 'Access matrix — real enforcement stays server-side (adminCheck)'}
 </p>
 </div>
 </div>

 <div className="border border-ink-800/60 bg-ink-950 p-4 flex items-center gap-3 text-xs">
 <Lock className="w-4 h-4 text-amber-400 shrink-0" />
 <p className="text-ink-300">
 {isHi
 ? 'प्रवेश ADMIN_AUTH_SECRET + सर्वर JWT द्वारा नियंत्रित है। ब्राउज़र में भूमिकाएं बदलना सुरक्षा सीमा नहीं है।'
 : 'Access is gated by ADMIN_AUTH_SECRET + short-lived server JWT. This matrix is informational; editing it here does not change server enforcement.'}
 </p>
 </div>
 </div>

 <div className="border border-ink-800 bg-ink-900 overflow-hidden">
 <table className="w-full text-sm">
 <thead>
 <tr className="text-left text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-800">
 <th className="px-6 py-4">{isHi ? 'मॉड्यूल' : 'Module'}</th>
 <th className="px-4 py-4 text-center">{isHi ? 'सुपरएडमिन' : 'Superadmin'}</th>
 <th className="px-4 py-4 text-center">{isHi ? 'मॉडरेटर' : 'Moderator'}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-ink-800/60">
 {MATRIX.map(m => (
 <tr key={m.module} className="hover:bg-white/[0.04] transition-colors">
 <td className="px-6 py-3.5">
 <span className="text-[13px] text-white font-medium">{m.module}</span>
 <span className="block text-[10px] text-ink-500">{m.hi}</span>
 </td>
 <td className="px-4 py-3.5 text-center">
 {m.superadmin
 ? <Check className="w-4 h-4 text-vital-400 inline" />
 : <Minus className="w-4 h-4 text-ink-700 inline" />}
 </td>
 <td className="px-4 py-3.5 text-center">
 {m.moderator
 ? <Check className="w-4 h-4 text-vital-400 inline" />
 : <Minus className="w-4 h-4 text-ink-700 inline" />}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 );
}
