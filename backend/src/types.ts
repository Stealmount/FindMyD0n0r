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

// ─── Progressive matching tuning (single source of truth) ──────────────────────
export const MAX_UNITS_PER_REQUEST = 5;   // hard cap on units_required
export const INITIAL_BATCH_SIZE = 8;      // donors pinged per search round
export const ELIGIBLE_POOL_SIZE = 100;    // ranked candidate pool cap
export const MAX_SEARCH_BATCHES = 5;      // rounds before giving up

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

export type SignupIntent = 'donor' | 'requester' | 'both';
export type OnboardingStep = 'intent' | 'contact' | 'consent' | 'otp' | 'donor-profile' | 'complete';

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  whatsapp_phone: string;
  is_whatsapp: boolean;
  email: string | null;
  whatsapp_verified: boolean;
  consent_accepted_at: string | null;
  can_donate: boolean;
  can_request: boolean;
  trust_report_count: number;
  created_at: string;
  updated_at: string;
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
  requester_email_verified?: boolean; // Email verified (OTP or Gmail fast-track)
  search_batch?: number; // Current progressive-search round (1-based)
}

// ─────────────────────────────────────────────────────────────────
// DELHI NCR HOSPITAL DIRECTORY
// Organized by district for better UX in RequestForm dropdown
// ─────────────────────────────────────────────────────────────────

/** Delhi — Government & Central Institutes */
export const DELHI_GOVT_HOSPITALS = [
  'AIIMS New Delhi — All India Institute of Medical Sciences',
  'Safdarjung Hospital, New Delhi',
  'RML Hospital — Ram Manohar Lohia Hospital',
  'Lady Hardinge Medical College & Hospital',
  'GB Pant Hospital — Govind Ballabh Pant',
  'GTB Hospital — Guru Teg Bahadur Hospital',
  'LNJP Hospital — Lok Nayak Jai Prakash Narayan',
  'Deen Dayal Upadhyay Hospital',
  'Sanjay Gandhi Memorial Hospital',
  'Aruna Asaf Ali Government Hospital',
  'Baba Saheb Ambedkar Medical College & Hospital',
  'IHBAS — Institute of Human Behaviour and Allied Sciences',
  'Rajiv Gandhi Super Speciality Hospital',
  'Janakpuri Super Speciality Hospital',
  'Burari Hospital',
  'Bhagwan Mahavir Hospital, Pitampura',
  'Hedgewar Arogya Sansthan, Karkardooma',
  'Chacha Nehru Bal Chikitsalaya, Geeta Colony',
  'Kalawati Saran Children Hospital',
  'Sushruta Trauma Centre, Delhi',
  'Northern Railway Central Hospital, New Delhi',
];

/** Delhi — Private & Corporate Hospitals */
export const DELHI_PRIVATE_HOSPITALS = [
  'Apollo Hospital, Sarita Vihar',
  'Apollo Spectra Hospital, Karol Bagh',
  'Apollo Cradle, Nehru Place',
  'Max Super Speciality Hospital, Saket',
  'Max Super Speciality Hospital, Patparganj',
  'Max Super Speciality Hospital, Shalimar Bagh',
  'Max Smart Super Speciality Hospital, Saket',
  'Fortis Hospital, Vasant Kunj',
  'Fortis Escorts Heart Institute, Okhla',
  'Fortis La Femme, Greater Kailash',
  'Sir Ganga Ram Hospital, Rajinder Nagar',
  'BLK Max Super Speciality Hospital, Rajinder Place',
  'Indraprastha Apollo Hospital, Sarita Vihar',
  'Manipal Hospital, Dwarka',
  'Manipal Hospital, Janakpuri',
  'Medanta — The Medicity (Gurugram)',
  'Moolchand Medcity, Lajpat Nagar',
  'Primus Super Speciality Hospital, Chanakyapuri',
  'Holy Family Hospital, Okhla',
  'St. Stephens Hospital, Tis Hazari',
  'Venkateshwar Hospital, Dwarka',
  'Columbia Asia Hospital, Palam Vihar',
  'Dharamshila Narayana Superspeciality Hospital, Vasundhara Enclave',
  'Narayana Superspeciality Hospital, Jaipur Road, Delhi',
  'Paras HMRI Hospital, Panchsheel',
  'Mata Chanan Devi Hospital, Janakpuri',
  'Dr. Shroff Charity Eye Hospital, Daryaganj',
  'Batra Hospital & Medical Research Centre, Tughlakabad',
  'Sant Parmanand Hospital, Civil Lines',
  'Jaipur Golden Hospital, Rohini',
  'Balaji Action Medical Institute, Paschim Vihar',
  'Aakash Healthcare Super Speciality Hospital, Dwarka',
  'Ayushman Hospital & Health Services, Dwarka',
  'Vikram Hospital, Green Park',
  'Rockland Hospital, Qutub Institutional Area',
  'IVY Hospital, Sector 71, Delhi',
  'Indian Spinal Injuries Centre, Vasant Kunj',
  'Shri Ram Murti Smarak Institute of Medical Sciences',
];

/** Noida & Greater Noida — Hospitals */
export const NOIDA_HOSPITALS = [
  'Kailash Hospital, Noida Sector 27',
  'Kailash Hospital, Greater Noida',
  'Felix Hospital, Noida Sector 137',
  'Jaypee Hospital, Noida Sector 128',
  'Max Multi Speciality Centre, Noida Sector 19',
  'Fortis Hospital, Noida Sector 62',
  'Sharda Hospital, Greater Noida',
  'Yatharth Hospital, Noida Extension',
  'Yatharth Super Speciality Hospital, Noida Sector 110',
  'Metro Hospital & Cancer Research Centre, Noida',
  'Prakash Hospital, Noida Sector 33',
  'Apollo Cradle, Noida Sector 26',
  'Manipal Hospital, Pari Chowk, Greater Noida',
  'Regency Medical Centre, Noida Sector 50',
  'Cloudnine Hospital, Noida Sector 51',
  'W Pratiksha Hospital, Noida Sector 33',
  'ESIC Hospital, Noida Sector 24',
  'District Hospital, Gautam Buddha Nagar',
  'Government Medical College, Greater Noida',
];

