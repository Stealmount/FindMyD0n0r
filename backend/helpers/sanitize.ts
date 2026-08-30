// Strip credential material from institution rows before they leave the API.
// password_hash/password_salt exist only in the data store — never in any
// API response (register, login, /me, institutions/me, admin queue, review).
const SECRET_FIELDS = new Set(["password_hash", "password_salt"]);

export function sanitizeInstitution<T extends Record<string, unknown>>(row: T): Omit<T, "password_hash" | "password_salt"> {
  const copy = { ...row };
  for (const field of SECRET_FIELDS) {
    delete copy[field as keyof typeof copy];
  }
  return copy as Omit<T, "password_hash" | "password_salt">;
}