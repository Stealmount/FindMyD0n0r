/**
 * Types & Constants for Blood Connect
 */

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-';

export type BloodComponent = 'whole_blood' | 'prbc' | 'ffp' | 'platelets_sdp';

export interface BloodBankStock {
  blood_type: BloodType;
  component: BloodComponent;
  available_units: number;
  last_updated_at: string;
}

export interface BloodBank {
  id: string;
  eraktkosh_id: string;
  eraktkosh_url?: string;
  name: string;
  category: 'government' | 'private' | 'charitable' | 'red_cross';
  address: string;
  area: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  phone: string;
  email?: string;
  has_component_facility: boolean;
  operating_hours: string;
  stock: BloodBankStock[];
  last_synced_at: string;
}

export interface DonationCamp {
  id: string;
  eraktkosh_camp_id?: string;
  title: string;
  organizer_name: string;
  venue_address: string;
  area: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  camp_date: string;
  start_time: string;
  end_time: string;
  contact_number?: string;
  contact_phone?: string;
  contact_email?: string | null;
  latitude: number;
  longitude: number;
  target_units?: number;
  status?: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  eraktkosh_url?: string;
  last_synced_at?: string;
}

export type DonationFrequency = 'first_time' | 'occasional' | 'regular';

export type AvailabilityStatus = 'available' | 'available_with_notice' | 'unavailable';

export type NumberSharingPref = 'on_approval' | 'never';

export type AccountStatus = 'active' | 'cooldown' | 'inactive' | 'banned' | 'deleted';

export type UrgencyLevel = 'critical' | 'urgent' | 'planned';

export type RequestStatus = 'draft' | 'open' | 'broadcasting' | 'matching' | 'partially_matched' | 'fulfilled' | 'expired' | 'cancelled';

export type MatchStatus = 'pending' | 'approved' | 'declined' | 'timed_out';

export type MatchOutcome = 'donated' | 'not_donated' | null;

export type NotificationType = 'whatsapp' | 'email' | 'sms' | 'in_app' | 'failed';

export type RecipientType = 'donor' | 'receiver';

export type NotificationStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export interface User {
  id: string; // doc ID
  full_name: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  blood_type: BloodType;
  donation_frequency: DonationFrequency;
  last_donation_date: string | null; // YYYY-MM-DD
  cooldown_until: string | null; // YYYY-MM-DD
  pincode: string; // 6-digit numeric
  area: string;
  city: string;
  district?: string;
  state?: string; // For Tier 4 state-wide matching
  availability_status: AvailabilityStatus;
  donor_locked_until?: string | null; // ISO string — reservation lock held by a pending match
  number_sharing_pref: NumberSharingPref;
  emergency_only: boolean;
  account_status: AccountStatus;
  whatsapp_verified: boolean;
  aadhaar_verified?: boolean;
  age?: number; // 18 - 65 yrs per NBTC / FindMyDonor clinical criteria
  gender?: 'Male' | 'Female' | 'Other';
  weight_kg?: number; // min 45kg per Indian clinical blood donation protocol
  address_text?: string; // free-form address from donor registration
  hospital_affiliation?: string; // e.g. AIIMS, Apollo, Fortis, Max, FindMyDonor Network
  medical_clearance?: boolean; // self-declared clinical eligibility
  profile_complete?: boolean; // migration compatibility: required once donor_profiles is active
  is_available?: boolean; // canonical explicit availability from donor_profiles
  created_at: string; // ISO String
  updated_at: string; // ISO String
}

export type SignupIntent = 'donor' | 'requester';
export type OnboardingStep = 'intent' | 'contact' | 'consent' | 'otp' | 'donor-profile' | 'complete';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp_phone: string | null;
  is_whatsapp: boolean;
  email: string | null;
  whatsapp_verified: boolean;
  consent_accepted_at: string | null;
  can_donate: boolean;
  can_request: boolean;
  trust_report_count: number;
  created_at: string;
  updated_at: string;
  // Rev 3 redesign columns (added by migration 005)
  auth_method?: string | null;
  onboarding_step?: string | null;
  intent?: string | null;
  notification_channel?: string | null;
  welcome_sent_at?: string | null;
  pincode?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  area?: string | null;
}

export interface AuthProfileLink {
  auth_user_id: string;
  profile_id: string;
  provider: string | null;
  created_at: string;
}

