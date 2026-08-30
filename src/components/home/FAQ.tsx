import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

const faqs = [
 {
 q: "How does FindMyDonor™ find a donor in real time?",
 a: "When a request is posted, our matching engine filters our network by blood group, eligibility, distance, and preferences — and pushes a notification to every donor who fits. The first to accept is locked in; others remain on warm standby for additional units.",
 },
 {
 q: "How fast is a donor matched after posting a request?",
 a: "Usually within 3 to 10 minutes. As soon as you post a blood request, our engine instantly alerts verified voluntary donors within a 3–5 km radius whose blood group matches.",
 },
 {
 q: "Is FindMyDonor™ really 100% free?",
 a: "Yes. FindMyDonor is 100% free for everyone — donors, requesters, and hospitals. We are a community platform and will never charge for connecting people with blood donors.",
 },
 {
 q: "How does the 60-day safety cooldown work?",
 a: "Once a donor logs a successful donation, their profile is automatically marked on safety recovery cooldown for 60 days (whole blood). During this period, they will not receive donation alerts.",
 },
 {
 q: "Can hospitals register and broadcast blood needs?",
 a: "Yes. Hospitals and blood banks have a dedicated Requester Portal where they can post multi-unit requests and track real-time donor responses.",
 },
 {
 q: "How do hospitals integrate FindMyDonor™?",
 a: "Hospitals can register on our platform to post blood requirements and coordinate with voluntary donors. Deeper integration features including inventory dashboards and API access are currently in development.",
 },
 {
 q: "Is my phone number visible to anyone?",
 a: "No. Your phone number stays completely private until both you and the other party confirm a match. We never share contact details without mutual consent.",
 },
 {
 q: "What happens if no donor responds to my request?",
 a: "If no nearby donor responds immediately, the system continues to search within an expanding area. You can also browse our blood bank directory to contact blood banks directly for immediate assistance.",
 },
 {
 q: "How is a donor's blood group verified?",
 a: "FindMyDonor stores the blood group information provided by donors during registration. Final medical screening, blood type confirmation, and donation eligibility are always determined by the authorised blood bank or hospital at the time of donation.",
 },
 {
 q: "Can I cancel a request after posting it?",
 a: "Yes. You can cancel an active request at any time from the Requester Portal or tracking page. Any donors who were notified will be informed of the cancellation.",
 },
 {
 q: "Is FindMyDonor a hospital or blood bank?",
 a: "No. FindMyDonor is a technology platform that connects people who need blood with voluntary donors nearby. We do not operate blood banks, manage blood inventory, or provide any medical services. All donations happen at authorised blood banks and hospitals.",
 },
];

export function FAQ() {
 const [open, setOpen] = useState<number | null>(0);
 const { t } = useLanguage();

 return (
 <section id="faq" className="relative py-20 sm:py-28 bg-white">
 <div className="mx-auto max-w-3xl px-5 sm:px-8">
 <motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  className="space-y-3"
  >
  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-blood-600">
  <span className="mr-2 font-mono text-[11px] tracking-[0.18em] text-ink-400">01</span>
  {t.faq.badge}
  </p>
  <h2 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink-900">
  {t.faq.title}
  </h2>
  <p className="max-w-2xl text-[17px] leading-relaxed text-ink-600">
  {t.faq.subtitle}
  </p>
 </motion.div>

  <div className="mt-12 divide-y divide-ink-100 border border-ink-200 bg-white">
 {faqs.map((f, i) => {
 const isOpen = open === i;
 return (
 <motion.div
 key={f.q}
 initial={{ opacity: 0, y: 10 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ duration: 0.4, delay: i * 0.04 }}
 className="px-5 sm:px-7"
 >
 <button
  onClick={() => setOpen(isOpen ? null : i)}
  className="flex w-full items-center gap-4 py-5 text-left cursor-pointer"
  >
  <span className="flex-shrink-0 font-mono text-[11px] font-semibold tracking-[0.18em] text-ink-400">
  {String(i + 1).padStart(2, "0")}
  </span>
  <span className="flex-1 text-[15px] font-semibold text-ink-900">
  {t.faq.items?.[i]?.q || f.q}
  </span>
  <span
  className={`grid h-7 w-7 flex-shrink-0 place-items-center border transition-colors ${
  isOpen
  ? "border-ink-900 bg-ink-900 text-white"
  : "border-ink-300 bg-white text-ink-600"
  }`}
  >
  {isOpen ? (
  <Minus className="h-3.5 w-3.5" />
  ) : (
  <Plus className="h-3.5 w-3.5" />
  )}
  </span>
 </button>
 <AnimatePresence initial={false}>
 {isOpen && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: "auto", opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
 className="overflow-hidden"
 >
  <p className="pb-5 pl-10 pr-8 text-sm leading-relaxed text-ink-600">
  {t.faq.items?.[i]?.a || f.a}
  </p>
 </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 );
 })}
 </div>
 </div>
 </section>
 );
}
