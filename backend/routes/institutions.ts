// Institution routes — Phase 4 (Rev 3 §11).
//
// Institutional accounts follow the SAME unified auth as donor/requester:
//   auth.users → auth_profile_links → profiles → institution_profile_links → institutions
// No parallel auth system. Every institution starts at verification_status
// 'pending' and requires explicit admin approval — there is NO auto-active path
// for institutions (enforced in the DB schema and here).
import express, { Router } from "express";
import { getAuthenticatedUser, getLinkedProfile, createAuthUserAndProfile } from "../middleware/auth";
import { auth as firebaseAuth } from "../src/lib/firebase";
import { addDoc, getAll, getDoc, saveDoc, updateDoc } from "../src/lib/store";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { validate } from "../validation/index";
import { institutionRegisterSchema, institutionLoginSchema, institutionUpdateSchema } from "../validation/account";
import { normalizePhone, isValidIndianPhone } from "../helpers/phone";
import { hashPin, verifyPin } from "../helpers/password";
import { sanitizeInstitution } from "../helpers/sanitize";
import { nowISO } from "../helpers/time";
import { sendErrorResponse, UnauthorizedError, NotFoundError, ValidationError, AppError } from "../helpers/errors";
import { enqueueEmail } from "../services/notificationService";
import { buildWelcomeEmailHTML } from "../src/lib/email";


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

// Require a Rev 3 unified-auth profile (email/Google), same guard as onboarding.
function isRev3Profile(p: any): boolean {
  return !!p && (p.auth_method === "google" || p.auth_method === "email");
}

// ─── GET /api/institutions/me — my institution(s) + verification status ──────
router.get("/institutions/me", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));

  try {
    const allLinks = await getAll<{ profile_id: string; institution_id: string; role?: string }>("institution_profile_links");
    const myLinks = allLinks.filter((l) => l.profile_id === linked.profile.id);

    const institutions: unknown[] = [];
    for (const link of myLinks) {
      const inst = await getDoc<any>("institutions", link.institution_id);
      if (inst) {
        institutions.push({ ...sanitizeInstitution(inst), role: link.role });
      }
    }

    return res.json({ institutions, count: institutions.length });
  } catch (error) {
    return sendErrorResponse(res, error, "Failed to load your institution.");
  }
}));