/** Ghaziabad — Hospitals */
export const GHAZIABAD_HOSPITALS = [
  'MMG District Hospital, Ghaziabad',
  'Santosh Medical College & Hospital, Ghaziabad',
  'Yashoda Super Speciality Hospital, Kaushambi',
  'Max Hospital, Vaishali',
  'Columbia Asia Hospital, NH-24',
  'Inlaks & Budhrani Hospital, Ghaziabad',
  'Crosslay Remedies Hospital, Raj Nagar Extension',
  'Sarthak Hospital, Vaishali',
  'Aarogya Hospital, Vasundhara',
  'Navjeevan Hospital, Indirapuram',
  'Sanjivani Hospital, Ghaziabad',
  'GTBH Hospital, Modinagar',
  'Shri Krishna Sevashram Netra Chikitsalaya, Ghaziabad',
];

/** Gurugram — Hospitals */
export const GURUGRAM_HOSPITALS = [
  'Medanta — The Medicity, Sector 38, Gurugram',
  'Fortis Memorial Research Institute, Gurugram',
  'Artemis Hospitals, Gurugram Sector 51',
  'Paras Hospital, Gurugram Sector 2',
  'Columbia Asia Hospital, Palam Vihar, Gurugram',
  'Narayana Superspeciality Hospital, DLF CyberCity',
  'Max Hospital, Gurugram Sohna Road',
  'Aarvy Healthcare, Sector 43 Gurugram',
  'CK Birla Hospital — The Cradle, Gurugram',
  'Cloudnine Hospital, Gurugram Sector 14',
  'Motherhood Hospital, Sector 6, Gurugram',
  'Civil Hospital, Gurugram',
  'PGIMS Rohtak (accessible from Gurugram)',
  'Park Hospital, Gurugram',
  'Ivy Healthcare, Gurugram',
  'Sheetla Hospital, Gurugram',
];

/** Faridabad — Hospitals */
export const FARIDABAD_HOSPITALS = [
  'Sarvodaya Hospital, Faridabad Sector 8',
  'Asian Hospital, Faridabad Sector 21A',
  'Metro Heart Institute, Faridabad Sector 16A',
  'QRG Health City, Faridabad Sector 16',
  'Amrita Hospital, Faridabad Sector 88',
  'ESIC Hospital, Faridabad NIT',
  'BK Hospital, Faridabad',
  'Civil Hospital, Faridabad',
  'Alchemist Hospital, Faridabad',
  'Narayana Superspeciality Hospital, Faridabad',
];

/**
 * Flat master list — used by RequestForm hospital_name dropdown.
 * Groups all NCR hospitals together for easy searching.
 */
export const HOSPITAL_NETWORKS = [
  // ── Government / National ──
  ...DELHI_GOVT_HOSPITALS,
  // ── Delhi Private ──
  ...DELHI_PRIVATE_HOSPITALS,
  // ── Noida / Greater Noida ──
  ...NOIDA_HOSPITALS,
  // ── Ghaziabad ──
  ...GHAZIABAD_HOSPITALS,
  // ── Gurugram ──
  ...GURUGRAM_HOSPITALS,
  // ── Faridabad ──
  ...FARIDABAD_HOSPITALS,
  // ── Generic ──
  'FindMyDonor / NBTC Registered Blood Bank',
  'Independent / Community Blood Bank',
  'Other (specify in notes)',
];

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
  account_status?: AccountStatus; // 'deleted' = soft-deleted by admin; omitted = active (legacy docs)
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string; // doc ID
  request_id: string; // FK to blood_requests
  donor_id: string; // FK to users
  match_rank: number; // 1 = closest pincode match, higher = farther
  notification_channel: 'whatsapp' | 'email' | 'dashboard' | 'both';
  notification_sent_at: string | null; // ISO String
  reminder_sent_at: string | null; // ISO String
  donor_response: MatchStatus;
  donor_response_at: string | null; // ISO String
  contact_shared_at: string | null; // ISO String
  outcome: MatchOutcome;
  outcome_confirmed_at: string | null; // ISO String
  created_at: string; // ISO String
  distance_km?: number; // Distance in kilometers from hospital
  is_exact_match?: boolean; // true = donor blood type exactly matches request; false = compatible but not exact
  unit_slot?: number | null; // Which unit (1-based) this donor fills. Assigned when donor says YES.
  notification_status?: 'pending' | 'sent' | 'failed' | 'retrying'; // Delivery state ONLY — never mirrors donor_response
  search_batch?: number; // Which progressive-search round created this match
  // Capability token — opaque random value minted per match. Exposed to donors in the
  // public tracking payload INSTEAD of the raw match id (which is a horizontal-privilege
  // escalation vector: any requester could approve another requester's match by guessing
  // the uuid). Donor must present it to /respond-public to mutate this match.
  public_token?: string | null;
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

import { DELHI_PINCODES } from '../../src/data/pincodes';

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

export interface HospitalUser {
  id: string; // doc ID
  hospital_name: string;
  registration_number: string;
  admin_name: string;
  email: string;
  phone: string;
  pincode: string;
  city: string;
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string; // doc ID
  username: string;
  role: 'superadmin' | 'moderator';
  created_at: string;
}
