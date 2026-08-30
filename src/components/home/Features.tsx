import React from "react";
import { motion } from "framer-motion";
import {
 Radio,
 Users,
 ShieldCheck,
 BellRing,
 MapPinned,
 FileCheck2,
} from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

const features = [
 {
 icon: Radio,
 title: "Smart Donor Matching",
 span: "lg:col-span-2",
 },
 {
 icon: Users,
 title: "Notify Multiple Donors",
 desc: "Simultaneously notifies multiple eligible donors when more than one unit is required, so you're not dependent on a single response.",
 span: "lg:col-span-1",
 },
 {
 icon: ShieldCheck,
 title: "Safety Cooldown Tracking",
 desc: "Automatically checks donor eligibility based on recommended donation intervals. Donors within their recovery window won't be contacted.",
 span: "lg:col-span-1",
 },
 {
 icon: MapPinned,
 title: "Hospital-Aware Routing",
 desc: "Planned navigation to the exact hospital wing or blood bank counter — including entry instructions for donors.",
 span: "lg:col-span-1",
 comingSoon: true,
 },
 {
 icon: BellRing,
 title: "Timely Notifications",
 desc: "Notifications respect quiet hours, frequency caps, and donor preferences. No spam — only relevant alerts when a compatible request is nearby.",
 span: "lg:col-span-1",
 },
 {
 icon: FileCheck2,
 title: "Donor Verification",
 desc: "Supports identity verification and stores donor information. Final medical screening and donation eligibility are determined by the authorised blood bank or hospital.",
 span: "lg:col-span-1",
 },
];

export function Features() {
 const { t } = useLanguage();

 return (
 <section id="features" className="relative py-20 sm:py-28">
 <div className="mx-auto max-w-6xl px-5 sm:px-8">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 className="grid items-end gap-6 md:grid-cols-2"
 >
 <div>
  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-blood-600">
  {t.features.badge}
  </p>
  <h2 className="mt-2 font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink-900">
  {t.features.title}
  </h2>
  </div>
  <p className="text-[17px] leading-relaxed text-ink-600">
  {t.features.subtitle}
  </p>
 </motion.div>

 <div className="mt-12 grid gap-4 lg:grid-cols-3">
 {features.map((f, i) => (
 <motion.div
 key={f.title}
 initial={{ opacity: 0, y: 24 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true, margin: "-40px" }}
 transition={{ duration: 0.55, delay: (i % 3) * 0.08 }}
  className={`group relative border border-ink-200 bg-white p-6 transition-colors hover:border-ink-300 ${f.span}`}
  >
  <div className="relative flex h-full flex-col">
  <div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
  <div className="grid h-10 w-10 place-items-center bg-ink-900 text-white">
  <f.icon className="h-5 w-5" strokeWidth={2} />
  </div>
  {f.comingSoon && (
  <span className="border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700">
  Coming Soon
  </span>
  )}
  </div>
  <span className="font-mono text-[11px] tracking-[0.18em] text-ink-400">
  0{i + 1}
  </span>
  </div>
  <h3 className="mt-6 text-lg font-bold tracking-tight text-ink-900">
  {t.features.items?.[i]?.title || f.title}
  </h3>
  <p
  className={`mt-2 text-[13px] leading-relaxed text-ink-600 ${
 f.span.includes("col-span-2") ? "max-w-md" : ""
 }`}
 >
 {t.features.items?.[i]?.desc || f.desc}
 </p>
 </div>
 </motion.div>
 ))}
 </div>
 </div>
 </section>
 );
}
