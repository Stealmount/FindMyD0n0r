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
