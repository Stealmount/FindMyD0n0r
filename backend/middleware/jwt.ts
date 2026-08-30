// Admin JWT — Phase 7.2
// HMAC-SHA256 signed tokens via node:crypto. No JWT library needed.
// Payload: { sub: "admin", iat, exp: iat + 24h }.
//
// ponytail: stateless JWTs — no revocation or refresh. When admin sessions
// need to be revocable, swap this module for a signed-token store or a
// proper JWT library with a denylist.
import { createHmac, timingSafeEqual } from "node:crypto";

const HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");

const TTL_SECONDS = 24 * 60 * 60; // 24h

function signingSecret(): string {
  const secret = process.env.ADMIN_AUTH_SECRET;
  if (!secret) {
    throw new Error("ADMIN_AUTH_SECRET is not set — cannot sign admin JWT.");
  }
  return secret;
}

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export interface AdminTokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

/** Issue a 24h admin session token. */
export function signAdminToken(): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminTokenPayload = { sub: "admin", iat: now, exp: now + TTL_SECONDS };
  const body = `${HEADER}.${b64url(JSON.stringify(payload))}`;
  return `${body}.${sign(body)}`;
}

/** Verify + decode an admin JWT. Returns payload, or null if invalid/expired/tampered. */
export function verifyAdminToken(token: string): AdminTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  // Re-sign and constant-time compare to reject tampering.
  const expected = sign(`${headerB64}.${payloadB64}`);
  const sigBuf = Buffer.from(sigB64);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    if (header.alg !== "HS256") return null;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as AdminTokenPayload;
    if (payload.sub !== "admin") return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** True if the given bearer token is a valid admin JWT. */
export function isAdminJwt(token: string): boolean {
  return verifyAdminToken(token) !== null;
}
