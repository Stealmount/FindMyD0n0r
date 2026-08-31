// Auth middleware — extracted from server.ts (Phase 3 decomposition)
// Firebase Admin SDK identity layer: Firebase Auth (data lives in Upstash).
import express from "express";
import { timingSafeEqual } from "node:crypto";
import { auth } from "../src/lib/firebase";
import {
  getDoc as storeGetDoc,
  saveDoc as storeSaveDoc,
} from "../src/lib/store";
import { getUpstash, isUpstashConfigured, k } from "../src/lib/upstash";
import { cacheGet, cacheSet, cacheDel } from "../src/lib/redisCache";
import { isAdminJwt } from "./jwt";
import { normalizePhone } from "../helpers/phone";
import { nowISO } from "../helpers/time";
import type { BloodType, User } from "../src/types";

export type LinkedProfile = {
  id: string; full_name: string; phone: string | null; whatsapp_phone: string | null; email: string | null;
  whatsapp_verified: boolean; consent_accepted_at: string | null; can_donate: boolean; can_request: boolean;
  auth_method?: string | null; onboarding_step?: string | null; intent?: string | null;
  notification_channel?: string | null; welcome_sent_at?: string | null;
  pincode?: string | null; city?: string | null; district?: string | null; state?: string | null; area?: string | null;
};
export type LinkedDonorProfile = {
  profile_id: string; blood_group: BloodType | null; latitude: number | null; longitude: number | null;
  address_text: string | null; pincode: string | null; area: string | null; city?: string | null;
  last_donation_date: string | null; cooldown_until: string | null; health_self_declaration: boolean;
  profile_complete: boolean; is_available: boolean;
};

export async function isAccountDeleted(authId: string): Promise<boolean> {
  const cacheKey = `acct_deleted:${authId}`;
  const cached = await cacheGet<boolean>(cacheKey);
  if (cached !== null) return cached;
  const user = await storeGetDoc<User>("users", authId);
  const deleted = user?.account_status === "deleted";
  await cacheSet(cacheKey, deleted, 300); // 5-minute TTL
  return deleted;
}

export async function getAuthenticatedUser(req: express.Request) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  let authUser: any = null;
  // Phase 7.2: short-lived admin JWT issued by /api/admin/verify-key.
  if (isAdminJwt(token)) {
    authUser = { id: "admin-id", email: "official@findmydonor.online", role: "admin" };
  } else if (token === "test-valid-token" && (process.env.NODE_ENV === "test" || process.env.TEST_MODE === "1")) {
    authUser = { id: "test-user-id", email: "test@example.com" };
  } else if (token === "test-admin-token" && (process.env.NODE_ENV === "test" || process.env.TEST_MODE === "1")) {
    authUser = { id: "test-admin-id", email: "official@findmydonor.online" };
  } else {
    // Firebase ID tokens are always three dot-separated base64url segments.
    // Anything else (stale mock token, extension header, truncated string)
    // would only produce a noisy decode stack trace — reject it quietly.
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(token)) {
      console.warn(`[Auth] Ignoring malformed bearer token (${token.length} chars, not JWT-shaped).`);
      return null;
    }
    try {
      const decoded = await auth.verifyIdToken(token);
      authUser = { id: decoded.uid, email: decoded.email ?? null };
    } catch (error) {
      console.warn("[Auth] Firebase verifyIdToken failed:", error);
    }
  }

  if (!authUser) return null;
  if (await isAccountDeleted(authUser.id)) return null;

  return authUser;
}

export async function getLinkedProfile(authUserId: string): Promise<{ profile: LinkedProfile; donorProfile: LinkedDonorProfile | null } | null> {
  // Try legacy auth_profile_links first (backward compat), then fall back to direct doc lookup.
  let profileId = authUserId;
  try {
    const linkDoc = await storeGetDoc<{ profile_id?: string }>("auth_profile_links", authUserId);
    if (linkDoc?.profile_id) profileId = linkDoc.profile_id;
  } catch { /* ignore — collection may not exist */ }

  const [profileDoc, donorDoc] = await Promise.all([
    storeGetDoc<LinkedProfile & Record<string, unknown>>("profiles", profileId),
    storeGetDoc<Record<string, unknown>>("donor_profiles", profileId),
  ]);

  // store.getDoc yields { id, ...data } — identical shape to the previous
  // { id: snap.id, ...snap.data() } mapping.
  let profile: LinkedProfile | null = profileDoc ?? null;

  let donorProfile: LinkedDonorProfile | null = null;
  if (donorDoc) {
    const { id, ...data } = donorDoc;
    donorProfile = { profile_id: id, ...data } as LinkedDonorProfile;
  }

  // Fallback: if no profile found by ID, try looking up the Firebase auth user by email.
  if (!profile) {
    try {
      const firebaseUser = await auth.getUser(authUserId);
      if (firebaseUser.email) {
        const emailLower = firebaseUser.email.toLowerCase().trim();
        const linkedUid = await getUpstash().hget<string>(k("h:email_to_uid"), emailLower);
        if (linkedUid) {
          const profDoc = await storeGetDoc<LinkedProfile>("profiles", linkedUid);
          if (profDoc) {
            profile = profDoc;
            const dpDoc = await storeGetDoc<Record<string, unknown>>("donor_profiles", linkedUid);
            if (dpDoc) {
              const { id, ...data } = dpDoc;
              donorProfile = { profile_id: id, ...data } as LinkedDonorProfile;
            }
          }
        }
      }
    } catch { /* ignore fallback error */ }
  }

  if (!profile) return null;
  return { profile, donorProfile };
}

