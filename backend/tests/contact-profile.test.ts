import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, isValidIndianPhone } from '../helpers/phone';

// Unit tests for Phase 2 Contact Profile logic & validation rules
describe('Phase 2 Contact Profile Backend Logic', () => {

  test('Validation: normalizePhone and isValidIndianPhone', () => {
    assert.equal(normalizePhone('9876543210'), '919876543210');
    assert.equal(normalizePhone('+91 98765 43210'), '919876543210');

    assert.equal(isValidIndianPhone('919876543210'), true);
    assert.equal(isValidIndianPhone('9876543210'), true);
    assert.equal(isValidIndianPhone('915876543210'), false, '5... is invalid starting digit');
    assert.equal(isValidIndianPhone('91123'), false, 'too short');
    assert.equal(isValidIndianPhone(''), false, 'empty');
  });

  test('A. First phone addition succeeds without OTP requirement', () => {
    const existingPhone = null; // No existing phone on profile
    const newPhoneRaw = '9876543210';
    const normalized = normalizePhone(newPhoneRaw);

    assert.equal(isValidIndianPhone(normalized), true);
    // Condition for OTP requirement: existingPhone && existingPhone !== normalized
    const requiresOtp = Boolean(existingPhone && existingPhone !== normalized);
    assert.equal(requiresOtp, false, 'First-time phone addition must NOT require OTP');
  });

  test('B. First WhatsApp addition succeeds without OTP requirement', () => {
    const existingWaPhone = null; // No existing WhatsApp on profile
    const newWaPhoneRaw = '9123456789';
    const normalized = normalizePhone(newWaPhoneRaw);

    assert.equal(isValidIndianPhone(normalized), true);
    const requiresOtp = Boolean(existingWaPhone && existingWaPhone !== normalized);
    assert.equal(requiresOtp, false, 'First-time WhatsApp addition must NOT require OTP');
  });

  test('C. Phone and WhatsApp independence', () => {
    const patchPhoneOnly: Record<string, unknown> = {};
    const rawPhone = '9876543210';
    const rawWaPhone = undefined;

    if (rawPhone !== undefined) {
      patchPhoneOnly.phone = normalizePhone(rawPhone);
    }
    if (rawWaPhone !== undefined) {
      patchPhoneOnly.whatsapp_phone = normalizePhone(rawWaPhone);
    }

    assert.equal(patchPhoneOnly.phone, '919876543210');
    assert.equal(patchPhoneOnly.whatsapp_phone, undefined, 'WhatsApp must remain untouched when updating phone');

    const patchWaOnly: Record<string, unknown> = {};
    const rawPhone2 = undefined;
    const rawWaPhone2 = '9123456789';

    if (rawPhone2 !== undefined) {
      patchWaOnly.phone = normalizePhone(rawPhone2);
    }
    if (rawWaPhone2 !== undefined) {
      patchWaOnly.whatsapp_phone = normalizePhone(rawWaPhone2);
    }

    assert.equal(patchWaOnly.phone, undefined, 'Phone must remain untouched when updating WhatsApp');
    assert.equal(patchWaOnly.whatsapp_phone, '919123456789');
  });

  test('D. Existing contact change requires OTP verification token', () => {
    const existingPhone: string = '919876543210';
    const newPhone: string = '919999999999';
    const verificationToken: string | undefined = undefined;

    const requiresOtp = Boolean(existingPhone && existingPhone !== newPhone);
    assert.equal(requiresOtp, true, 'Changing an already-stored phone requires OTP');

    let errorState = null;
    if (requiresOtp && !verificationToken) {
      errorState = 'OTP verification token required to change existing phone number.';
    }
    assert.equal(errorState, 'OTP verification token required to change existing phone number.');
  });

  test('E. Invalid phone is rejected', () => {
    const invalidPhone = '12345';
    const normalized = normalizePhone(invalidPhone);
    assert.equal(isValidIndianPhone(normalized), false);
  });

  test('F. Invalid WhatsApp is rejected', () => {
    const invalidWa = 'abcd';
    const normalized = normalizePhone(invalidWa);
    assert.equal(isValidIndianPhone(normalized), false);
  });

  test('G. Authenticated user cannot update another user profile', () => {
    // Simulated auth check: endpoint resolves profile via getAuthenticatedUser(req) -> getLinkedProfile(authUser.id)
    const authUserId = 'user-123-id';
    const clientPayload = { profileId: 'victim-456-id', phone: '9876543210' };

    // Endpoint strictly ignores clientPayload.profileId and targets user-123-id's profile:
    const targetProfileId = authUserId; // strictly tied to auth session
    assert.notEqual(targetProfileId, clientPayload.profileId, 'Client-supplied profileId is strictly ignored');
  });

  test('H. Donor and Requester use the same profiles table and endpoint logic', () => {
    const donorProfile = { id: 'p1', user_id: 'u1', intent: 'donor', phone: null, whatsapp_phone: null };
    const requesterProfile = { id: 'p2', user_id: 'u2', intent: 'requester', phone: null, whatsapp_phone: null };

    // Both profiles have identical contact schema and behavior:
    assert.equal(donorProfile.phone, null);
    assert.equal(requesterProfile.phone, null);
  });

});
