// Auth routes — unified auth + Upstash doc-store
import express, { Router } from "express";
import { getDoc, getAll, saveDoc, updateDoc } from "../src/lib/store";
import { getUpstash, k } from "../src/lib/upstash";

import { normalizePhone, isValidIndianPhone } from "../helpers/phone";
import { nowISO } from "../helpers/time";
import {
  getAuthenticatedUser,
  getLinkedProfile,
  nextOnboardingStep,
  createAuthUserAndProfile,
} from "../middleware/auth";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { validate } from "../validation";
import { completeVerificationSchema } from "../validation/auth";
import { sendErrorResponse, UnauthorizedError, DatabaseError } from "../helpers/errors";
import { sanitizeInstitution } from "../helpers/sanitize";

const router = Router();

// Express 4 does not forward rejected async handlers to its error middleware.
// Wrap routes once so a provider outage returns a response instead of taking down Node.
const wrap = (handler: express.RequestHandler): express.RequestHandler => (req, res, next) => {
  try {
    const result = handler(req, res, next) as unknown;
    if (result && typeof (result as Promise<unknown>).catch === "function") {
      void (result as Promise<unknown>).catch(next);
    }
  } catch (error) {
    next(error);
  }
};

// ─── Me — current authenticated user profile ─────────────────────────────
router.get("/auth/me", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  try {
    const linked = await getLinkedProfile(authUser.id);
    const profile = (linked?.profile || null) as (Record<string, unknown> & { id?: string }) | null;
    let institution: unknown = null;
    if (profile?.id) {
      try {
        const iplLinks = await getAll<{ institution_id: string; profile_id?: string }>("institution_profile_links");
        const iplDoc = iplLinks.find((l) => l.profile_id === profile.id);
        if (iplDoc) {
          const institutionId = iplDoc.institution_id;
          if (institutionId) {
            const inst = await getDoc<Record<string, unknown>>("institutions", institutionId);
            // Keep the raw doc data incl. id — the frontend keys hospital
            // inventory by institution id via AuthContext.institutionToHospitalUser.
            // Credential material (password_hash/salt) must never escape.
            institution = inst ? { id: inst.id, ...sanitizeInstitution(inst) } : null;
          }
        }
      } catch (error) {
        console.warn("[Auth] Institution enrichment unavailable (institution=null):", error);
      }
    }
    return res.json({
      authUser: { id: authUser.id, email: authUser.email || null, provider: authUser.app_metadata?.provider || null },
      profile,
      donorProfile: linked?.donorProfile || null,
      institution,
      nextStep: nextOnboardingStep(linked),
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Profile service is temporarily unavailable.", 503, "SERVICE_UNAVAILABLE");
  }
}));

// ─── Complete verification (Google OAuth users — NO OTP, NO password) ───────
router.post("/auth/complete-verification", rateLimitMiddleware(10, 60_000), validate(completeVerificationSchema), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const googleEmail = (req.body?.email || authUser.email || "").toString().toLowerCase().trim();
  const googleName = String(req.body?.fullName || authUser.user_metadata?.full_name || "").trim();

  try {
    // Email→profile lookup via the h:email_to_uid hash maintained by store.
    const existingUid = await getUpstash().hget<string>(k("h:email_to_uid"), googleEmail);
    const existing = existingUid ? await getDoc<Record<string, unknown>>("profiles", existingUid) : null;

    let profile: any = existing || null;
    if (!profile) {
      const created = await createAuthUserAndProfile(googleEmail, googleName || "User", "google");
      profile = created.profile;
    } else {
      try {
        await saveDoc("auth_profile_links", authUser.id, {
          auth_user_id: authUser.id,
          profile_id: existing.id,
          provider: "google",
        });
      } catch { /* ignore duplicate link */ }
    }

    const phone = req.body?.phone;
    const normalized = phone ? normalizePhone(String(phone)) : null;
    const patch: Record<string, unknown> = { updated_at: nowISO() };
    if (normalized && isValidIndianPhone(normalized)) {
      patch.phone = normalized;
      patch.whatsapp_phone = req.body?.whatsappPhone ? normalizePhone(String(req.body.whatsappPhone)) : normalized;
      patch.is_whatsapp = patch.whatsapp_phone === normalized;
      patch.whatsapp_verified = true;
    }
    const intent = req.body?.intent;
    const storedIntent = (profile as any)?.intent as string | undefined;
    // Roles are mutually exclusive (Part A: donor/requester split). An explicit
    // intent always wins; a stored "both" (legacy dual-role) collapses to donor.
    if (intent || storedIntent === "both") {
      const resolved = intent
        ? (intent === "requester" ? "requester" : "donor")
        : "donor";
      patch.intent = resolved;
      patch.can_donate = resolved === "donor";
      patch.can_request = resolved === "requester";
      if (resolved === "donor") {
        try { await saveDoc("donor_profiles", profile.id, { profile_id: profile.id }); } catch { /* ignore duplicate */ }
        try {
          await saveDoc("users", profile.id, {
            id: profile.id,
            full_name: profile.full_name || googleName || "Donor",
            email: profile.email || googleEmail || "",
            phone: profile.phone || null,
            whatsapp_number: profile.whatsapp_phone || null,
            blood_type: "ANY",
            availability_status: "available",
            account_status: "active",
            created_at: nowISO(),
          });
        } catch { /* ignore legacy users sync error */ }
      }
    }
    if (Object.keys(patch).length > 1) {
      try {
        await updateDoc("profiles", profile.id, patch);
      } catch { /* non-blocking enrichment */ }
    }

    const linked = await getLinkedProfile(authUser.id);
    return res.status(201).json({
      profile: linked?.profile || null,
      donorProfile: linked?.donorProfile || null,
      isNewUser: !existing,
      nextStep: nextOnboardingStep(linked),
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Unable to complete your profile. Try again.");
  }
}));

export default router;
