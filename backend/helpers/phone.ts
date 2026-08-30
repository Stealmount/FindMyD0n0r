// Phone helpers — pure functions extracted from server.ts (Phase 3 decomposition)

export function normalizePhone(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  // Match SQL normalize_indian_phone: prepend 91 for bare 10-digit Indian numbers
  if (/^[6-9]\d{9}$/.test(digits)) return "91" + digits;
  return digits;
}

export function isValidIndianPhone(phone: string): boolean {
  return /^91[6-9]\d{9}$/.test(normalizePhone(phone));
}

// Synthetic email for phone-first sign-in — deterministic, non-forwardable, phone-derived.
export function buildSyntheticEmail(phone: string): string {
  return `phone+${phone}@findmydonor.local`;
}