export interface DonorProfile {
  profile_id: string;
  blood_group: BloodType | null;
  weight_kg?: number | null;
  latitude: number | null;
  longitude: number | null;
  address_text: string | null;
  pincode: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  last_donation_date: string | null;
  cooldown_until: string | null;
  health_self_declaration: boolean;
  profile_complete: boolean;
  is_available: boolean;
  emergency_only: boolean;
  number_sharing_pref: NumberSharingPref;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  authUser: { id: string; email: string | null; provider: string | null };
  profile: Profile | null;
  donorProfile: DonorProfile | null;
  accountStatus?: string | null; // 'active' | 'cooldown' | 'banned' | 'deleted' | null
  nextStep: OnboardingStep;
}

export interface OtpVerificationTicket {
  verificationToken: string;
  purpose: 'signup' | 'sos';
  expiresInSeconds: number;
}

export interface RequesterUser {
  id: string; // doc ID (Firebase UID)
  full_name: string;
  email: string;
  phone: string;
  pincode: string;
  area: string;
  city: string;
  account_status?: AccountStatus; // 'deleted' = soft-deleted by admin
  created_at: string; // ISO String
  updated_at: string; // ISO String
}

export interface BloodRequest {
  id: string; // doc ID
  tracking_code: string; // e.g., BLD-2026-0042
  patient_name: string;
  blood_type_needed: BloodType | 'ANY';
  units_required: number; // 1-5 (see MAX_UNITS_PER_REQUEST)
  hospital_name: string;
  hospital_pincode: string; // 6-digit
  hospital_area: string;
  hospital_city: string;
  hospital_state?: string; // For Tier 4 state-wide matching
  urgency_level: UrgencyLevel;
  requester_name: string;
  requester_email: string;
  requester_phone: string;
  additional_notes: string;
  status: RequestStatus;
  share_contact_immediately?: boolean;
  expires_at: string; // ISO String
  fulfilled_at: string | null; // ISO String
  created_at: string; // ISO String
  requester_id?: string; // Pointing to logged-in requester UID
  showcase_opt_in?: boolean; // Public feed uses a sanitized projection only
  broadcast_to_simulator?: boolean; // Requester opt-in to broadcast alert to Live Simulator
  patient_age?: number;
  patient_gender?: 'Male' | 'Female' | 'Other';
  component_needed?: 'Whole Blood (WB)' | 'Packed Red Blood Cells (PRBC)' | 'Single Donor Platelets (SDP)' | 'Random Donor Platelets (RDP)' | 'Fresh Frozen Plasma (FFP)' | 'Cryoprecipitate';
  hospital_uhid?: string; // UHID / IPD / Ward No
  attending_doctor?: string; // Dr. Name
  units_confirmed?: number; // How many donors said YES (0 to units_required)
  search_batch?: number; // Current progressive-search round (1-based)
  requester_email_verified?: boolean; // Email verified (OTP or Gmail fast-track)
}

// ─────────────────────────────────────────────────────────────────
// DELHI NCR HOSPITAL DIRECTORY
// Moved to src/data/hospitals.ts (Phase 4.4 — data relocation).
// Re-exported here for backward compatibility with existing imports.
// ─────────────────────────────────────────────────────────────────

export {
  DELHI_GOVT_HOSPITALS,
  DELHI_PRIVATE_HOSPITALS,
  NOIDA_HOSPITALS,
  GHAZIABAD_HOSPITALS,
  GURUGRAM_HOSPITALS,
  FARIDABAD_HOSPITALS,
  HOSPITAL_NETWORKS,
} from './data/hospitals';

export const MAX_SEARCH_BATCHES = 5; // progressive-search rounds before giving up

export const BLOOD_COMPONENTS = [
  'Whole Blood (WB)',
  'Packed Red Blood Cells (PRBC)',
  'Single Donor Platelets (SDP)',
  'Random Donor Platelets (RDP)',
  'Fresh Frozen Plasma (FFP)',
  'Cryoprecipitate'
] as const;

export interface Requester {
  id: string; // doc ID
  full_name: string;
  email: string;
  phone: string;
  whatsapp_number?: string;
  account_status?: AccountStatus; // 'deleted' = soft-deleted by admin
  created_at: string;
  updated_at: string;
}

