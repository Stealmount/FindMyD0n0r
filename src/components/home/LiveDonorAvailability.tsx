import React from "react";

interface LiveDonorAvailabilityProps {
  availability?: Record<string, number>;
}

const defaultAvailability: Record<string, number> = {
  "O+": 0, "O-": 0, "A+": 0, "A-": 0,
  "B+": 0, "B-": 0, "AB+": 0, "AB-": 0,
};

const bloodGroups = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;

export function LiveDonorAvailability({ availability }: LiveDonorAvailabilityProps) {
  const data = availability ?? defaultAvailability;

  return (
    <section className="px-4 py-8 max-w-4xl mx-auto">
      <h2 className="mb-4 text-lg font-bold tracking-tight text-ink-900">Live Donor Availability</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {bloodGroups.map((bg) => {
          const count = data[bg] ?? 0;
          const isUniversal = bg === "O-";

          return (
            <div
              key={bg}
              className={`border border-ink-200 bg-white p-4 ${
                isUniversal ? "border-l-4 border-l-blood-600" : ""
              }`}
            >
              <span className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-ink-600">{bg}</span>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-blood-600">{count}</p>
              <p className="mt-0.5 text-xs text-ink-500">active donors nearby</p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-ink-500 text-center">
        Sign in to see nearby donors
      </p>
    </section>
  );
}