// ─── POST /api/institutions/register — submit institution for approval ───────
router.post(
  "/institutions/register",
  rateLimitMiddleware(5, 60_000),
  validate(institutionRegisterSchema),
  wrap(async (req, res) => {
    const body = req.body;
    const normalizedEmail = String(body.email || "").toLowerCase().trim();

    // Email + password only — no Google gate. When a caller submits with no
    // Firebase session, create the unified-auth identity + profile from the
    // submitted email so the later email + 10-digit-password sign-in (which
    // mints a custom token for this profile id) resolves the institution.
    const authUser = await getAuthenticatedUser(req);
    let profileId: string;
    if (authUser) {
      const linked = await getLinkedProfile(authUser.id);
      if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));
      if (!isRev3Profile(linked.profile)) {
        return sendErrorResponse(res, new AppError("Institution registration is not available for legacy profiles.", 409, "LEGACY_PROFILE"));
      }
      profileId = linked.profile.id;
    } else {
      const created = await createAuthUserAndProfile(normalizedEmail, String(body.contactPerson || "").trim(), "email");
      profileId = created.profile.id;
    }

    const normalizedPhone = normalizePhone(String(body.phone || ""));
    if (!isValidIndianPhone(normalizedPhone)) {
      return sendErrorResponse(res, new ValidationError("Enter a valid Indian phone number (e.g. 91XXXXXXXXXX)."));
    }

    // Part B: the registration carries a 10-digit sign-in PIN. Store only the
    // scrypt hash + salt — the plaintext never touches the data layer.
    const pin = String(body.password || "");
    const { salt: pinSalt, hash: pinHash } = await hashPin(pin);

    const allInstitutions = await getAll<any>("institutions");
    const existing = allInstitutions.find((i) => i.phone === normalizedPhone) || null;

    let institution: any;
    if (existing) {
      const updateData = {
        type: body.type,
        org_name: body.orgName,
        registration_number: body.registrationNumber,
        contact_person: body.contactPerson,
        email: normalizedEmail,
        password_salt: pinSalt,
        password_hash: pinHash,
        address: body.address || null,
        city: body.city,
        pincode: body.pincode,
        verification_status: "pending",
        rejection_reason: null,
        created_at: existing.created_at || nowISO(),
        updated_at: nowISO(),
      };
      await updateDoc("institutions", existing.id, updateData);
      institution = { ...existing, ...updateData };
    } else {
      const createData = {
        type: body.type,
        org_name: body.orgName,
        registration_number: body.registrationNumber,
        contact_person: body.contactPerson,
        phone: normalizedPhone,
        email: normalizedEmail,
        password_salt: pinSalt,
        password_hash: pinHash,
        address: body.address || null,
        city: body.city,
        pincode: body.pincode,
        verification_status: "pending",
        created_at: nowISO(),
        updated_at: nowISO(),
      };
      const { id } = await addDoc("institutions", createData);
      institution = { id, ...createData };
    }

    await saveDoc("institution_profile_links", profileId, {
      profile_id: profileId,
      institution_id: institution.id,
      role: "admin",
    });

    // Registration-welcome email — "received, under review". The approval email
    // is sent later by an admin action; this is the only email at registration.
    if (institution.email) {
      try {
        const mail = buildWelcomeEmailHTML({ name: institution.org_name, type: "institution" });
        await enqueueEmail(institution.email, mail.subject, mail.html, mail.text);
      } catch (error) {
        console.warn("[Institutions] registration welcome email enqueue failed:", (error as Error)?.message || error);
      }
    }

    return res.status(201).json({
      success: true,
      institution: {
        id: institution.id,
        type: institution.type,
        org_name: institution.org_name,
        verification_status: "pending",
      },
      message: "Registration submitted. An administrator will review and verify your institution.",
    });
  })
);

// ─── PATCH /api/institutions/me — verified institutions update contact fields ─
// Part C: the dashboard's Profile & Verification save. Identity fields are
// uneditable (stripped by the schema); edits require an approved institution so
// a pending/rejected application can't rewrite details mid-review.
router.patch(
  "/institutions/me",
  rateLimitMiddleware(10, 60_000),
  validate(institutionUpdateSchema),
  wrap(async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
    const linked = await getLinkedProfile(authUser.id);
    if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));

    const allLinks = await getAll<{ profile_id: string; institution_id: string }>("institution_profile_links");
    const myLink = allLinks.find((l) => l.profile_id === linked.profile.id);
    if (!myLink?.institution_id) return sendErrorResponse(res, new NotFoundError("Institution not found."));

    const inst = await getDoc<any>("institutions", myLink.institution_id);
    if (!inst) return sendErrorResponse(res, new NotFoundError("Institution not found."));

    if (inst.verification_status !== "verified") {
      return sendErrorResponse(
        res,
        new AppError("Profile edits are enabled after your institution is approved.", 403, "INSTITUTION_NOT_VERIFIED")
      );
    }

    const body = req.body || {};
    const updateData: Record<string, unknown> = { updated_at: nowISO() };

    if (body.contactPerson !== undefined) updateData.contact_person = String(body.contactPerson).trim();
    if (body.city !== undefined) updateData.city = String(body.city).trim();
    if (body.pincode !== undefined) updateData.pincode = String(body.pincode).trim();
    if (body.address !== undefined) updateData.address = String(body.address).trim() || null;

    if (body.phone !== undefined) {
      const normalizedPhone = normalizePhone(String(body.phone).trim());
      if (!isValidIndianPhone(normalizedPhone)) {
        return sendErrorResponse(res, new ValidationError("Enter a valid Indian phone number (10 digits, starting with 6-9)."));
      }
      updateData.phone = normalizedPhone;
    }

    if (Object.keys(updateData).length <= 1) {
      return sendErrorResponse(res, new ValidationError("Nothing to update."));
    }

    await updateDoc("institutions", inst.id, updateData);
    const updated = { ...inst, ...updateData };

    return res.json({ success: true, institution: sanitizeInstitution(updated) });
  })
);

