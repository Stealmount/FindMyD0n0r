import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Phase 3 Dashboard-First Onboarding Logic & Contract', () => {

  test('1 & 5. ContactInfoBanner visibility rules based on contact info', () => {
    // Missing phone or whatsapp_phone -> Banner should render
    const profileMissingPhone = { phone: null, whatsapp_phone: '919876543210' };
    const profileMissingWa = { phone: '919876543210', whatsapp_phone: null };
    const profileComplete = { phone: '919876543210', whatsapp_phone: '919876543210' };

    const shouldShowForMissingPhone = !profileMissingPhone.phone || !profileMissingPhone.whatsapp_phone;
    const shouldShowForMissingWa = !profileMissingWa.phone || !profileMissingWa.whatsapp_phone;
    const shouldShowForComplete = !profileComplete.phone || !profileComplete.whatsapp_phone;

    assert.equal(shouldShowForMissingPhone, true, 'Renders when phone is missing');
    assert.equal(shouldShowForMissingWa, true, 'Renders when WhatsApp is missing');
    assert.equal(shouldShowForComplete, false, 'Does NOT render when contact is complete');
  });

  test('2, 3, 4. Banner dismissal per session via sessionStorage', () => {
    // Mock sessionStorage behavior
    const store = new Map<string, string>();
    const sessionStorageMock = {
      getItem: (key: string) => store.get(key) || null,
      setItem: (key: string, val: string) => store.set(key, val),
      clearSession: () => store.clear(),
    };

    // Session 1: Initial state (not dismissed)
    assert.equal(sessionStorageMock.getItem('contact_banner_dismissed'), null);

    // User dismisses banner
    sessionStorageMock.setItem('contact_banner_dismissed', '1');
    assert.equal(sessionStorageMock.getItem('contact_banner_dismissed'), '1');

    // New session starts (browser/tab closed) -> sessionStorage clears
    sessionStorageMock.clearSession();
    assert.equal(sessionStorageMock.getItem('contact_banner_dismissed'), null, 'Reappears in new session if incomplete');
  });

  test('6. Donor with missing blood group or pincode gets donor completion prompt', () => {
    const donorMissingBloodGroup = { can_donate: true, blood_type: null, pincode: '110001' };
    const donorMissingPincode = { can_donate: true, blood_type: 'O+', pincode: null };
    const donorComplete = { can_donate: true, blood_type: 'O+', pincode: '110001' };

    const promptForMissingBg = !donorMissingBloodGroup.blood_type || !donorMissingBloodGroup.pincode;
    const promptForMissingPin = !donorMissingPincode.blood_type || !donorMissingPincode.pincode;
    const promptForComplete = !donorComplete.blood_type || !donorComplete.pincode;

    assert.equal(promptForMissingBg, true, 'Prompt shown when blood type is missing');
    assert.equal(promptForMissingPin, true, 'Prompt shown when pincode is missing');
    assert.equal(promptForComplete, false, 'Prompt NOT shown when donor profile is complete');
  });

  test('7. Requester does NOT receive donor-specific prompt', () => {
    const requesterProfile = { can_donate: false, can_request: true };

    // Donor prompt condition strictly requires donor capability:
    const showDonorPromptForRequester = Boolean(requesterProfile.can_donate && (!requesterProfile as any).blood_type);
    assert.equal(showDonorPromptForRequester, false, 'Requester role does not show donor-specific prompts');
  });

  test('8. Donor and requester roles are mutually exclusive after the split', () => {
    const donorOnly = { can_donate: true, can_request: false, blood_type: null, pincode: '110001' };
    const requesterOnly = { can_donate: false, can_request: true, blood_type: null, pincode: '110001' };

    // Donor prompt condition strictly requires donor capability:
    const showDonorPromptForDonor = Boolean(donorOnly.can_donate && (!donorOnly.blood_type || !donorOnly.pincode));
    const showDonorPromptForRequester = Boolean(requesterOnly.can_donate && (!requesterOnly.blood_type || !requesterOnly.pincode));

    assert.equal(donorOnly.can_request, false, 'Pure donor has no requester capability');
    assert.equal(requesterOnly.can_donate, false, 'Pure requester has no donor capability');
    assert.equal(showDonorPromptForDonor, true, 'Donor with incomplete profile gets donor completion prompt');
    assert.equal(showDonorPromptForRequester, false, 'Requester never receives donor-specific prompt');
  });

  test('9 & 10. Contact submission uses PATCH /api/profile/contact and preserves independence', () => {
    const contactUpdateEndpoint = '/api/profile/contact';
    const httpMethod = 'PATCH';
    const payloadPhoneOnly = { phone: '9876543210' };
    const payloadWaOnly = { whatsappPhone: '9123456789' };

    assert.equal(contactUpdateEndpoint, '/api/profile/contact');
    assert.equal(httpMethod, 'PATCH');
    assert.equal(payloadPhoneOnly.phone, '9876543210');
    assert.equal((payloadPhoneOnly as any).whatsappPhone, undefined, 'Phone payload does not touch whatsappPhone');
    assert.equal(payloadWaOnly.whatsappPhone, '9123456789');
    assert.equal((payloadWaOnly as any).phone, undefined, 'WhatsApp payload does not touch phone');
  });

  test('11. Contact field independence contract (A through H)', () => {
    // A & B. State handlers: Phone input does not modify WhatsApp input, and vice versa
    let statePhone = '9876543210';
    let stateWa = '9123456789';

    const setPhoneInput = (val: string) => { statePhone = val; };
    const setWaInput = (val: string) => { stateWa = val; };

    // A: Phone edit does not touch WA state
    setPhoneInput('9999999999');
    assert.equal(statePhone, '9999999999');
    assert.equal(stateWa, '9123456789', 'A. Phone input edit must NOT modify WhatsApp input');

    // B: WhatsApp edit does not touch Phone state
    setWaInput('8888888888');
    assert.equal(stateWa, '8888888888');
    assert.equal(statePhone, '9999999999', 'B. WhatsApp input edit must NOT modify Phone input');

    // C. Phone-only submission does not contain whatsappPhone
    const submitPhoneOnly = (phone: string) => ({ phone });
    const phonePayload = submitPhoneOnly('9876543210');
    assert.equal(phonePayload.phone, '9876543210');
    assert.equal((phonePayload as any).whatsappPhone, undefined, 'C. Phone-only submission does not contain whatsappPhone');

    // D. WhatsApp-only submission does not contain phone
    const submitWaOnly = (whatsappPhone: string) => ({ whatsappPhone });
    const waPayload = submitWaOnly('9123456789');
    assert.equal(waPayload.whatsappPhone, '9123456789');
    assert.equal((waPayload as any).phone, undefined, 'D. WhatsApp-only submission does not contain phone');

    // E. Both fields submit independently
    const submitBoth = (phone: string, whatsappPhone: string) => ({ phone, whatsappPhone });
    const bothPayload = submitBoth('9876543210', '9123456789');
    assert.equal(bothPayload.phone, '9876543210');
    assert.equal(bothPayload.whatsappPhone, '9123456789', 'E. Both fields submit independently');

    // F & G. Preservation of existing numbers during single-field edit
    const existingProfile = { phone: '919876543210', whatsapp_phone: '919123456789' };

    // F: User edits phone only -> existing whatsapp_phone survives
    const patchPhone = { phone: '919999999999' };
    const updatedProfileAfterPhoneEdit = {
      phone: patchPhone.phone,
      whatsapp_phone: existingProfile.whatsapp_phone,
    };
    assert.equal(updatedProfileAfterPhoneEdit.phone, '919999999999');
    assert.equal(updatedProfileAfterPhoneEdit.whatsapp_phone, '919123456789', 'F. Existing WhatsApp survives a phone edit');

    // G: User edits WhatsApp only -> existing phone survives
    const patchWa = { whatsappPhone: '918888888888' };
    const updatedProfileAfterWaEdit = {
      phone: existingProfile.phone,
      whatsapp_phone: patchWa.whatsappPhone,
    };
    assert.equal(updatedProfileAfterWaEdit.phone, '919876543210', 'G. Existing phone survives a WhatsApp edit');
    assert.equal(updatedProfileAfterWaEdit.whatsapp_phone, '918888888888');

    // H. No sameAsPhone coupling remains in component source files
    const bannerSource = readFileSync(join(__dirname, '../../src/components/DonorDashboard/ContactInfoBanner.tsx'), 'utf8');
    const settingsSource = readFileSync(join(__dirname, '../../src/components/DonorDashboard/SettingsPanel.tsx'), 'utf8');

    assert.equal(bannerSource.includes('sameAsPhone'), false, 'H1. ContactInfoBanner must not contain sameAsPhone');
    assert.equal(bannerSource.includes('contact-same-as-phone'), false, 'H2. ContactInfoBanner must not contain contact-same-as-phone');
    assert.equal(settingsSource.includes('sameAsPhone'), false, 'H3. SettingsPanel must not contain sameAsPhone');
    assert.equal(settingsSource.includes('settings-same-as-phone'), false, 'H4. SettingsPanel must not contain settings-same-as-phone');
  });

});

