// Time helpers — pure functions extracted from server.ts (Phase 3 decomposition)

export function nowISO(): string {
  return new Date().toISOString();
}

export function nowDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export const COOLDOWN_OPTIONS = [60, 90, 120] as const;
export type CooldownDays = (typeof COOLDOWN_OPTIONS)[number];

// Resolve a donor's selected cooldown period, clamping to the allowed set and
// defaulting to 90 when unset or invalid. `users.cooldown_days` is the
// donor-selectable preference; `users.cooldown_until` stays the authoritative
// computed enforcement value.
export function resolveCooldownDays(donor: { cooldown_days?: number | null }): CooldownDays {
  const days = donor?.cooldown_days;
  if (typeof days === "number" && COOLDOWN_OPTIONS.includes(days as CooldownDays)) {
    return days as CooldownDays;
  }
  return 90;
}

// Absolute YYYY-MM-DD cooldown deadline for a completion landing on `base`.
// `base` is a YYYY-MM-DD string. Uses calendar-day arithmetic (same as daysFromNow).
export function computeCooldownUntil(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) d.setTime(Date.now());
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