// ─── POST /api/institutions/login — email + 10-digit password ────────────────
// Separate credential path from the donor/requester Google flow. On success
// mints a Firebase custom token for the linked auth identity so the client reuses
// the existing /api/auth/me session machinery (AuthContext resolves the
// institution exactly as it does for a Google-signed-in institution).
router.post(
  "/institutions/login",
  rateLimitMiddleware(5, 60_000),
  validate(institutionLoginSchema),
  wrap(async (req, res) => {
    const email = String(req.body.email).toLowerCase().trim();
    const pin = String(req.body.password);

    const allInstitutions = await getAll<any>("institutions");
    const institution = allInstitutions.find(
      (i) => String(i.email || "").toLowerCase().trim() === email
    );

    if (!institution || !institution.id) {
      return sendErrorResponse(res, new UnauthorizedError("Invalid email or sign-in password."));
    }

    // Approval gating is a UX requirement: surface the state, not a generic failure.
    if (institution.verification_status === "pending") {
      return sendErrorResponse(
        res,
        new AppError("Your registration is pending review. You'll be able to sign in once it's approved.", 403, "INSTITUTION_PENDING_REVIEW")
      );
    }
    if (institution.verification_status === "rejected") {
      const reason = institution.rejection_reason
        ? ` Reason: ${String(institution.rejection_reason).trim()}.`
        : "";
      return sendErrorResponse(
        res,
        new AppError(`Your registration was not approved.${reason} Please re-register with correct details or contact support.`, 403, "INSTITUTION_REJECTED")
      );
    }

    if (institution.verification_status !== "verified") {
      return sendErrorResponse(res, new UnauthorizedError("Invalid email or sign-in password."));
    }

    // Legacy rows registered before the PIN feature have no credential to verify.
    if (!institution.password_hash || !institution.password_salt) {
      return sendErrorResponse(
        res,
        new UnauthorizedError("No sign-in password is set for this institution yet. Re-register to set your 10-digit password.")
      );
    }

    const pinOk = await verifyPin(pin, String(institution.password_salt), String(institution.password_hash));
    if (!pinOk) {
      return sendErrorResponse(res, new UnauthorizedError("Invalid email or sign-in password."));
    }

    const links = await getAll<{ institution_id: string; profile_id?: string }>("institution_profile_links");
    const link = links.find((l) => l.institution_id === institution.id);
    if (!link?.profile_id) {
      return sendErrorResponse(
        res,
        new AppError("This institution is not linked to a sign-in identity. Contact support.", 500, "INSTITUTION_NOT_LINKED")
      );
    }

    const isTest = process.env.NODE_ENV === "test" || process.env.TEST_MODE === "1";
    let customToken: string;
    try {
      customToken = isTest
        ? `test-custom-token:${link.profile_id}`
        : await firebaseAuth.createCustomToken(link.profile_id);
    } catch (error) {
      console.warn("[Institution] Custom token mint failed:", (error as Error)?.message || error);
      return sendErrorResponse(
        res,
        new AppError("Unable to issue a sign-in session right now. Try again shortly.", 503, "TOKEN_ISSUE_FAILED")
      );
    }

    return res.json({
      success: true,
      customToken,
      institution: sanitizeInstitution({
        id: institution.id,
        type: institution.type,
        org_name: institution.org_name,
        verification_status: institution.verification_status,
      }),
    });
  })
);

export default router;
