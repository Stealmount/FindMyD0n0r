// Onboarding routes — Phase 3 (auth redesign, Rev 3 §10).
//
// Three-step onboarding, server-driven: AUTH (Screen 1) → BASIC PROFILE (Screen 2)
// → INTENT (Screen 3). Each step persists to profiles and advances onboarding_step.
// Single-select intent; can_donate/can_request are mutually exclusive (donor XOR
// requester). Donor details are captured inline on Screen 3 — no 4th screen.
// Welcome is enqueued exactly once when the user completes onboarding.
import express, { Router } from "express";
import { getAuthenticatedUser, getLinkedProfile } from "../middleware/auth";
import { saveDoc, updateDoc } from "../src/lib/store";
import { cacheInvalidatePrefix } from "../src/lib/redisCache";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { validate } from "../validation/index";
import {
  onboardingBasicSchema,
  onboardingIntentSchema,
} from "../validation/onboarding";
import { enqueueWelcome } from "../services/notificationService";
import { resolvePincode } from "./pincode";
import { nowISO } from "../helpers/time";
import { sendErrorResponse, UnauthorizedError, NotFoundError, ValidationError, AppError } from "../helpers/errors";


const router = Router();

// Express 4 does not forward rejected async handlers to its error middleware.
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

/** Rev 3 flow is only reachable for new unified-auth profiles. */
function isRev3Profile(p: any): boolean {
  return !!p && (p.auth_method === "google" || p.auth_method === "email");
}

// ─── POST /api/onboarding/basic — Screen 2: basic profile ────────────────────
// Persists shared profile location + WhatsApp + communication preference,
// then advances onboarding_step → 'intent'. Verify Later is always allowed and
// never blocks this step. Pincode auto-resolves City/District/State when omitted.
router.post(
  "/onboarding/basic",
  rateLimitMiddleware(10, 60_000),
  validate(onboardingBasicSchema),
  wrap(async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
    const linked = await getLinkedProfile(authUser.id);
    if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));
    if (!isRev3Profile(linked.profile)) {
      return sendErrorResponse(res, new AppError("Onboarding is not available for legacy profiles.", 409, "LEGACY_PROFILE"));
    }

    const {
      fullName, whatsappPhone, pincode, city, district, state, area,
      notificationChannel, verifyLater,
    } = req.body;

    let resolved = null;
    if (pincode) {
      resolved = await resolvePincode(pincode);
    }

    const update: Record<string, unknown> = {
      onboarding_step: "intent",
      updated_at: nowISO(),
    };
    if (fullName !== undefined) update.full_name = fullName;
    if (whatsappPhone !== undefined) {
      update.whatsapp_phone = whatsappPhone;
      update.whatsapp_verified = false;
    }
    if (pincode !== undefined) update.pincode = pincode;
    if (city !== undefined) update.city = city;
    else if (resolved?.city) update.city = resolved.city;
    if (district !== undefined) update.district = district;
    else if (resolved?.district) update.district = resolved.district;
    if (state !== undefined) update.state = state;
    else if (resolved?.state) update.state = resolved.state;
    if (area !== undefined) update.area = area;
    else if (resolved?.area) update.area = resolved.area;
    if (notificationChannel !== undefined) update.notification_channel = notificationChannel;

    await updateDoc("profiles", linked.profile.id, update);

    const refresh = await getLinkedProfile(authUser.id);
    const onboarding = (refresh?.profile as (Record<string, unknown> & { onboarding_step?: string }) | null | undefined)?.onboarding_step ?? "intent";
    return res.json({
      success: true,
      nextStep: "intent",
      verifyLater: !!verifyLater,
      onboarding,
    });
  })
);

// ─── POST /api/onboarding/intent — Screen 3: single-select intent ────────────
router.post(
  "/onboarding/intent",
  rateLimitMiddleware(10, 60_000),
  validate(onboardingIntentSchema),
  wrap(async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
    const linked = await getLinkedProfile(authUser.id);
    if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));
    if (!isRev3Profile(linked.profile)) {
      return sendErrorResponse(res, new AppError("Onboarding is not available for legacy profiles.", 409, "LEGACY_PROFILE"));
    }

    const {
      intent, bloodGroup, isAvailable, healthSelfDeclaration,
    } = req.body;

    const profileId = linked.profile.id;

    if (intent === "donor") {
      if (!bloodGroup) return sendErrorResponse(res, new ValidationError("Blood group is required for donor onboarding."));
      if (healthSelfDeclaration !== true) return sendErrorResponse(res, new ValidationError("Health self-declaration is required for donor onboarding."));
      await saveDoc("donor_profiles", profileId, {
        profile_id: profileId,
        blood_group: bloodGroup,
        is_available: isAvailable === undefined ? true : !!isAvailable,
        profile_complete: true,
        updated_at: nowISO(),
      });
      // Roles are mutually exclusive (Part A): a donor is never a requester.
      await updateDoc("profiles", profileId, { can_donate: true, can_request: false });
      await cacheInvalidatePrefix("eligible_");
    } else if (intent === "requester") {
      await updateDoc("profiles", profileId, { can_donate: false, can_request: true });
    }

    await updateDoc("profiles", profileId, {
      intent,
      onboarding_step: "complete",
      updated_at: nowISO(),
    });

    const welcome = await enqueueWelcome(profileId);

    const canDonate = intent === "donor";
    const canRequest = intent === "requester";

    return res.json({
      success: true,
      intent,
      onboarding_step: "complete",
      can_request: canRequest,
      can_donate: canDonate,
      welcome: { enqueued: welcome.enqueued, channel: welcome.channel },
    });
  })
);

// ─── POST /api/onboarding/completion-wizard ──────────────────────────────────
router.post(
  "/onboarding/completion-wizard",
  rateLimitMiddleware(10, 60_000),
  wrap(async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
    const linked = await getLinkedProfile(authUser.id);
    if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));

    await updateDoc("profiles", linked.profile.id, {
      onboarding_step: "complete",
      updated_at: nowISO(),
    });

    return res.json({
      success: true,
      onboarding_step: "complete",
      hasCompletedOnboarding: true,
    });
  })
);

export default router;
