// scrypt password hashing — institutional 10-digit sign-in PINs (Part B).
// Node crypto only, no new dependency. Each institution gets a fresh random
// salt; scrypt is the KDF (memory-hard) and timing-safe compare prevents
// side-channel leaks on login.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

const KEY_LENGTH = 64;

export interface PinHash {
  salt: string;
  hash: string;
}

/** Hash a 10-digit PIN → { salt, hash } (hex-encoded). */
export async function hashPin(pin: string): Promise<PinHash> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(pin, salt, KEY_LENGTH);
  return { salt, hash: derived.toString("hex") };
}

/** Constant-time PIN verification against a stored hash. Fails closed on any malformed input. */
export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  try {
    const derived = await scrypt(pin, salt, KEY_LENGTH);
    const expected = Buffer.from(hash, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}