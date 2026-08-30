import React, { useState } from 'react';
import { ArrowLeft, BookOpen, Heart, ShieldCheck, HelpCircle, ChevronRight, Check, X } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface GuidesPageProps {
 onNavigate: (view: any) => void;
}

interface Article {
 id: string;
 title: string;
 category: string;
 readTime: string;
 date: string;
 summary: string;
 content: React.ReactNode;
}

export function GuidesPage({ onNavigate }: GuidesPageProps) {
 const { language } = useLanguage();
 const isHi = language === 'HI';
 const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

 const articles: Article[] = [
 {
 id: 'eligibility-guide',
 title: isHi ? 'रक्तदान कौन कर सकता है? भारत में पूर्ण पात्रता मानदंड' : 'Who Can Donate Blood? Complete Eligibility Criteria in India',
 category: isHi ? 'पात्रता निर्देशिका' : 'Eligibility Guide',
 readTime: '4 min read',
 date: 'July 28, 2026',
 summary: isHi ? 'आयु (18-65), 45 किग्रा वजन नियम, 90-दिन का कूलडाउन और एनबीटीसी दिशानिर्देशों के तहत स्वास्थ्य आवश्यकताओं की पूरी जानकारी।' : 'Complete breakdown of age (18-65), 45kg+ weight rule, 90-day cooldown, and medical clearance requirements per NBTC guidelines.',
 content: (
 <div className="max-w-[68ch] space-y-6 text-[15px] leading-relaxed text-ink-700">
 <p className="text-[17px] leading-relaxed text-ink-600">
 Blood donation is a simple, safe, and life-saving act. However, to protect both the donor and the patient receiving the blood, clinical eligibility guidelines are strictly enforced across Indian medical facilities. Below is the complete breakdown of who can donate blood in India.
 </p>

 <section className="space-y-3 border border-ink-100 bg-ink-50 p-5">
 <h3 className="text-base font-bold text-blood-700">1. Basic Demographics & Physical Criteria</h3>
 <ul className="list-disc pl-5 space-y-2">
 <li><strong>Age:</strong> You must be between <strong>18 and 65 years old</strong>.</li>
 <li><strong>Weight:</strong> Minimum weight requirement is <strong>45 kg</strong> for whole blood donation.</li>
 <li><strong>Pulse & Blood Pressure:</strong> Systolic 100–140 mmHg, Diastolic 60–90 mmHg.</li>
 <li><strong>Hemoglobin Level:</strong> Minimum <strong>12.5 g/dL</strong> (tested on-site via a quick finger-prick test before donation).</li>
 <li><strong>Body Temperature:</strong> Normal body temperature (37°C / 98.6°F) with no active fever.</li>
 </ul>
 </section>

 <section className="space-y-3 border border-ink-100 bg-ink-50 p-5">
 <h3 className="text-base font-bold text-blood-700">2. Mandatory Donation Cooldown Intervals</h3>
 <ul className="list-disc pl-5 space-y-2">
 <li><strong>Male Donors:</strong> Must wait at least <strong>90 days (3 months)</strong> between whole blood donations.</li>
 <li><strong>Female Donors:</strong> Must wait at least <strong>120 days (4 months)</strong> between whole blood donations.</li>
 <li><strong>Platelet / Apheresis Donors:</strong> Can donate every 14 days (up to 24 times a year).</li>
 </ul>
 </section>

 <section className="space-y-3 border border-ink-100 bg-ink-50 p-5">
 <h3 className="text-base font-bold text-blood-700">3. Temporary Deferral Criteria (When to Wait)</h3>
 <ul className="list-disc pl-5 space-y-2">
 <li><strong>Tattoos / Piercings:</strong> Wait <strong>6 months</strong> post procedure.</li>
 <li><strong>Antibiotics:</strong> Wait <strong>14 days</strong> after completing antibiotic course.</li>
 <li><strong>Alcohol:</strong> Abstain for at least <strong>24 hours</strong> prior to donation.</li>
 <li><strong>Pregnancy & Breastfeeding:</strong> Defer during pregnancy and for <strong>12 months</strong> post-childbirth.</li>
 </ul>
 </section>
 </div>
 ),
 },
 {
 id: 'myths-vs-facts',
 title: isHi ? 'रक्तदान मिथक बनाम तथ्य: दान के दौरान और बाद में क्या होता है' : 'Blood Donation Myths vs Facts: What Happens During and After Donation',
 category: isHi ? 'स्वास्थ्य जागरूकता' : 'Health Awareness',
 readTime: '3 min read',
 date: 'July 28, 2026',
 summary: isHi ? 'कमजोरी, रिकवरी समय और हीमोग्लोबिन पुनर्पूर्ति के बारे में आम गलतफहमियों का खंडन।' : 'Debunking common misconceptions regarding weakness, recovery time, hemoglobin replenishment, and donor safety.',
 content: (
 <div className="max-w-[68ch] space-y-6 text-[15px] leading-relaxed text-ink-700">
 <p className="text-[17px] leading-relaxed text-ink-600">
 Many eligible individuals hesitate to donate blood due to common myths about physical weakness or infection risk. Here are the medical facts behind voluntary blood donation.
 </p>

 <section className="space-y-4">
 <div className="space-y-2 border border-l-4 border-l-blood-600 border-ink-100 bg-ink-50 p-5">
 <h3 className="flex items-start gap-1.5 text-sm font-bold text-blood-700"><X className="mt-0.5 h-3.5 w-3.5 shrink-0" />Myth 1: "Donating blood causes permanent physical weakness."</h3>
 <p className="text-[13px] leading-relaxed text-ink-600">
 <strong className="text-vital-700"><Check className="mr-1 -mt-0.5 inline h-3.5 w-3.5" />Fact:</strong> Your body replaces lost fluid volume within 24 to 48 hours. Red blood cells are fully replenished by your bone marrow within 4 to 8 weeks. Healthy individuals experience zero long-term loss of strength.
 </p>
 </div>

 <div className="space-y-2 border border-l-4 border-l-blood-600 border-ink-100 bg-ink-50 p-5">
 <h3 className="flex items-start gap-1.5 text-sm font-bold text-blood-700"><X className="mt-0.5 h-3.5 w-3.5 shrink-0" />Myth 2: "You can contract infections like HIV while donating."</h3>
 <p className="text-[13px] leading-relaxed text-ink-600">
 <strong className="text-vital-700"><Check className="mr-1 -mt-0.5 inline h-3.5 w-3.5" />Fact:</strong> Every single needle and collection bag used during blood donation is 100% sterile, single-use, and discarded immediately after use. It is physically impossible to contract HIV or any infection from donating blood.
 </p>
 </div>

 <div className="space-y-2 border border-l-4 border-l-blood-600 border-ink-100 bg-ink-50 p-5">
 <h3 className="flex items-start gap-1.5 text-sm font-bold text-blood-700"><X className="mt-0.5 h-3.5 w-3.5 shrink-0" />Myth 3: "Blood donation takes hours."</h3>
 <p className="text-[13px] leading-relaxed text-ink-600">
 <strong className="text-vital-700"><Check className="mr-1 -mt-0.5 inline h-3.5 w-3.5" />Fact:</strong> The actual blood extraction process takes only 8 to 10 minutes. The entire appointment—including registration, mini-health check, donation, and 15-minute post-donation snack rest—takes under 45 minutes.
 </p>
 </div>
 </section>
 </div>
 ),
 },
 {
 id: 'emergency-guide',
 title: isHi ? 'दिल्ली एनसीआर में आपातकालीन रक्त आवश्यकता गाइड' : 'Emergency Blood Request Guide for Delhi NCR Hospitals',
 category: isHi ? 'आपातकालीन गाइड' : 'Emergency Guide',
 readTime: '5 min read',
 date: 'July 28, 2026',
 summary: isHi ? 'अस्पताल के मरीज के लिए त्वरित रक्त मिलान प्राप्त करने का चरण-दर-चरण तरीका।' : 'Step-by-step procedure to raise emergency blood requests, verify hospital details, and coordinate walk-in donors.',
 content: (
 <div className="max-w-[68ch] space-y-6 text-[15px] leading-relaxed text-ink-700">
 <p className="text-[17px] leading-relaxed text-ink-600">
 When a family member or patient requires urgent blood at a Delhi NCR hospital, every minute counts. Follow this guide to maximize your match response speed.
 </p>

 <section className="space-y-3 border border-ink-100 bg-ink-50 p-5">
 <h3 className="text-base font-bold text-blood-700">Step 1: Gather Complete Hospital Details</h3>
 <p className="text-[13px] leading-relaxed text-ink-600">
 Ensure you have the exact Hospital Name, Hospital Pincode, Patient UHID/Bed Number, and required Blood Component (Whole Blood vs PRBC) from the attending doctor.
 </p>
 </section>

 <section className="space-y-3 border border-ink-100 bg-ink-50 p-5">
 <h3 className="text-base font-bold text-blood-700">Step 2: Submit Emergency Broadcast on FindMyDonor</h3>
 <p className="text-[13px] leading-relaxed text-ink-600">
 Fill out the 2-minute Request Form. Check <strong>"Share my contact details immediately"</strong> so matched donors can call you directly upon accepting the WhatsApp alert.
 </p>
 </section>

 <section className="space-y-3 border border-ink-100 bg-ink-50 p-5">
 <h3 className="text-base font-bold text-blood-700">Step 3: Check Institutional Blood Banks Simultaneously</h3>
 <p className="text-[13px] leading-relaxed text-ink-600">
 While our automated system alerts nearby walk-in voluntary donors, check the official e-RaktKosh national blood bank portal for institutional blood bank stocks in your area.
 </p>
 </section>
 </div>
 ),
 },
 ];

 const activeArticle = articles.find(a => a.id === selectedArticleId) || null;

 return (
 <div className="min-h-screen bg-[#FAFAFA] text-ink-900 py-12 px-4 sm:px-6 lg:px-8">
 <div className="max-w-4xl mx-auto space-y-8">
 
 {/* Header Navigation */}
 <div className="flex items-center justify-between border-b border-ink-200 pb-6">
 <button
 onClick={() => activeArticle ? setSelectedArticleId(null) : onNavigate('home')}
 className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900 transition-colors cursor-pointer"
>
 <ArrowLeft className="w-4 h-4" />
 <span>{activeArticle ? (isHi ? 'गाइड सूची पर लौटें' : 'Back to All Guides') : (isHi ? 'मुख्य पृष्ठ पर लौटें' : 'Back to Home')}</span>
 </button>
 <div className="flex items-center gap-2 text-blood-600 font-bold text-sm">
 <BookOpen className="w-5 h-5" />
 <span>FindMyDonor™ Resource Hub</span>
 </div>
 </div>

 {!activeArticle ? (
 /* Article List View */
 <div className="space-y-8">
 <div className="space-y-2">
 <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ink-900">
 {isHi ? 'रक्तदान शिक्षा और गाइड' : 'Educational Guides & Resources'}
 </h1>
 <p className="text-[17px] leading-relaxed text-ink-600">
 {isHi ? 'पात्रता, रक्तदान मिथकों और आपातकालीन सहायता के बारे में विश्वसनीय जानकारी।' : 'Evidence-based guides on eligibility, blood donation safety, and emergency coordination.'}
 </p>
 </div>

 <div className="grid grid-cols-1 gap-4 pt-2">
 {articles.map((art) => (
 <div
 key={art.id}
 onClick={() => setSelectedArticleId(art.id)}
 className="group cursor-pointer space-y-3 border border-ink-200 bg-white p-5 sm:p-6 transition-colors hover:border-ink-300"
>
 <div className="flex items-center justify-between gap-3">
 <span className="inline-flex shrink-0 items-center border border-blood-200 bg-blood-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-blood-700">
 {art.category}
 </span>
 <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-500">{art.readTime} • {art.date}</span>
 </div>

 <h3 className="flex items-center justify-between gap-3 text-lg sm:text-xl font-bold tracking-tight text-ink-900 transition-colors group-hover:text-blood-700">
 <span>{art.title}</span>
 <ChevronRight className="w-5 h-5 shrink-0 text-ink-400 transition-all group-hover:translate-x-1 group-hover:text-blood-600" />
 </h3>

 <p className="text-sm leading-relaxed text-ink-600">
 {art.summary}
 </p>
 </div>
 ))}
 </div>
 </div>
 ) : (
 /* Article Content View */
 <div className="space-y-8">
 <div className="space-y-3 border-b border-ink-200 pb-6">
 <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
 <span className="inline-flex items-center border border-blood-200 bg-blood-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-blood-700">
 {activeArticle.category}
 </span>
 <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-500">{activeArticle.readTime} • {activeArticle.date}</span>
 </div>
 <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-900">
 {activeArticle.title}
 </h1>
 </div>

 {activeArticle.content}

 <div className="pt-8 border-t border-ink-200 flex flex-col sm:flex-row gap-4">
 <button
 onClick={() => onNavigate('auth-signup')}
 className="flex-1 bg-blood-600 py-3.5 text-center text-sm font-semibold text-white transition-colors duration-200 hover:bg-blood-700 active:bg-blood-800 cursor-pointer"
>
 {isHi ? 'रक्तदाता के रूप में पंजीकरण करें →' : 'Register as Volunteer Donor →'}
 </button>
 <button
 onClick={() => setSelectedArticleId(null)}
 className="border border-ink-300 bg-white px-6 py-3.5 text-center text-sm font-semibold text-ink-900 transition-colors duration-200 hover:border-ink-900 hover:bg-ink-50 cursor-pointer"
>
 {isHi ? 'अन्य गाइड देखें' : 'View Other Guides'}
 </button>
 </div>
 </div>
 )}

 {/* Footer Navigation */}
 <div className="pt-8 border-t border-ink-200 text-center">
 <button
 onClick={() => onNavigate('home')}
 className="border border-ink-300 bg-white px-6 py-3 text-sm font-semibold text-ink-900 transition-colors duration-200 hover:border-ink-900 hover:bg-ink-50 cursor-pointer"
>
 {isHi ? 'मुख्य पृष्ठ पर वापस जाएं' : 'Return to FindMyDonor'}
 </button>
 </div>

 </div>
 </div>
 );
}