export interface Match {
  /** Opaque capability token (public_token from backend). Raw 'id' is never sent to public clients. */
  matchToken?: string;
  /** @deprecated Raw match UUID no longer returned by public tracking API. May exist on admin/authenticated endpoints. */
  id?: string;
  request_id?: string; // FK to blood_requests — not returned in public tracking projection
  /** @deprecated Not returned in public tracking API (S-1 security fix). */
  donor_id?: string;
  match_rank?: number;
  notification_channel?: 'whatsapp' | 'dashboard' | 'both';
  notification_sent_at?: string | null;
  reminder_sent_at?: string | null;
  donor_response: MatchStatus;
  donor_response_at?: string | null;
  contact_shared_at?: string | null;
  outcome?: MatchOutcome;
  outcome_confirmed_at?: string | null;
  created_at?: string;
  distance_km?: number;
  is_exact_match?: boolean;
  unit_slot?: number | null;
  // Inline donor fields returned by the public tracking projection
  blood_type?: string;
  area?: string;
  city?: string;
  // Only present when status === 'approved'
  donor_name?: string;
  donor_phone?: string;
}

export interface NotificationLog {
  id: string;
  type: NotificationType;
  recipient_type: RecipientType;
  recipient_id: string; // user.id or requester email
  trigger_event: string; // e.g., match_found, approval, cooldown_lifted
  message_body: string;
  status: NotificationStatus;
  sent_at: string | null;
  created_at: string;
}

export interface DonationLog {
  id: string;
  donor_id: string;
  match_id: string | null;
  request_id: string | null;
  donation_date: string; // YYYY-MM-DD
  source: 'platform_match' | 'self_reported' | 'admin_entered';
  notes: string;
  created_at: string;
}

// Recipient \ Donor Compatibility Matrix
// Key is the Recipient's blood type. Value is array of eligible Donor blood types.
export const BLOOD_COMPATIBILITY_MATRIX: Record<BloodType, BloodType[]> = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
};

/**
 * Checks if a donor is compatible with a recipient's blood type
 */
export function isBloodCompatible(donorType: BloodType, recipientType: BloodType | 'ANY'): boolean {
  if (recipientType === 'ANY') return true;
  return BLOOD_COMPATIBILITY_MATRIX[recipientType].includes(donorType);
}

import { DELHI_PINCODES } from './data/pincodes';

/**
 * NCR district → display city mapping
 */
const NCR_DISTRICT_CITY: Record<string, string> = {
  'Delhi': 'New Delhi',
  'Gautam Buddha Nagar': 'Noida / Greater Noida',
  'Ghaziabad': 'Ghaziabad',
  'Gurugram': 'Gurugram',
  'Faridabad': 'Faridabad',
};

/**
 * Looks up a pincode and returns area, city, and district.
 * Covers all Delhi NCR pincodes: Delhi (110xxx), Noida (201xxx),
 * Ghaziabad (201xxx), Gurugram (122xxx), Faridabad (121xxx).
 */
export function lookupPincode(pincode: string): { area: string; city: string; district?: string } | null {
  // Search full NCR dataset (Delhi + all NCR districts)
  const ncrMatch = DELHI_PINCODES.find(d => d.pincode === pincode);
  if (ncrMatch) {
    return {
      area: ncrMatch.area,
      city: NCR_DISTRICT_CITY[ncrMatch.district] ?? ncrMatch.zone,
      district: ncrMatch.district,
    };
  }
  return null;
}

export type InstitutionType = 'hospital' | 'blood_bank' | 'ngo' | 'other';

export interface HospitalUser {
  id: string; // doc ID
  institution_type: InstitutionType;
  hospital_name: string; // Also used as blood bank name or NGO name
  registration_number: string; // Clinical reg / License / Darpan ID
  admin_name: string;
  email: string;
  phone: string;
  address?: string;
  pincode: string;
  city: string;
  status: 'pending' | 'verified' | 'rejected';
  license_number?: string; // Blood bank license
  has_component_facility?: boolean; // Blood bank component separation
  ngo_focus_area?: string; // e.g. 'blood_donation', 'thalassemia', 'general'
  created_at: string;
  updated_at: string;
}

// Maps 1:1 to the `institutions` table in the data store.
// Used by the registration API response and the admin approvals queue.
export interface Institution {
  id: string;
  type: InstitutionType;
  org_name: string;
  registration_number: string;
  contact_person: string;
  phone: string;
  email: string;
  address?: string;
  city: string;
  pincode: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string; // doc ID
  username: string;
  email?: string; // Firebase auth email (preferred display identity)
  role: 'superadmin' | 'moderator';
  created_at: string;
}
