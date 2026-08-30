// Zod schemas for onboarding endpoints — Phase 3 (auth redesign, Rev 3 §10).
// Matches the existing validation/auth.ts style: shared zod instance from ./index.
import { z } from "./index";

const intentEnum = z.enum(["donor", "requester"]);

const fullNameField = z
  .string({ message: "Full name is required." })
  .trim()
  .min(1, "Full name is required.");

const phoneField = z
  .string({ message: "Valid 10-digit WhatsApp number required." })
  .trim()
  .regex(/^[6-9]\d{9}$/, "Valid 10-digit WhatsApp number required.");

const pincodeField = z
  .string({ message: "Valid 6-digit PIN code required." })
  .trim()
  .regex(/^\d{6}$/, "Valid 6-digit PIN code required.");

// ─── POST /onboarding/basic — Screen 2 (basic profile) ───────────────────────
// fullName is optional (Google pre-fills it; Email OTP users may already have it).
export const onboardingBasicSchema = z.object({
  fullName: fullNameField.optional(),
  whatsappPhone: phoneField.optional(),
  pincode: pincodeField.optional(),
  city: z.string({ message: "City is required." }).trim().min(1, "City is required.").optional(),
  district: z.string().trim().min(1, "District is required.").optional(),
  state: z.string({ message: "State is required." }).trim().min(1, "State is required.").optional(),
  area: z.string().trim().min(1, "Area is required.").optional(),
  notificationChannel: z.enum(["whatsapp", "email", "both"]).optional(),
  verifyLater: z.boolean().optional(),
});

// ─── POST /onboarding/intent — Screen 3 (single-select intent) ───────────────
// Donor details inline on Screen 3 — no 4th screen.
// can_donate/can_request are mutually exclusive (donor XOR requester).
// Institution onboarding is a separate flow (routes/institutions.ts).
export const onboardingIntentSchema = z.object({
  intent: intentEnum,
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]).optional(),
  isAvailable: z.boolean().optional(),
  healthSelfDeclaration: z.boolean().optional(),
});

export type OnboardingBasicInput = z.infer<typeof onboardingBasicSchema>;
export type OnboardingIntentInput = z.infer<typeof onboardingIntentSchema>;