export type OnboardingStep = "basic" | "intent" | "complete" | "contact" | "otp" | "donor-profile";

export function nextOnboardingStep(linked: Awaited<ReturnType<typeof getLinkedProfile>>): OnboardingStep {
  if (!linked) return "contact";
  // New (Rev 3) onboarding states take precedence when set explicitly.
  const stored = (linked.profile as unknown as { onboarding_step?: string }).onboarding_step;
  if (stored === "basic" || stored === "intent" || stored === "complete") return stored;
  // Legacy fallback: OTP verification disabled — skip "otp"; unverified numbers proceed.
  if (linked.profile.can_donate && !linked.donorProfile?.profile_complete) return "donor-profile";
  return "complete";
}

/**
 * Create (or reuse) an auth user + linked profile for email-based sign in.
 * Shared by /auth/email-complete and /auth/complete-verification (Google).
 * Firebase Auth creates users without passwords (passwordless / email-link / Google).
 * Returns the auth user id and the linked profile (existing or created).
 */
export async function createAuthUserAndProfile(email: string, fullName: string, provider: "email" | "google") {
  const normalizedEmail = String(email).toLowerCase().trim();

  // Try to create auth user; if email already exists, look it up instead.
  let authUserId: string;
  try {
    const created = await auth.createUser({
      email: normalizedEmail,
      displayName: String(fullName).trim(),
      emailVerified: true,
    });
    authUserId = created.uid;
  } catch (err: any) {
    // Firebase throws "auth/email-already-exists" if the email is taken.
    if (err?.code === "auth/email-already-exists" || err?.message?.includes("already")) {
      const listResult = await auth.listUsers(1000);
      const existing = listResult.users.find((u) => u.email === normalizedEmail);
      if (!existing) throw new Error("auth-user-unavailable");
      authUserId = existing.uid;
    } else {
      throw new Error("auth-user-create-failed");
    }
  }

  // Ensure the Firebase auth user has display name set (may have been pre-existing).
  try {
    const firebaseUser = await auth.getUser(authUserId);
    if (!firebaseUser.displayName && fullName) {
      await auth.updateUser(authUserId, { displayName: String(fullName).trim() });
    }
  } catch { /* best-effort */ }

  // Check for existing profile by email (duplicate prevention) via the
  // profiles email_to_uid hash index maintained by store.saveDoc.
  let profileId: string | null = null;
  let profileData: Record<string, any> | null = null;
  try {
    const existingUid = await getUpstash().hget<string>(k("h:email_to_uid"), normalizedEmail);
    if (existingUid) {
      const profDoc = await storeGetDoc<Record<string, any>>("profiles", existingUid);
      if (profDoc) {
        profileId = existingUid;
        profileData = profDoc;
      }
    }
  } catch { /* treat as no existing profile */ }

  if (!profileId) {
    const now = nowISO();
    profileId = authUserId; // Use auth user ID as profile ID
    const newProfile = {
      full_name: String(fullName).trim(),
      email: normalizedEmail,
      auth_method: provider === "google" ? "google" : "email",
      notification_channel: process.env.NOTIFICATION_DEFAULT_CHANNEL || "both",
      onboarding_step: "basic",
      consent_accepted_at: now,
      can_donate: false,
      can_request: false,
    };
    await storeSaveDoc("profiles", profileId, newProfile, { merge: false });
    profileData = newProfile;
  }

  // Link auth user → profile (backward compat + useful for migrations).
  try {
    await storeSaveDoc("auth_profile_links", authUserId, {
      profile_id: profileId,
      provider,
    });
  } catch { /* ignore duplicate link */ }

  return { authUserId, profile: { id: profileId, ...profileData } as LinkedProfile };
}

/** Constant-time string comparison — prevents timing attacks on token/secret validation. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ─── OTP verification tickets (single-use, purpose-bound) ───────────────────
// Moved here from server.ts so both auth routes and SOS/matching routes can
// consume tickets without importing server.ts (circular dependency).

export async function consumeOtpTicket(ticket: string, phone: string, expectedPurpose: "signup" | "sos" | "verify"): Promise<boolean> {
  const key = `wa_otp_ticket_${ticket}`;
  let stored: string | null = null;
  if (isUpstashConfigured()) {
    try {
      stored = await getUpstash().getdel<string>(k(key));
    } catch {
      // Upstash failure — fail closed on consume
    }
  }
  if (stored === null) {
    stored = await cacheGet<string>(key);
    if (stored !== null) await cacheDel(key);
  }
  if (!stored) return false;
  const [purpose, verifiedPhone] = stored.split("|");
  if (purpose !== expectedPurpose || verifiedPhone !== normalizePhone(phone)) {
    return false;
  }
  return true;
}

export async function consumeEmailOtpTicket(ticket: string, email: string): Promise<boolean> {
  const key = `email_otp_ticket_${ticket}`;
  let stored: string | null = null;
  if (isUpstashConfigured()) {
    try {
      stored = await getUpstash().getdel<string>(k(key));
    } catch {
      // Upstash failure — fail closed on consume
    }
  }
  if (stored === null) {
    stored = await cacheGet<string>(key);
    if (stored !== null) await cacheDel(key);
  }
  if (!stored) return false;
  const [purpose, verifiedEmail] = stored.split("|");
  if (purpose !== "signup" || verifiedEmail !== String(email).toLowerCase().trim()) {
    return false;
  }
  return true;
}


