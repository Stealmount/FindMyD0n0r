"use client";

import { motion } from "framer-motion";
import { Search, Bell, MapPin, Heart, ArrowRight } from "lucide-react";

const steps = [
 {
 n: "01",
 icon: Search,
 title: "Post a request",
 desc: "Hospitals, patients, or family members post the blood group, units needed, and urgency. Takes 30 seconds.",
 iconColor: "text-blood-600",
 iconBg: "bg-blood-50",
 },
 {
 n: "02",
 icon: Bell,
 title: "Donors get notified",
 desc: "Our matching engine pushes a real-time ping to every verified donor within 3 km whose blood group and 90-day eligibility fits.",
 iconColor: "text-amber-600",
 iconBg: "bg-amber-50",
 },
 {
 n: "03",
 icon: MapPin,
 title: "Live navigation",
 desc: "The first donor to accept is routed directly to the hospital or pickup point. Others remain on standby for additional units.",
 iconColor: "text-vital-600",
 iconBg: "bg-vital-50",
 },
 {
 n: "04",
 icon: Heart,
 title: "Donate. Track. Repeat.",
 desc: "After donation, a 90-day cooldown is automatically applied. Donors build a verified giving record they can carry for life.",
 iconColor: "text-ink-600",
 iconBg: "bg-ink-50",
 },
];

export function HowItWorks() {
 return (
 <section
 id="how-it-works"
 className="relative py-20 sm:py-28 bg-white"
>
 <div className="mx-auto max-w-6xl px-5 sm:px-8">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ duration: 0.6 }}
 className="max-w-2xl"
>
 <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-blood-600">
 How it works
 </p>
 <h2 className="mt-2 text-[clamp(1.85rem,4.5vw,3rem)] font-medium leading-[1.05] tracking-tight text-ink-900">
 Four steps.{" "}
 <span className="font-serif italic">Minutes,</span> not hours.
 </h2>
 <p className="mt-4 text-[16px] leading-relaxed text-ink-600">
 The same emergency workflow that hospitals use — packaged into a
 consumer app for patients, families, and on-call donors.
 </p>
 </motion.div>

 <div className="mt-14 relative">
 {/* Connecting line on desktop */}
 <div
 className="hidden lg:block absolute top-12 left-0 right-0 h-px bg-ink-200"
 aria-hidden
 />

 <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
 {steps.map((s, i) => (
 <motion.div
 key={s.n}
 initial={{ opacity: 0, y: 30 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true, margin: "-40px" }}
 transition={{ duration: 0.6, delay: i * 0.1 }}
 className="group relative bg-white border border-ink-200 p-6 overflow-hidden"
>
 <div className="relative">
 <div className="flex items-center justify-between">
 <div
 className={`relative grid h-12 w-12 place-items-center ${s.iconBg} ring-1 ring-ink-100`}
>
 <s.icon className={`h-5 w-5 ${s.iconColor}`} strokeWidth={2} />
 </div>
 <span className="text-[11px] font-semibold tracking-[0.18em] text-ink-300">
 STEP {s.n}
 </span>
 </div>
 <h3 className="mt-5 text-[18px] font-semibold tracking-tight text-ink-900">
 {s.title}
 </h3>
 <p className="mt-2 text-[13.5px] leading-relaxed text-ink-600">
 {s.desc}
 </p>
 </div>
 </motion.div>
 ))}
 </div>
 </div>
 </div>
 </section>
 );
}
