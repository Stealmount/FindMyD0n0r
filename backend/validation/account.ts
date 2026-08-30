// Zod schemas for Phase 4 — Account Settings + Institution gates.
// Additive only; mirrors the frozen Rev 3 architecture.
import { z } from "./index";

const emailField = z
  .string({ message: "Valid email address required." })
  .trim()
  .toLowerCase()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Valid email address required.");

const tokenField = z.string().min(1, "Verification token is required.");

const institutionType = z.enum(["hospital", "ngo", "blood_bank", "other"], {
  message: "Select a valid institution type.",
});

const pincodeField = z
  .string({ message: "Pincode is required." })
  .regex(/^[0-9]{6}$/, "Enter a valid 6-digit pincode.");

// Institutional sign-in credential — a 10-digit numeric PIN (Part B decision).
const institutionPinField = z
  .string({ message: "10-digit sign-in password is required." })
  .regex(/^\d{10}$/, "The sign-in password must be exactly 10 digits (numbers only).");

// ─── POST /institutions/register ─────────────────────────────────────────────
export const institutionRegisterSchema = z.object({
  type: institutionType,
  orgName: z.string({ message: "Organisation name is required." }).trim().min(1, "Organisation name is required."),
  registrationNumber: z.string({ message: "Registration number is required." }).trim().min(1, "Registration number is required."),
  contactPerson: z.string({ message: "Contact person is required." }).trim().min(1, "Contact person is required."),
  phone: z.string({ message: "Phone number is required." }).min(1, "Phone number is required."),
  email: emailField,
  password: institutionPinField,
  address: z.string().trim().optional(),
  city: z.string({ message: "City is required." }).trim().min(1, "City is required."),
  pincode: pincodeField,
});

// ─── POST /institutions/login (email + 10-digit password) ────────────────────
export const institutionLoginSchema = z.object({
  email: emailField,
  password: institutionPinField,
});

// ─── PATCH /institutions/me (verified-only contact edits, Part C) ────────────
// Identity fields (type, orgName, registrationNumber, email) are deliberately
// NOT in this schema: zod strips unknown keys, so edits to them are silently
// ignored — the admin review decision stays authoritative.
export const institutionUpdateSchema = z.object({
  contactPerson: z.string().trim().min(1, "Contact person is required.").optional(),
  phone: z.string().min(1, "Phone number is required.").optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().min(1, "City is required.").optional(),
  pincode: pincodeField.optional(),
});

// ─── POST /account/wa-verify (WhatsApp number verification completion) ───────
export const whatsappVerifySchema = z.object({
  verificationToken: tokenField,
  phone: z.string({ message: "Phone number is required." }).min(1, "Phone number is required."),
});

// ─── POST /account/change-whatsapp ────────────────────────────────────────────
export const changeWhatsappSchema = z.object({
  verificationToken: tokenField,
  newPhone: z.string({ message: "New WhatsApp number is required." }).min(1, "New WhatsApp number is required."),
});

// ─── POST /account/change-email ───────────────────────────────────────────────
export const changeEmailSchema = z.object({
  verificationToken: tokenField,
  newEmail: emailField,
});

// ─── POST /account/link-google ────────────────────────────────────────────────
export const linkGoogleSchema = z.object({
  email: emailField,
});

export type InstitutionRegisterInput = z.infer<typeof institutionRegisterSchema>;
export type InstitutionLoginInput = z.infer<typeof institutionLoginSchema>;
export type InstitutionUpdateInput = z.infer<typeof institutionUpdateSchema>;
export type WhatsappVerifyInput = z.infer<typeof whatsappVerifySchema>;
export type ChangeWhatsappInput = z.infer<typeof changeWhatsappSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type LinkGoogleInput = z.infer<typeof linkGoogleSchema>;
