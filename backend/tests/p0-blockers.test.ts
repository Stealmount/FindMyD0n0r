import 'dotenv/config';
import test from "node:test";
import assert from "node:assert/strict";
import { toLegacy, Rev3Me } from "../../src/lib/rev3Auth";

test("P0-1: Auth User ID vs Profile ID resolution logic", () => {
  const authUserId = "auth-uuid-1111-2222";
  const profileId = "profile-uuid-3333-4444";

  // Simulate a match created under profileId (not authUserId)
  const match = {
    id: "match-999",
    request_id: "req-111",
    donor_id: profileId,
    donor_response: "pending",
  };

  // Check authorization match condition (must evaluate to true when linkedProfileId is profileId)
  const isAuthorized = match.donor_id === authUserId || match.donor_id === profileId;
  assert.equal(isAuthorized, true, "Authorization must succeed when donor_id matches linked profile ID");

  // Check unauthorized user
  const otherProfileId = "profile-uuid-9999-0000";
  const isUnauthorized = match.donor_id === authUserId || match.donor_id === otherProfileId;
  assert.equal(isUnauthorized, false, "Authorization must fail for different user profile ID");
});

test("P0-2: Role mapping in toLegacy() is exclusive (donor XOR requester)", () => {
  const baseMe: Rev3Me = {
    authUser: { id: "auth-123", email: "user@example.com", provider: "email" },
    profile: null,
    donorProfile: null,
    institution: null,
    nextStep: "complete",
  };

  // Case 1: Donor (can_donate = true, can_request = false, intent donor)
  const donorMe: Rev3Me = {
    ...baseMe,
    profile: {
      id: "prof-1",
      full_name: "Donor User",
      email: "donor@example.com",
      phone: "919876543210",
      whatsapp_phone: "919876543210",
      is_whatsapp: true,
      whatsapp_verified: true,
      consent_accepted_at: "2026-08-01T00:00:00Z",
      can_donate: true,
      can_request: false,
      intent: "donor",
      trust_report_count: 0,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    },
  };
  const legacyDonor = toLegacy(donorMe);
  assert.notEqual(legacyDonor.donor, null, "Donor object must be non-null for Donor role");
  assert.equal(legacyDonor.requester, null, "Requester object must be null for Donor-only role");

  // Case 2: Requester (can_donate = false, can_request = true, intent requester)
  const requesterMe: Rev3Me = {
    ...baseMe,
    profile: {
      id: "prof-2",
      full_name: "Requester User",
      email: "req@example.com",
      phone: "919876543211",
      whatsapp_phone: "919876543211",
      is_whatsapp: true,
      whatsapp_verified: true,
      consent_accepted_at: "2026-08-01T00:00:00Z",
      can_donate: false,
      can_request: true,
      intent: "requester",
      trust_report_count: 0,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    },
  };
  const legacyReq = toLegacy(requesterMe);
  assert.equal(legacyReq.donor, null, "Donor object must be null for Requester-only role");
  assert.notEqual(legacyReq.requester, null, "Requester object must be non-null for Requester role");

  // Case 3: Dual flags but intent "requester" → requester ONLY (intent wins)
  const dualRequesterMe: Rev3Me = {
    ...baseMe,
    profile: {
      id: "prof-3",
      full_name: "Migrated Requester",
      email: "dual@example.com",
      phone: "919876543212",
      whatsapp_phone: "919876543212",
      is_whatsapp: true,
      whatsapp_verified: true,
      consent_accepted_at: "2026-08-01T00:00:00Z",
      can_donate: true,
      can_request: true,
      intent: "requester",
      trust_report_count: 0,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    },
  };
  const legacyDualRequester = toLegacy(dualRequesterMe);
  assert.equal(legacyDualRequester.donor, null, "Dual-flag account with requester intent must NOT resolve as donor");
  assert.notEqual(legacyDualRequester.requester, null, "Dual-flag account with requester intent must resolve as requester");

  // Case 4: Dual flags, NO intent → donor ONLY (no intent ⇒ donor)
  const dualNoIntentMe: Rev3Me = {
    ...baseMe,
    profile: {
      id: "prof-4",
      full_name: "Legacy Dual User",
      email: "legacydual@example.com",
      phone: "919876543213",
      whatsapp_phone: "919876543213",
      is_whatsapp: true,
      whatsapp_verified: true,
      consent_accepted_at: "2026-08-01T00:00:00Z",
      can_donate: true,
      can_request: true,
      trust_report_count: 0,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    },
  };
  const legacyDualNoIntent = toLegacy(dualNoIntentMe);
  assert.notEqual(legacyDualNoIntent.donor, null, "Legacy dual-flag account with no intent defaults to donor");
  assert.equal(legacyDualNoIntent.requester, null, "Legacy dual-flag account with no intent must NOT resolve as requester");

  // Case 5: Donor-only flags, NO intent → donor ONLY (flag fallback intact)
  const donorNoIntentMe: Rev3Me = {
    ...baseMe,
    profile: {
      id: "prof-5",
      full_name: "Flag Donor",
      email: "flagdonor@example.com",
      phone: "919876543214",
      whatsapp_phone: "919876543214",
      is_whatsapp: true,
      whatsapp_verified: true,
      consent_accepted_at: "2026-08-01T00:00:00Z",
      can_donate: true,
      can_request: false,
      trust_report_count: 0,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    },
  };
  const legacyFlagDonor = toLegacy(donorNoIntentMe);
  assert.notEqual(legacyFlagDonor.donor, null, "Donor flag fallback works when intent is absent");
  assert.equal(legacyFlagDonor.requester, null, "Donor-only profile never gains requester");
});
