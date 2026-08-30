// Zod schemas for auth endpoints — Phase 7.1
// NOTE: /api/wa/send-otp keeps its hand-rolled checks — auth.test.ts pins
// the exact error string "Enter a valid 10-digit Indian WhatsApp number".
import { z } from "./index";

const intentEnum = z.enum(["donor", "requester"]);

const phoneField = z
  .string({ message: "Phone number is required." })
  .min(1, "Phone number is required.");

const passwordField = z
  .string({ message: "Password is required." })
  .min(8, "Password must be at least 8 characters.");

const fullNameField = z
  .string({ message: "Full name is required." })
  .trim()
  .min(1, "Full name is required.");

const emailField = z
  .string({ message: "Valid email address required." })
  .trim()
  .toLowerCase()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Valid email address required.")
  .optional()
  .or(z.literal(""));

// ─── POST /auth/phone-signup ─────────────────────────────────────────────────
export const phoneSignupSchema = z.object({
  phone: phoneField,
  password: passwordField,
  full_name: fullNameField,
  intent: intentEnum,
  email: emailField,
  verificationToken: z.string().optional(),
});

// ─── POST /auth/email-signup ─────────────────────────────────────────────────
export const emailSignupSchema = z.object({
  full_name: fullNameField,
  email: z
    .string({ message: "Valid email address required." })
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Valid email address required."),
  password: passwordField,
  intent: intentEnum.optional(),
  verificationToken: z
    .string({ message: "Verification token is required." })
    .min(1, "Verification token is required."),
});

// ─── POST /auth/email-signin ─────────────────────────────────────────────────
export const emailSigninSchema = z.object({
  email: z
    .string({ message: "Valid email address required." })
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Valid email address required."),
  password: passwordField,
});

// ─── POST /auth/email-complete ───────────────────────────────────────────────
export const emailCompleteSchema = z.object({
  email: z
    .string({ message: "Valid email address required." })
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Valid email address required."),
  verificationToken: z.string().min(1, "Verification token is required."),
  fullName: fullNameField.optional(), // used only when creating a brand-new account
  intent: intentEnum.optional(),
});

// ─── POST /auth/complete-verification (Google OAuth) ─────────────────────────
// Simplified (Rev 3): Google completion ensures a profile exists from the Google
// identity and links it. Phone/WhatsApp/intent are optional — the basic-profile
// and intent steps run in onboarding, not here.
export const completeVerificationSchema = z.object({
  phone: phoneField.nullable().optional(),
  whatsappPhone: phoneField.nullable().optional(),
  fullName: fullNameField.optional(),
  email: emailField,
  intent: intentEnum.optional(),
});

export type PhoneSignupInput = z.infer<typeof phoneSignupSchema>;
export type EmailSignupInput = z.infer<typeof emailSignupSchema>;
export type EmailSigninInput = z.infer<typeof emailSigninSchema>;
export type CompleteVerificationInput = z.infer<typeof completeVerificationSchema>;
export type EmailCompleteInput = z.infer<typeof emailCompleteSchema>;

