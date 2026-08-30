import React from 'react';
import { ArrowLeft, Droplet, CheckCircle, ShieldAlert, Award, Heart } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { BLOOD_COMPATIBILITY_MATRIX, BloodType } from '../types';

interface BloodCompatibilityPageProps {
 onNavigate: (view: any) => void;
}

const ALL_BLOOD_TYPES: BloodType[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

export function BloodCompatibilityPage({ onNavigate }: BloodCompatibilityPageProps) {
 const { language } = useLanguage();
 const isHi = language === 'HI';

 return (
 <div className="min-h-screen bg-[#FAFAFA] text-ink-900 py-12 px-4 sm:px-6 lg:px-8">
 <div className="max-w-4xl mx-auto space-y-8">
 
 {/* Header Navigation */}
 <div className="flex items-center justify-between border-b border-ink-200 pb-6">
 <button
 onClick={() => onNavigate('home')}
 className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900 transition-colors cursor-pointer"
>
 <ArrowLeft className="w-4 h-4" />
 <span>{isHi ? 'मुख्य पृष्ठ पर लौटें' : 'Back to Home'}</span>
 </button>
 <div className="flex items-center gap-2 text-blood-600 font-bold text-sm">
 <Droplet className="w-5 h-5 fill-blood-600" />
 <span>FindMyDonor™ Clinical Reference</span>
 </div>
 </div>

 {/* Title Section */}
 <div className="space-y-2">
 <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ink-900">
 {isHi ? 'रक्त समूह अनुकूलता निर्देशिका (Blood Compatibility Guide)' : 'Blood Type Compatibility Guide'}
 </h1>
 <p className="text-[17px] leading-relaxed text-ink-600">
 {isHi 
 ? 'जानिए कौन सा रक्त समूह किसे दान कर सकता है। FindMyDonor का स्वचालित मैचिंग इंजन इन्हीं सिद्धांतों पर काम करता है।'
 : 'Understand which blood types can donate to and receive from each other. Learn how FindMyDonor matches donors with urgent requests.'}
 </p>
 </div>

 {/* Highlight Cards */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-2 border border-vital-200 bg-vital-50 p-5">
 <div className="flex items-center gap-2 font-bold text-base text-vital-700">
 <Heart className="w-5 h-5 fill-vital-600 text-vital-600" />
 <h3>{isHi ? 'O- (यूनिवर्सल डोनर)' : 'O- (Universal Donor)'}</h3>
 </div>
 <p className="text-[13px] leading-relaxed text-ink-700">
 {isHi 
 ? 'O-निगेटिव रक्त किसी भी रक्त समूह वाले मरीज को दिया जा सकता है। आपातकालीन स्थिति में O- डोनर्स की सबसे अधिक मांग होती है।'
 : 'O-Negative red blood cells can be transfused to patients of ANY blood group. It is vital in emergency traumas when patient blood type is unknown.'}
 </p>
 </div>

 <div className="space-y-2 border border-blue-200 bg-blue-50 p-5">
 <div className="flex items-center gap-2 font-bold text-base text-blue-700">
 <Award className="w-5 h-5" />
 <h3>{isHi ? 'AB+ (यूनिवर्सल प्राप्तकर्ता)' : 'AB+ (Universal Recipient)'}</h3>
 </div>
 <p className="text-[13px] leading-relaxed text-ink-700">
 {isHi 
 ? 'AB-पॉजिटिव मरीज किसी भी रक्त समूह (A, B, AB, O) से रक्त प्राप्त कर सकते हैं।'
 : 'AB-Positive patients can safely receive red blood cells from all 8 blood groups (A, B, AB, O both positive and negative).'}
 </p>
 </div>
 </div>

 {/* Master Compatibility Table */}
 <div className="border border-ink-200 bg-white p-6 sm:p-8 space-y-6">
 <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-ink-900">
 <CheckCircle className="w-5 h-5 text-vital-600" />
 <span>{isHi ? 'संपूर्ण रक्त अनुकूलता तालिका' : 'Full Blood Compatibility Matrix'}</span>
 </h2>

 <div className="divide-y divide-ink-100">
 {ALL_BLOOD_TYPES.map((type) => {
 const canReceiveFrom = BLOOD_COMPATIBILITY_MATRIX[type];
 const canGiveTo = ALL_BLOOD_TYPES.filter(recipient => 
 BLOOD_COMPATIBILITY_MATRIX[recipient].includes(type)
 );

 return (
 <div key={type} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-5 first:pt-0 last:pb-0">
 <div className="flex items-center gap-3">
 <div className="grid h-10 w-10 shrink-0 place-items-center bg-blood-600 font-display text-sm font-extrabold text-white">
 {type}
 </div>
 <div>
 <span className="text-sm font-bold text-ink-900">{isHi ? `रक्त समूह ${type}` : `Blood Group ${type}`}</span>
 <span className="mt-0.5 block text-xs text-ink-500">
 {type === 'O-' ? 'Universal Donor' : type === 'AB+' ? 'Universal Recipient' : 'Specific Match Rules'}
 </span>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:w-2/3">
 <div className="border border-ink-100 bg-ink-50 p-2.5">
 <span className="mb-0.5 block font-bold text-vital-700">{isHi ? 'दान कर सकते हैं:' : 'Can Give To:'}</span>
 <span className="font-mono font-semibold tabular-nums text-ink-800">{canGiveTo.join(', ')}</span>
 </div>
 <div className="border border-ink-100 bg-ink-50 p-2.5">
 <span className="mb-0.5 block font-bold text-blue-700">{isHi ? 'प्राप्त कर सकते हैं:' : 'Can Receive From:'}</span>
 <span className="font-mono font-semibold tabular-nums text-ink-800">{canReceiveFrom.join(', ')}</span>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* Action CTAs */}
 <div className="pt-4 flex flex-col sm:flex-row gap-4">
 <button
 onClick={() => onNavigate('auth-signup')}
 className="flex-1 bg-blood-600 py-3.5 text-center text-sm font-semibold text-white transition-colors duration-200 hover:bg-blood-700 active:bg-blood-800 cursor-pointer"
>
 {isHi ? 'रक्तदाता के रूप में पंजीकरण करें →' : 'Register as Volunteer Donor →'}
 </button>
 <button
 onClick={() => onNavigate('request')}
 className="flex-1 border border-ink-300 bg-white py-3.5 text-center text-sm font-semibold text-ink-900 transition-colors duration-200 hover:border-ink-900 hover:bg-ink-50 cursor-pointer"
>
 {isHi ? 'रक्त आवश्यकता पोस्ट करें' : 'Post Emergency Request'}
 </button>
 </div>

 </div>
 </div>
 );
}
