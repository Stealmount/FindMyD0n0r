// Zod schema for blood request creation — Phase 7.1
import { z } from "./index";
import { MAX_UNITS_PER_REQUEST } from "../src/types";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
const COMPONENTS = ["Whole Blood (WB)", "Packed Red Blood Cells (PRBC)"] as const;

const requiredTrim = (name: string) =>
  z.string({ message: `${name} is required.` }).trim().min(1, `${name} is required.`);

// ─── POST /api/requests (blood request creation) ────────────────────────────
export const bloodRequestSchema = z.object({
  patient_name: requiredTrim("Patient name"),
  patient_age: z.number().int().min(1).max(120).optional(),
  patient_gender: z.string().optional(),
  blood_type_needed: z.enum(BLOOD_GROUPS, { message: "Select an exact blood group." }),
  component_needed: z.enum(COMPONENTS, {
    message: "Component-specific matching requires blood-bank review. Use whole blood or PRBC for this pilot.",
  }).optional(),
  units_required: z.number({ message: "Units must be a number." }).int().min(1).max(MAX_UNITS_PER_REQUEST),
  hospital_name: requiredTrim("Hospital name"),
  hospital_uhid: z.string().optional(),
  attending_doctor: z.string().optional(),
  hospital_pincode: z
    .string({ message: "Hospital pincode is required." })
    .regex(/^\d{6}$/, "Hospital pincode must be a 6-digit number."),
  hospital_area: requiredTrim("Hospital area"),
  hospital_city: requiredTrim("Hospital city"),
  hospital_state: z.string().optional(),
  urgency_level: z.enum(["critical", "urgent", "planned"]).optional(),
  additional_notes: z.string().optional(),
  showcase_opt_in: z.boolean().optional(),
  share_contact_immediately: z.boolean().optional(),
  // Requester identity passthrough — used by resolveRequester fallback (Path 4)
  // and to override the notification phone for THIS request (family-member submit use case).
  requester_phone: z.string().optional(),
  requester_name: z.string().optional(),
  requester_email: z.string().optional(),
});

export type BloodRequestInput = z.infer<typeof bloodRequestSchema>;
